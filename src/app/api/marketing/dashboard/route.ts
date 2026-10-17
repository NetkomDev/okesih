import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/device-auth";
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
  const { data: partner } = await admin.from("marketing_partners").select("*").eq("user_id", user.id).eq("status", "ACTIVE").single();
  return partner ? { admin, partner } : null;
}

export async function GET() {
  try {
    const ctx = await context();
    if (!ctx) return NextResponse.json({ error: "Akun marketing tidak aktif atau tidak terhubung." }, { status: 401 });
    const { admin, partner } = ctx;
    const { data: tenants, error } = await admin.from("warkops")
      .select("id,nama,slug,owner_name,owner_phone,address,province,city_regency,is_active,marketing_commission_per_receipt,created_at")
      .eq("marketing_agent_id", partner.id).order("created_at", { ascending: false });
    if (error) throw error;
    const { data: applications, error: applicationError } = await admin.from("tenant_applications")
      .select("id,business_name,owner_name,owner_phone,address,province,city_regency,status,review_notes,created_at,warkop_id")
      .eq("marketing_partner_id", partner.id).order("created_at", { ascending: false });
    if (applicationError) throw applicationError;
    const { data: withdrawals, error: withdrawalError } = await admin.from("marketing_commission_withdrawals")
      .select("id,amount,status,bank_name,bank_account_number,bank_account_name,notes,reviewed_at,created_at")
      .eq("marketing_partner_id", partner.id).order("created_at", { ascending: false }).limit(25);
    if (withdrawalError) throw withdrawalError;
    const ids = (tenants || []).map((item) => item.id);
    let transactions: Array<{ warkop_id: string }> = [];
    let billings: Array<{ warkop_id: string; status_bayar: string; tagihan_pokok: number }> = [];
    if (ids.length) {
      const [trxResult, billingResult] = await Promise.all([
        admin.from("transactions").select("warkop_id").in("warkop_id", ids).neq("status_pesanan", "VOID").neq("status_pesanan", "REJECTED"),
        admin.from("saas_billings").select("warkop_id, status_bayar, tagihan_pokok").in("warkop_id", ids).order("created_at", { ascending: false }),
      ]);
      if (trxResult.error) throw trxResult.error;
      transactions = trxResult.data || [];
      billings = billingResult.data || [];
    }
    const receiptCount = new Map<string, number>();
    transactions.forEach((row) => receiptCount.set(row.warkop_id, (receiptCount.get(row.warkop_id) || 0) + 1));
    const billingMap = new Map<string, { status: "PAID" | "UNPAID"; amount: number }>();
    billings.forEach((b) => {
      if (!billingMap.has(b.warkop_id)) {
        billingMap.set(b.warkop_id, {
          status: b.status_bayar === "PAID" ? "PAID" : "UNPAID",
          amount: Number(b.tagihan_pokok) || 0,
        });
      } else if (b.status_bayar === "UNPAID") {
        // Jika ada salah satu tagihan yang belum bayar, tandai UNPAID
        billingMap.set(b.warkop_id, {
          status: "UNPAID",
          amount: (billingMap.get(b.warkop_id)?.amount || 0) + (Number(b.tagihan_pokok) || 0),
        });
      }
    });

    const mapped = (tenants || []).map((tenant) => {
      const bInfo = billingMap.get(tenant.id);
      return {
        id: tenant.id,
        name: tenant.nama,
        slug: tenant.slug,
        ownerName: tenant.owner_name,
        phone: tenant.owner_phone,
        address: tenant.address,
        province: tenant.province,
        cityRegency: tenant.city_regency,
        status: tenant.is_active ? "ACTIVE" : "SUSPENDED",
        paymentStatus: bInfo?.status || "PAID",
        unpaidAmount: bInfo?.amount || 0,
        commissionPerReceipt: Number(tenant.marketing_commission_per_receipt || 0),
        joinedAt: tenant.created_at,
        receipts: receiptCount.get(tenant.id) || 0,
        commission: (receiptCount.get(tenant.id) || 0) * Number(tenant.marketing_commission_per_receipt || 0),
      };
    });
    const commission = mapped.reduce((sum, item) => sum + item.commission, 0);
    const pendingWithdrawal = (withdrawals || []).filter((item) => item.status === "PENDING").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const availableCommission = Math.max(0, commission - Number(partner.commission_paid || 0) - pendingWithdrawal);
    return NextResponse.json({
      data: {
        profile: {
          name: partner.full_name,
          phone: partner.phone,
          referralCode: partner.referral_code,
          area: partner.city_area,
          commissionRate: Number(partner.commission_rate),
          commissionPaid: Number(partner.commission_paid),
          bankName: partner.bank_name,
          bankAccountNumber: partner.bank_account_number,
          bankAccountName: partner.bank_account_name,
        },
        applications: applications || [],
        withdrawals: withdrawals || [],
        tenants: mapped,
        totals: {
          tenants: mapped.length,
          pending: (applications || []).filter((item) => item.status === "PENDING" || item.status === "PROCESSING").length,
          unpaidTenants: mapped.filter((item) => item.paymentStatus === "UNPAID").length,
          paidTenants: mapped.filter((item) => item.paymentStatus === "PAID").length,
          receipts: mapped.reduce((sum, item) => sum + item.receipts, 0),
          commission,
          pendingWithdrawal,
          availableCommission,
        },
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat dashboard." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await context();
    if (!ctx) return NextResponse.json({ error: "Akun marketing tidak aktif atau tidak terhubung." }, { status: 401 });
    const { admin, partner } = ctx;
    const body = await request.json();
    if (!body.name || !body.ownerName || !body.phone || !body.address || !body.province || !body.cityRegency) return NextResponse.json({ error: "Semua data usaha, owner, WhatsApp, alamat, dan wilayah wajib diisi." }, { status: 400 });
    const phone = normalizeIndonesianWhatsAppNumber(body.phone);
    if (!isValidIndonesianWhatsAppNumber(phone)) return NextResponse.json({ error: "Nomor WhatsApp owner tidak valid." }, { status: 400 });
    const { data: application, error: applicationError } = await admin.from("tenant_applications").insert({
      marketing_partner_id: partner.id, business_name: String(body.name).trim(), owner_name: String(body.ownerName).trim(),
      owner_phone: phone, address: String(body.address).trim(), province: String(body.province).trim(), city_regency: String(body.cityRegency).trim(), status: "PENDING",
    }).select().single();
    if (applicationError) throw applicationError;
    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);
    const marketingPhone = normalizeIndonesianWhatsAppNumber(partner.phone);
    const message = ["*PENGAJUAN TENANT BARU OKESIH*", "", `Marketing: *${cleanWhatsAppMessageField(partner.full_name)}*`, `Kode Referral: ${cleanWhatsAppMessageField(partner.referral_code)}`, `WhatsApp Marketing: +${marketingPhone}`, "", `Usaha: *${cleanWhatsAppMessageField(application.business_name)}*`, `Owner: ${cleanWhatsAppMessageField(application.owner_name)}`, `WhatsApp Owner: +${phone}`, `Alamat: ${cleanWhatsAppMessageField(application.address)}`, `Wilayah: ${cleanWhatsAppMessageField(application.city_regency)}, ${cleanWhatsAppMessageField(application.province)}`, "", "Pengajuan sudah tersimpan. Silakan review melalui Dashboard Super Admin → Daftar Tenant."].join("\n");
    const whatsappUrl = createWhatsAppUrl(adminPhone, message);
    return NextResponse.json({ success: true, data: { id: application.id, name: application.business_name, status: "PENDING", whatsappUrl, marketingPhone } });
  } catch (error) {
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tenant gagal didaftarkan." }, { status });
  }
}
