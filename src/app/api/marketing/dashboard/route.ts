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
    return NextResponse.json({ data: { profile: { name: partner.full_name, referralCode: partner.referral_code, area: partner.city_area, commissionRate: Number(partner.commission_rate), commissionPaid: Number(partner.commission_paid) }, tenants: mapped, totals: { tenants: mapped.length, receipts: mapped.reduce((sum, item) => sum + item.receipts, 0), commission: mapped.reduce((sum, item) => sum + item.commission, 0) } } });
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
    const baseSlug = String(body.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tenant";
    const suffix = Math.floor(Math.random() * 9000) + 1000;
    const slug = `${baseSlug}-${suffix}`;
    const username = `owner_${suffix}`;
    const password = `okesih${suffix}!`;
    const { data: lastRange } = await admin.from("warkops").select("unique_code_range_end").order("unique_code_range_end", { ascending: false }).limit(1).maybeSingle();
    const rangeStart = Math.max(100, Math.ceil((Number(lastRange?.unique_code_range_end || 99) + 1) / 100) * 100);
    const { data: tenant, error: tenantError } = await admin.from("warkops").insert({ nama: String(body.name).trim(), slug, owner_name: String(body.ownerName).trim(), owner_phone: phone, province: String(body.province).trim(), city_regency: String(body.cityRegency).trim(), unique_code_range_start: rangeStart, unique_code_range_end: rangeStart + 99, marketing_agent_id: partner.id, marketing_commission_per_receipt: Number(partner.commission_rate) || 0, is_active: true }).select().single();
    if (tenantError) throw tenantError;
    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email: `${username}@okesih.local`, password, email_confirm: true, app_metadata: { role: "OWNER", warkop_id: tenant.id }, user_metadata: { role: "OWNER", warkop_id: tenant.id, warkop_slug: slug } });
    if (authError || !authData.user) { await admin.from("warkops").delete().eq("id", tenant.id); throw authError || new Error("Akun owner gagal dibuat."); }
    const { error: memberError } = await admin.from("warkop_members").insert({ warkop_id: tenant.id, user_id: authData.user.id, username, role: "OWNER" });
    const { error: onboardingError } = memberError ? { error: null } : await admin.from("owner_onboarding").insert({ warkop_id: tenant.id, owner_user_id: authData.user.id });
    if (memberError || onboardingError) { await admin.auth.admin.deleteUser(authData.user.id); await admin.from("warkops").delete().eq("id", tenant.id); throw memberError || onboardingError; }
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://okesih.com").replace(/\/$/, "");
    const message = [`Halo ${String(body.ownerName).trim()}, tenant *${tenant.nama}* telah didaftarkan oleh ${partner.full_name} (${partner.referral_code}). 🎉`, "", `Username: *${username}*`, `Password: *${password}*`, `Login: ${appUrl}/login`, `Menu usaha: ${appUrl}/menu/${slug}`, "", "Silakan login, ganti password, lalu ikuti petunjuk instalasi aplikasi OKESIH."].join("\n");
    const { error: outboxError } = await admin.from("whatsapp_outbox").insert({ warkop_id: tenant.id, recipient_phone: phone, message });
    if (outboxError) { await admin.auth.admin.deleteUser(authData.user.id); await admin.from("warkops").delete().eq("id", tenant.id); throw new Error(`WhatsApp gagal diantrekan: ${outboxError.message}`); }
    await admin.from("marketing_partners").update({ total_tenants_acquired: Number(partner.total_tenants_acquired || 0) + 1 }).eq("id", partner.id);
    return NextResponse.json({ success: true, data: { name: tenant.nama, username, password, whatsappQueued: true } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tenant gagal didaftarkan." }, { status: 500 });
  }
}
