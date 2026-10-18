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
    const { data: report, error } = await admin.rpc("report_marketing_dashboard", { p_partner_id: partner.id });
    if (error) throw error;
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
        ...report,
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
