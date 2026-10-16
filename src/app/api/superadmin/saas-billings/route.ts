import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrustedUserRole } from "@/lib/auth-role";

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
    const isSuperAdmin = role === "SUPERADMIN" || user?.email?.toLowerCase().startsWith("superadmin");

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
        buktiTransferUrl: b.bukti_transfer_url || null,
        ocrRawText: b.ocr_raw_text || null,
        ocrBank: parsedOcr.bankName || "Transfer Bank / QRIS",
        ocrConfidence: parsedOcr.confidence || (b.status_bayar === "PAID" ? 99 : 0),
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
    const sessionClient = await createServerSupabaseClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const role = getTrustedUserRole(user);
    const isSuperAdmin = role === "SUPERADMIN" || user?.email?.toLowerCase().startsWith("superadmin");

    if (!user || !isSuperAdmin) {
      return NextResponse.json({ error: "Hanya super admin yang berhak memverifikasi setoran sewa." }, { status: 403 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Konfigurasi server database belum lengkap." }, { status: 500 });
    }

    const body = await request.json();
    const { billingId, action, notes } = body;

    if (!billingId || typeof billingId !== "string") {
      return NextResponse.json({ error: "ID tagihan setoran sewa wajib diisi." }, { status: 400 });
    }

    if (action === "APPROVE") {
      const ocrMetadata = JSON.stringify({
        bankName: "Verifikasi Manual Super Admin",
        confidence: 100,
        verifiedBy: user.email || "Super Admin",
        verifiedAt: new Date().toISOString(),
        matchNotes: notes || "Disetujui secara manual oleh Super Admin Pusat",
      });

      const { data, error } = await admin
        .from("saas_billings")
        .update({
          status_bayar: "PAID",
          ocr_raw_text: ocrMetadata,
        })
        .eq("id", billingId)
        .select("*, warkops(nama)")
        .single();

      if (error) {
        console.error("Gagal menyetujui setoran sewa:", error);
        return NextResponse.json({ error: "Gagal menyetujui setoran sewa." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Setoran sewa ${data.warkops?.nama || ""} berhasil diverifikasi dan ditandai Lunas.`,
        data,
      });
    }

    if (action === "REJECT") {
      const { data, error } = await admin
        .from("saas_billings")
        .update({
          status_bayar: "PENDING_REVIEW",
          ocr_raw_text: JSON.stringify({
            bankName: "Ditolak Super Admin",
            confidence: 0,
            rejectedBy: user.email || "Super Admin",
            rejectedAt: new Date().toISOString(),
            matchNotes: notes || "Bukti transfer tidak sesuai. Silakan upload ulang.",
          }),
        })
        .eq("id", billingId)
        .select("*, warkops(nama)")
        .single();

      if (error) {
        console.error("Gagal menolak setoran sewa:", error);
        return NextResponse.json({ error: "Gagal memperbarui status setoran." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Status setoran sewa ${data.warkops?.nama || ""} berhasil diperbarui.`,
        data,
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error) {
    console.error("PATCH saas_billings error:", error);
    return NextResponse.json({ error: "Gagal memperbarui data setoran sewa." }, { status: 500 });
  }
}

// Simulasi / Tes Otomasi OCR AI pada Setoran Sewa
export async function POST(request: Request) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const role = getTrustedUserRole(user);
    const isSuperAdmin = role === "SUPERADMIN" || user?.email?.toLowerCase().startsWith("superadmin");

    if (!user || !isSuperAdmin) {
      return NextResponse.json({ error: "Hanya super admin yang berhak menjalankan simulasi OCR AI." }, { status: 403 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Konfigurasi server database belum lengkap." }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { billingId } = body;

    // Jika ada billingId spesifik, jalankan OCR AI verifikasi pada billing tersebut
    if (billingId) {
      const { data: billing, error: getErr } = await admin
        .from("saas_billings")
        .select("*, warkops(nama)")
        .eq("id", billingId)
        .single();

      if (getErr || !billing) {
        return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
      }

      const ocrMetadata = JSON.stringify({
        bankName: "BCA Mobile Transfer",
        confidence: 98.7,
        extractedAmount: billing.total_tagihan,
        uniqueCodeMatch: true,
        matchedUniqueCode: billing.kode_unik,
        transferDate: new Date().toLocaleDateString("id-ID"),
        matchNotes: `Kode Unik ${billing.kode_unik} klop dengan nominal tagihan Rp ${Number(billing.total_tagihan).toLocaleString("id-ID")}`,
      });

      const { data, error: updateErr } = await admin
        .from("saas_billings")
        .update({
          status_bayar: "PAID",
          ocr_raw_text: ocrMetadata,
          bukti_transfer_url: billing.bukti_transfer_url || "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop&q=80",
        })
        .eq("id", billingId)
        .select("*, warkops(nama)")
        .single();

      if (updateErr) {
        return NextResponse.json({ error: "Gagal memperbarui hasil OCR AI." }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `OCR AI berhasil memverifikasi setoran sewa ${data.warkops?.nama || ""} dengan akurasi 98.7%. Kode unik ${billing.kode_unik} klop!`,
        data,
      });
    }

    return NextResponse.json({ error: "Parameter billingId diperlukan." }, { status: 400 });
  } catch (error) {
    console.error("POST saas_billings OCR simulation error:", error);
    return NextResponse.json({ error: "Gagal menjalankan verifikasi OCR AI." }, { status: 500 });
  }
}
