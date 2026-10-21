import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/device-auth";
import { toMembershipLevel } from "@/lib/affiliate";
import {
  cleanWhatsAppMessageField,
  createWhatsAppUrl,
  getSuperAdminWhatsAppNumber,
  isValidIndonesianWhatsAppNumber,
  normalizeIndonesianWhatsAppNumber,
} from "@/lib/whatsapp";

async function context() {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user || String(user.app_metadata?.role).toUpperCase() !== "MARKETING") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi database belum lengkap.");
  const admin = createAdminClient(url, key, { auth: { persistSession: false } });
  const { data: partner, error: partnerError } = await admin
    .from("marketing_partners")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (partnerError) throw partnerError;
  return partner ? { admin, partner } : null;
}

export async function GET() {
  try {
    const ctx = await context();
    if (!ctx) {
      return NextResponse.json({ error: "Akun marketing tidak terhubung." }, { status: 401 });
    }
    const { admin, partner } = ctx;

    // Ambil parameter global dengan aman
    const { data: settingsRow } = await admin
      .from("platform_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    const marketingRate = Number(settingsRow?.default_marketing_commission ?? 10);
    const coordinatorRate = Number(settingsRow?.coordinator_commission_per_receipt ?? 5);

    const membershipLevel = toMembershipLevel(
      partner.membership_level || (typeof partner.notes_admin === "string" && partner.notes_admin.includes("[LEVEL:COORDINATOR]") ? "COORDINATOR" : "MARKETING")
    );

    const isSuspended = partner.status !== "ACTIVE";

    // Panggil RPC report_marketing_dashboard untuk data agregasi dasar
    const { data: reportData, error: reportError } = await admin.rpc("report_marketing_dashboard", { p_partner_id: partner.id });
    if (reportError || !reportData) throw reportError || new Error("Laporan tidak tersedia.");
    const report = reportData as Record<string, unknown>;
    let commissionEntries: Array<{
      id: string;
      kind: "DIRECT" | "NETWORK";
      amount: number;
      receipts: number;
      rate: number;
      tenantName: string | null;
      sourcePartnerName: string | null;
      billingId: string | null;
      createdAt: string;
    }> = [];

    try {
      // Ambil 50 entri mutasi terbaru untuk tampilan riwayat di UI
      const { data: mutations } = await admin
        .from("marketing_commission_mutations")
        .select(`
          id,
          kind,
          total_amount,
          receipts_count,
          rate_per_receipt,
          notes,
          billing_id,
          created_at,
          warkops:warkop_id(nama),
          source_partner:source_partner_id(full_name)
        `)
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (mutations && Array.isArray(mutations)) {
        commissionEntries = mutations.map((m: Record<string, unknown>) => {
          const warkop = m.warkops as { nama?: string } | null;
          const sourcePartner = m.source_partner as { full_name?: string } | null;
          const amt = Number(m.total_amount) || 0;
          return {
            id: String(m.id),
            kind: m.kind === "NETWORK" ? "NETWORK" : "DIRECT",
            amount: amt,
            receipts: Number(m.receipts_count) || 0,
            rate: Number(m.rate_per_receipt) || 0,
            tenantName: warkop?.nama || null,
            sourcePartnerName: sourcePartner?.full_name || null,
            billingId: m.billing_id ? String(m.billing_id) : null,
            createdAt: String(m.created_at),
          };
        });
      }
    } catch {
      // Tabel mutasi belum tersedia di schema cache, lewati
    }

    const rawTotals = (report.totals as Record<string, unknown>) || {};
    const commissionPaid = Number(partner.commission_paid || 0);

    const pendingWithdrawals = Number(rawTotals.pendingWithdrawal || 0);
    const totalEarnedCommission = Number(rawTotals.commission || 0);
    const totalAvailable = Number(rawTotals.availableCommission || 0);

    // ATURAN BISNIS: Jika mitra atau koordinator dinonaktifkan (status !== 'ACTIVE'):
    // 1. Seluruh saldo di-zero-kan dan flag saldoDisembunyikan aktif.
    // 2. Seluruh rincian pendapatan/komisi pada daftar tenant dibersihkan agar tidak bocor via respons API.
    const totals = isSuspended
      ? {
          tenants: Number(rawTotals.tenants || 0),
          pending: Number(rawTotals.pending || 0),
          unpaidTenants: Number(rawTotals.unpaidTenants || 0),
          paidTenants: Number(rawTotals.paidTenants || 0),
          receipts: Number(rawTotals.receipts || 0),
          commission: 0,
          pendingWithdrawal: 0,
          availableCommission: 0,
          saldoDisembunyikan: true,
        }
      : {
          tenants: Number(rawTotals.tenants || 0),
          pending: Number(rawTotals.pending || 0),
          unpaidTenants: Number(rawTotals.unpaidTenants || 0),
          paidTenants: Number(rawTotals.paidTenants || 0),
          receipts: Number(rawTotals.receipts || 0),
          commission: totalEarnedCommission,
          pendingWithdrawal: pendingWithdrawals,
          availableCommission: totalAvailable,
          saldoDisembunyikan: false,
        };

    // Sanitasi data tenant agar akun suspended tidak melihat angka komisi per tenant
    const sanitizedTenants = ((report.tenants as Array<Record<string, unknown>>) || []).map((t) => {
      if (!isSuspended) return t;
      return {
        ...t,
        commission: 0,
        commissionPerReceipt: 0,
        receipts: 0,
        unpaidAmount: 0,
      };
    });

    return NextResponse.json({
      data: {
        profile: {
          membershipLevel,
          coordinatorCommissionRate: coordinatorRate,
          name: partner.full_name,
          phone: partner.phone,
          username: partner.username || "",
          referralCode: partner.referral_code,
          area: partner.city_area,
          commissionRate: marketingRate,
          commissionPaid: isSuspended ? 0 : commissionPaid,
          bankName: partner.bank_name,
          bankAccountNumber: partner.bank_account_number,
          bankAccountName: partner.bank_account_name,
          status: partner.status,
          isSuspended,
          saldoDisembunyikan: isSuspended,
        },
        tenants: sanitizedTenants,
        applications: report.applications || [],
        withdrawals: isSuspended ? [] : (report.withdrawals || []),
        commissionEntries: isSuspended ? [] : commissionEntries,
        totals,
      },
    });
  } catch (error) {
    console.error("GET /api/marketing/dashboard error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat dashboard." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await context();
    if (!ctx) {
      return NextResponse.json({ error: "Akun marketing tidak terhubung." }, { status: 401 });
    }
    const { admin, partner } = ctx;

    if (partner.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Akun kemitraan Anda dinonaktifkan. Pengajuan tenant baru tidak dapat dilakukan." },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (!body.name || !body.ownerName || !body.phone || !body.address || !body.province || !body.cityRegency) {
      return NextResponse.json({ error: "Semua data usaha, owner, WhatsApp, alamat, dan wilayah wajib diisi." }, { status: 400 });
    }
    const phone = normalizeIndonesianWhatsAppNumber(body.phone);
    if (!isValidIndonesianWhatsAppNumber(phone)) {
      return NextResponse.json({ error: "Nomor WhatsApp owner tidak valid." }, { status: 400 });
    }

    const { data: application, error: applicationError } = await admin
      .from("tenant_applications")
      .insert({
        marketing_partner_id: partner.id,
        business_name: String(body.name).trim(),
        owner_name: String(body.ownerName).trim(),
        owner_phone: phone,
        address: String(body.address).trim(),
        province: String(body.province).trim(),
        city_regency: String(body.cityRegency).trim(),
        status: "PENDING",
      })
      .select()
      .single();

    if (applicationError) throw applicationError;

    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);
    const marketingPhone = normalizeIndonesianWhatsAppNumber(partner.phone);
    const message = [
      "*PENGAJUAN TENANT BARU OKESIH*",
      "",
      `Marketing: *${cleanWhatsAppMessageField(partner.full_name)}*`,
      `Kode Referral: ${cleanWhatsAppMessageField(partner.referral_code)}`,
      `WhatsApp Marketing: +${marketingPhone}`,
      "",
      `Usaha: *${cleanWhatsAppMessageField(application.business_name)}*`,
      `Owner: ${cleanWhatsAppMessageField(application.owner_name)}`,
      `WhatsApp Owner: +${phone}`,
      `Alamat: ${cleanWhatsAppMessageField(application.address)}`,
      `Wilayah: ${cleanWhatsAppMessageField(application.city_regency)}, ${cleanWhatsAppMessageField(application.province)}`,
      "",
      "Pengajuan sudah tersimpan. Silakan review melalui Dashboard Super Admin → Daftar Tenant.",
    ].join("\n");
    const whatsappUrl = createWhatsAppUrl(adminPhone, message);

    return NextResponse.json({
      success: true,
      data: {
        id: application.id,
        name: application.business_name,
        status: "PENDING",
        whatsappUrl,
        marketingPhone,
      },
    });
  } catch (error) {
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tenant gagal didaftarkan." }, { status });
  }
}
