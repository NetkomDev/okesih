import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

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
      .select("id,nama,slug,owner_name,owner_phone,province,city_regency,is_active,marketing_commission_per_receipt,created_at")
      .eq("marketing_agent_id", partner.id).order("created_at", { ascending: false });
    if (error) throw error;
    const { data: applications, error: applicationError } = await admin.from("tenant_applications")
      .select("id,business_name,owner_name,owner_phone,province,city_regency,status,review_notes,created_at,warkop_id")
      .eq("marketing_partner_id", partner.id).order("created_at", { ascending: false });
    if (applicationError) throw applicationError;
    const ids = (tenants || []).map((item) => item.id);
    let transactions: Array<{ warkop_id: string }> = [];
    if (ids.length) {
      const result = await admin.from("transactions").select("warkop_id").in("warkop_id", ids).neq("status_pesanan", "VOID").neq("status_pesanan", "REJECTED");
      if (result.error) throw result.error;
      transactions = result.data || [];
    }
    const receiptCount = new Map<string, number>();
    transactions.forEach((row) => receiptCount.set(row.warkop_id, (receiptCount.get(row.warkop_id) || 0) + 1));
    const mapped = (tenants || []).map((tenant) => ({
      id: tenant.id, name: tenant.nama, slug: tenant.slug, ownerName: tenant.owner_name,
      phone: tenant.owner_phone, province: tenant.province, cityRegency: tenant.city_regency,
      status: tenant.is_active ? "ACTIVE" : "SUSPENDED", joinedAt: tenant.created_at,
      receipts: receiptCount.get(tenant.id) || 0,
      commission: (receiptCount.get(tenant.id) || 0) * Number(tenant.marketing_commission_per_receipt || 0),
    }));
    return NextResponse.json({ data: { profile: { name: partner.full_name, referralCode: partner.referral_code, area: partner.city_area, commissionRate: Number(partner.commission_rate), commissionPaid: Number(partner.commission_paid) }, applications: applications || [], tenants: mapped, totals: { tenants: mapped.length, pending: (applications || []).filter((item) => item.status === "PENDING" || item.status === "PROCESSING").length, receipts: mapped.reduce((sum, item) => sum + item.receipts, 0), commission: mapped.reduce((sum, item) => sum + item.commission, 0) } } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gagal memuat dashboard." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await context();
    if (!ctx) return NextResponse.json({ error: "Akun marketing tidak aktif atau tidak terhubung." }, { status: 401 });
    const { admin, partner } = ctx;
    const body = await request.json();
    if (!body.name || !body.ownerName || !body.phone || !body.province || !body.cityRegency) return NextResponse.json({ error: "Semua data usaha, owner, WhatsApp, dan wilayah wajib diisi." }, { status: 400 });
    const phone = normalizePhone(body.phone);
    if (!/^628\d{8,11}$/.test(phone)) return NextResponse.json({ error: "Nomor WhatsApp owner tidak valid." }, { status: 400 });
    const { data: application, error: applicationError } = await admin.from("tenant_applications").insert({
      marketing_partner_id: partner.id, business_name: String(body.name).trim(), owner_name: String(body.ownerName).trim(),
      owner_phone: phone, province: String(body.province).trim(), city_regency: String(body.cityRegency).trim(), status: "PENDING",
    }).select().single();
    if (applicationError) throw applicationError;
    const adminPhone = normalizePhone(process.env.SUPERADMIN_WHATSAPP_NUMBER || "6285694488510");
    const message = ["*PENGAJUAN TENANT BARU OKESIH*", "", `Marketing: *${partner.full_name}* (${partner.referral_code})`, `Usaha: *${application.business_name}*`, `Owner: ${application.owner_name}`, `WhatsApp Owner: +${phone}`, `Wilayah: ${application.city_regency}, ${application.province}`, "", "Silakan review dan verifikasi melalui Dashboard Super Admin → Daftar Tenant."].join("\n");
    const { error: outboxError } = await admin.from("whatsapp_outbox").insert({ recipient_phone: adminPhone, message });
    if (outboxError) { await admin.from("tenant_applications").delete().eq("id", application.id); throw new Error(`Notifikasi Super Admin gagal diantrekan: ${outboxError.message}`); }
    return NextResponse.json({ success: true, data: { id: application.id, name: application.business_name, status: "PENDING", whatsappQueued: true } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tenant gagal didaftarkan." }, { status: 500 });
  }
}
