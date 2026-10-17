import { assertSameOrigin } from "@/lib/device-auth";
import { OwnerApiError, ownerErrorResponse, requireOwner } from "@/lib/owner-api";
import { randomUUID } from "node:crypto";
import { billingProofStoragePath, BILLING_PROOF_RETENTION_DAYS, deleteExpiredBillingProofs } from "@/lib/billing-proof-retention";
import { verifyBillingProof } from "@/lib/billing-proof-ocr";
import {
  cleanWhatsAppMessageField,
  createWhatsAppUrl,
  formatWhatsAppDate,
  formatWhatsAppRupiah,
  getSuperAdminWhatsAppNumber,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROOF_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function GET(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    try {
      await deleteExpiredBillingProofs(admin, warkopId);
    } catch (cleanupError) {
      console.error("Pembersihan bukti billing tenant tertunda:", cleanupError);
    }

    const [platformRes, billingsRes, warkopRes] = await Promise.all([
      admin.from("platform_settings").select("*").eq("id", "global").maybeSingle(),
      admin.from("saas_billings").select("*").eq("warkop_id", warkopId).order("tanggal", { ascending: false }).limit(15),
      admin.from("warkops").select("id,nama,unique_code_range_start,unique_code_range_end").eq("id", warkopId).single(),
    ]);

    if (platformRes.error) throw platformRes.error;
    if (billingsRes.error) throw billingsRes.error;
    if (warkopRes.error) throw warkopRes.error;

    const platform = platformRes.data;
    const billings = billingsRes.data || [];

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
    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);

    const formData = await request.formData();
    const file = formData.get("file");
    const billingId = formData.get("billingId") ? String(formData.get("billingId")) : null;

    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_PROOF_SIZE) {
      throw new OwnerApiError("Bukti transfer wajib berupa foto/gambar (PNG/JPG/WebP) maksimal 5 MB.", 400);
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

    const { data: warkop, error: warkopError } = await admin
      .from("warkops")
      .select("nama,address,city_regency,province")
      .eq("id", warkopId)
      .single();
    if (warkopError || !warkop) throw new OwnerApiError("Profil tenant tidak ditemukan.", 404);

    // OCR berjalan sebelum berkas atau hasilnya disimpan ke Supabase.
    const image = Buffer.from(await file.arrayBuffer());
    const ocr = await verifyBillingProof(image, Number(billing.total_tagihan));
    if (!ocr.verified) {
      throw new OwnerApiError(`${ocr.reason} Pastikan foto jelas dan menampilkan nominal transfer lengkap.`, 422);
    }

    // Setelah lolos OCR, unggah file ke bucket bukti-transfer.
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

    // Simpan path permanen, bukan signed URL sementara.
    const { data: updated, error: updateError } = await admin
      .from("saas_billings")
      .update({
        bukti_transfer_url: storagePath,
        status_bayar: "PAID",
        ocr_raw_text: JSON.stringify({
          engine: "tesseract-lstm",
          confidence: ocr.confidence,
          extractedAmount: Number(billing.total_tagihan),
          extractedAmounts: ocr.extractedAmounts,
          uniqueCodeMatch: true,
          matchedUniqueCode: Number(billing.kode_unik),
          verifiedAt: new Date().toISOString(),
          matchNotes: `Nominal transfer cocok persis Rp ${Number(billing.total_tagihan).toLocaleString("id-ID")}.`,
          rawText: ocr.rawText,
        }),
      })
      .eq("id", billing.id)
      .select("id, status_bayar, bukti_transfer_url, total_tagihan, tanggal")
      .single();

    if (updateError) {
      await admin.storage.from("bukti-transfer").remove([storagePath]);
      throw updateError;
    }

    const previousPath = billing.bukti_transfer_url ? billingProofStoragePath(billing.bukti_transfer_url) : null;
    if (previousPath && previousPath !== storagePath) {
      await admin.storage.from("bukti-transfer").remove([previousPath]);
    }

    // Catat ke audit_logs
    await admin.from("audit_logs").insert({
      warkop_id: warkopId,
      actor_user_id: user.id,
      action: "OWNER_UPLOADED_SAAS_PROOF",
      target_type: "saas_billing",
      target_id: billing.id,
      metadata: {
        total_tagihan: billing.total_tagihan,
        tanggal: billing.tanggal,
        file_path: storagePath,
        ocr_confidence: ocr.confidence,
        retention_days: BILLING_PROOF_RETENTION_DAYS,
      },
    });

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
      "Bukti pembayaran telah diunggah dan lolos pemeriksaan sistem. Mohon cek Dashboard Super Admin.",
    ].join("\n");

    return Response.json({
      success: true,
      message: "Bukti transfer terverifikasi. Pesan WhatsApp konfirmasi siap dikirim ke Super Admin.",
      data: {
        ...updated,
        whatsappUrl: createWhatsAppUrl(adminPhone, message),
      },
    });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}
