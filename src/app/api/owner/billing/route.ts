import { assertSameOrigin } from "@/lib/device-auth";
import { OwnerApiError, ownerErrorResponse, requireOwner } from "@/lib/owner-api";
import { createHash, randomUUID } from "node:crypto";
import { BILLING_PROOF_RETENTION_DAYS } from "@/lib/billing-proof-retention";
import { verifyBillingProof } from "@/lib/billing-proof-ocr";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import {
  cleanWhatsAppMessageField,
  createWhatsAppUrl,
  formatWhatsAppDate,
  formatWhatsAppRupiah,
  getSuperAdminWhatsAppNumber,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROOF_SIZE = 4 * 1024 * 1024; // Below the function payload limit
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const [platformRes, billingsRes, warkopRes, unpaidRes] = await Promise.all([
      admin.from("platform_settings").select("*").eq("id", "global").maybeSingle(),
      admin.from("saas_billings").select("*").eq("warkop_id", warkopId).order("tanggal", { ascending: false }).limit(15),
      admin.from("warkops").select("id,nama,unique_code_range_start,unique_code_range_end").eq("id", warkopId).single(),
      admin.from("saas_billings").select("*").eq("warkop_id", warkopId).neq("status_bayar", "PAID").order("tanggal").order("created_at").limit(1).maybeSingle(),
    ]);

    if (platformRes.error) throw platformRes.error;
    if (billingsRes.error) throw billingsRes.error;
    if (warkopRes.error) throw warkopRes.error;

    const platform = platformRes.data;
    if (unpaidRes.error) throw unpaidRes.error;
    const billings = [...new Map([...(unpaidRes.data ? [unpaidRes.data] : []), ...(billingsRes.data || [])].map((row) => [row.id, row])).values()];

    // Cari tagihan aktif: yang berstatus UNPAID / PENDING_REVIEW terlebih dahulu, atau tagihan paling terbaru
    const activeBilling = billings.find((b) => b.status_bayar !== "PAID") || billings[0] || null;

    // Generate signed URL untuk bukti transfer jika ada
    const signedBillings = await Promise.all(
      billings.map(async (b) => {
        let proofUrl = b.bukti_transfer_url;
        if (proofUrl && !proofUrl.startsWith("http")) {
          const { data } = await admin.storage.from("bukti-transfer").createSignedUrl(proofUrl, 60 * 60 * 24);
          if (data?.signedUrl) proofUrl = data.signedUrl;
        }
        return {
          id: b.id,
          tanggal: b.tanggal,
          totalTransactions: Number(b.total_transactions || 0),
          tagihanPokok: Number(b.tagihan_pokok || 0),
          kodeUnik: Number(b.kode_unik || 0),
          totalTagihan: Number(b.total_tagihan || 0),
          statusBayar: b.status_bayar,
          buktiTransferUrl: proofUrl,
          graceUntil: b.grace_until,
          createdAt: b.created_at,
        };
      })
    );

    const activeSigned = signedBillings.find((b) => b.id === activeBilling?.id) || null;

    return Response.json({
      success: true,
      data: {
        activeBilling: activeSigned,
        recentBillings: signedBillings,
        centralPayment: {
          qrisImageUrl: platform?.qris_image_url || "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020101021126570014ID.LINKAJA.WWW01189360091100210001000215ID10293847565204549953033605802ID5920OKESIH+SAAS+PUSAT6007JAKARTA61051234062070703A016304",
          qrisMerchantName: platform?.qris_merchant_name || "OKESIH SAAS PUSAT (BANK CENTRAL ASIA)",
          bankName: platform?.bank_name || "BCA",
          bankAccountNumber: platform?.bank_account_number || "8001928374",
          bankAccountName: platform?.bank_account_name || "PT OKESIH KARYA DIGITAL",
          saasFeePerReceipt: Number(platform?.saas_fee_per_receipt || 100),
        },
        proofRetentionDays: BILLING_PROOF_RETENTION_DAYS,
      },
    });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, user, warkopId } = await requireOwner(request);
    await enforceRateLimit(admin, request, "billing-upload", 6, 300, warkopId);
    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);

    const formData = await request.formData();
    const file = formData.get("file");
    const billingId = formData.get("billingId") ? String(formData.get("billingId")) : null;

    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_PROOF_SIZE) {
      throw new OwnerApiError("Bukti transfer wajib berupa foto/gambar (PNG/JPG/WebP) maksimal 4 MB.", 400);
    }

    // Cari billing yang dituju
    let targetBillingId = billingId;
    if (!targetBillingId) {
      const { data: latestBilling, error: latestError } = await admin
        .from("saas_billings")
        .select("id")
        .eq("warkop_id", warkopId)
        .order("tanggal", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError) throw latestError;
      if (!latestBilling) {
        throw new OwnerApiError("Belum ada tagihan sewa aktif untuk warkop Anda.", 404);
      }
      targetBillingId = latestBilling.id;
    }

    // Pastikan billing tersebut memang milik warkop ini
    const { data: billing, error: billingError } = await admin
      .from("saas_billings")
      .select("id, status_bayar, tanggal, total_tagihan, kode_unik, bukti_transfer_url")
      .eq("id", targetBillingId)
      .eq("warkop_id", warkopId)
      .single();

    if (billingError || !billing) {
      throw new OwnerApiError("Tagihan sewa tidak ditemukan.", 404);
    }

    if (billing.status_bayar === "PAID") throw new OwnerApiError("Tagihan sudah lunas.", 409);

    const { data: warkop, error: warkopError } = await admin
      .from("warkops")
      .select("nama,address,city_regency,province")
      .eq("id", warkopId)
      .single();
    if (warkopError || !warkop) throw new OwnerApiError("Profil tenant tidak ditemukan.", 404);

    // OCR berjalan sebelum berkas atau hasilnya disimpan ke Supabase.
    const image = Buffer.from(await file.arrayBuffer());
    const ocr = await verifyBillingProof(image, Number(billing.total_tagihan)).catch(() => { throw new OwnerApiError("Gambar tidak valid atau dimensinya terlalu besar (maksimal 16 megapiksel).", 400); });


    // Simpan bukti untuk pemeriksaan manual, terlepas dari kecocokan teks OCR.
    const ext = EXTENSIONS[file.type] || "jpg";
    const storagePath = `saas-billings/${warkopId}/${billing.id}_${randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("bukti-transfer")
      .upload(storagePath, image, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Gagal mengunggah bukti transfer sewa:", uploadError);
      throw new OwnerApiError("Gagal menyimpan berkas bukti transfer ke storage.", 500);
    }

    const { data: updated, error: updateError } = await admin.rpc("submit_billing_proof", {
      p_billing_id: billing.id, p_warkop_id: warkopId, p_actor: user.id,
      p_path: storagePath, p_hash: createHash("sha256").update(image).digest("hex"),
      p_ocr: JSON.stringify({ confidence: ocr.confidence, durationMs: ocr.durationMs,
        extractedAmounts: ocr.extractedAmounts, amountMatches: ocr.verified, rawText: ocr.rawText,
        matchNotes: `${ocr.reason} Pelunasan menunggu pemeriksaan Superadmin.` }),
    });
    if (updateError) {
      const { error: cleanupError } = await admin.from("storage_cleanup_jobs").upsert({ bucket: "bukti-transfer", path: storagePath }, { onConflict: "bucket,path" });
      if (cleanupError) console.error("billing_orphan_cleanup_failed", { billingId: billing.id });
      throw new OwnerApiError(updateError.code === "23505" ? "Bukti sudah digunakan untuk tagihan lain." : "Bukti belum dapat disimpan. Muat ulang tagihan.", 409);
    }

    const fullAddress = [warkop.address, warkop.city_regency, warkop.province]
      .map(cleanWhatsAppMessageField)
      .filter(Boolean)
      .join(", ");
    const message = [
      "*KONFIRMASI PEMBAYARAN SEWA SAAS OKESIH*",
      "",
      `Tenant: *${cleanWhatsAppMessageField(warkop.nama)}*`,
      `Alamat: ${fullAddress || "Belum dilengkapi"}`,
      `Tanggal tagihan: ${formatWhatsAppDate(billing.tanggal)}`,
      `Jumlah pembayaran: *${formatWhatsAppRupiah(billing.total_tagihan)}*`,
      `ID Tagihan: ${billing.id}`,
      "",
      "Bukti pembayaran diunggah dan menunggu konfirmasi penerimaan dana oleh Superadmin.",
    ].join("\n");

    return Response.json({
      success: true,
      message: "Bukti tersimpan. Tagihan menunggu persetujuan Superadmin.",
      data: {
        ...updated,
        whatsappUrl: createWhatsAppUrl(adminPhone, message),
      },
    });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}
