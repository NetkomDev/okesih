import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrustedUserRole } from "@/lib/auth-role";
import { assertSameOrigin } from "@/lib/device-auth";
import { z } from "zod";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const role = getTrustedUserRole(user);
    const isSuperAdmin = role === "SUPERADMIN";

    if (!user || !isSuperAdmin) {
      return NextResponse.json({ error: "Hanya super admin yang berhak mengakses log setoran sewa." }, { status: 403 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Konfigurasi server database belum lengkap." }, { status: 500 });
    }

    // Ambil semua tagihan sewa SaaS beserta data warkop
    const { data: rawBillings, error } = await admin
      .from("saas_billings")
      .select("*, warkops(id, nama, slug, logo_url)")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Gagal mengambil log saas_billings:", error);
      return NextResponse.json({ error: "Gagal memuat log setoran sewa." }, { status: 500 });
    }

    const now = new Date();

    const paths = [...new Set((rawBillings || []).flatMap((b) => b.bukti_transfer_url && !b.bukti_transfer_url.startsWith("http") ? [b.bukti_transfer_url as string] : []))];
    const signed = paths.length ? await admin.storage.from("bukti-transfer").createSignedUrls(paths, 600) : { data: [], error: null };
    if (signed.error) throw signed.error;
    const urls = new Map((signed.data || []).map((item) => [item.path, item.signedUrl]));
    const billings = (rawBillings || []).map((b) => {
      const graceTime = b.grace_until ? new Date(b.grace_until) : null;
      const isGrace = b.status_bayar === "UNPAID" && graceTime && graceTime.getTime() > now.getTime();
      const isOverdue = b.status_bayar === "UNPAID" && (!graceTime || graceTime.getTime() <= now.getTime());

      let statusBadge = "UNPAID";
      if (b.status_bayar === "PAID") statusBadge = "PAID";
      else if (b.status_bayar === "PENDING_REVIEW") statusBadge = "PENDING_REVIEW";
      else if (isGrace) statusBadge = "GRACE_PERIOD";
      else if (isOverdue) statusBadge = "OVERDUE";

      // Parse metadata OCR jika ada
      let parsedOcr: { bankName?: string; confidence?: number; transferDate?: string; matchNotes?: string } = {};
      if (b.ocr_raw_text) {
        try {
          if (b.ocr_raw_text.startsWith("{")) {
            parsedOcr = JSON.parse(b.ocr_raw_text);
          } else {
            parsedOcr = { matchNotes: b.ocr_raw_text };
          }
        } catch {
          parsedOcr = { matchNotes: b.ocr_raw_text };
        }
      }

      return {
        id: b.id,
        warkopId: b.warkop_id,
        warkopName: b.warkops?.nama || "Warkop Mitra",
        warkopSlug: b.warkops?.slug || "",
        warkopLogo: b.warkops?.logo_url || null,
        tanggal: b.tanggal,
        totalTransactions: Number(b.total_transactions || 0),
        tagihanPokok: Number(b.tagihan_pokok || 0),
        kodeUnik: Number(b.kode_unik || 0),
        totalTagihan: Number(b.total_tagihan || 0),
        statusBayar: b.status_bayar,
        statusBadge,
        buktiTransferUrl: urls.get(b.bukti_transfer_url) || b.bukti_transfer_url || null,
        ocrRawText: b.ocr_raw_text || null,
        ocrBank: parsedOcr.bankName || "Transfer Bank / QRIS",
        ocrConfidence: parsedOcr.confidence || 0,
        ocrNotes: parsedOcr.matchNotes || null,
        graceUntil: b.grace_until,
        createdAt: b.created_at,
      };
    });

    const totalBills = billings.length;
    const paidBills = billings.filter((b) => b.statusBayar === "PAID");
    const totalPaidAmount = paidBills.reduce((sum, b) => sum + b.totalTagihan, 0);
    const pendingCount = billings.filter((b) => b.statusBadge === "PENDING_REVIEW" || b.statusBadge === "GRACE_PERIOD").length;

    return NextResponse.json({
      success: true,
      data: {
        billings,
        summary: {
          totalBills,
          paidCount: paidBills.length,
          totalPaidAmount,
          pendingCount,
        },
      },
    });
  } catch (error) {
    console.error("GET saas_billings error:", error);
    return NextResponse.json({ error: "Gagal memproses permintaan log setoran sewa." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await createServerSupabaseClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user || getTrustedUserRole(user) !== "SUPERADMIN") return NextResponse.json({ error: "Akses Superadmin diperlukan." }, { status: 403 });
    const input = z.object({ billingId: z.string().uuid(), action: z.enum(["APPROVE", "REJECT"]), reference: z.string().trim().min(4).max(160).optional(), notes: z.string().max(1000).optional() }).parse(await request.json());
    if (input.action === "APPROVE" && !input.reference) return NextResponse.json({ error: "Nomor referensi pembayaran wajib diisi." }, { status: 400 });
    const admin = getAdminClient();
    if (!admin) throw new Error("Database unavailable");
    const { data, error } = await admin.rpc("review_billing", { p_billing_id: input.billingId, p_actor: user.id, p_action: input.action, p_reference: input.reference || null, p_notes: input.notes || null });
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Referensi pembayaran sudah digunakan." : "Tagihan tidak dapat diproses. Muat ulang dan periksa status bukti." }, { status: 409 });
    return NextResponse.json({ success: true, data, message: input.action === "APPROVE" ? "Penerimaan dana dikonfirmasi dan tagihan dilunasi." : "Bukti ditolak. Owner dapat mengunggah ulang." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Data review tidak valid." : "Review belum dapat diproses." }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
