import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/device-auth";
import { APP_ORIGINS } from "@/lib/app-origins";
import { cleanWhatsAppMessageField, createWhatsAppUrl, isValidIndonesianWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from "@/lib/whatsapp";

async function superAdminContext() {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user || String(user.app_metadata?.role).toUpperCase() !== "SUPERADMIN") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi database belum lengkap.");
  return { user, admin: createAdminClient(url, key, { auth: { persistSession: false } }) };
}

export async function GET() {
  try {
    const ctx = await superAdminContext();
    if (!ctx) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });
    const { data, error } = await ctx.admin.from("tenant_applications")
      .select("id,business_name,owner_name,owner_phone,address,province,city_regency,status,review_notes,created_at,marketing_partners(full_name,phone,city_area,referral_code,commission_rate)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pengajuan gagal dimuat." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let applicationId = "";
  let claimed = false;
  let createdTenantId: string | null = null;
  let createdUserId: string | null = null;
  let completed = false;
  let preparedAccess: { tenantId: string; name: string; username: string; whatsappUrl: string } | null = null;
  try {
    assertSameOrigin(request);
    const ctx = await superAdminContext();
    if (!ctx) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });
    const body = await request.json();
    applicationId = String(body.id || "");
    const decision = String(body.decision || "").toUpperCase();
    if (!applicationId || !["APPROVE", "REJECT"].includes(decision)) return NextResponse.json({ error: "ID dan keputusan review wajib diisi." }, { status: 400 });

    const { admin, user } = ctx;
    if (decision === "REJECT") {
      const { data, error } = await admin.from("tenant_applications").update({ status: "REJECTED", review_notes: String(body.notes || "Pengajuan belum dapat disetujui."), reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("id", applicationId).eq("status", "PENDING").select().maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Pengajuan sudah diproses sebelumnya." }, { status: 409 });
      return NextResponse.json({ success: true, data });
    }

    const { data: application, error: claimError } = await admin.from("tenant_applications")
      .update({ status: "PROCESSING", reviewed_by: user.id }).eq("id", applicationId).eq("status", "PENDING")
      .select("*,marketing_partners(full_name,referral_code,commission_rate,total_tenants_acquired)").maybeSingle();
    if (claimError) throw claimError;
    if (!application) return NextResponse.json({ error: "Pengajuan sudah diproses sebelumnya." }, { status: 409 });
    claimed = true;
    const ownerPhone = normalizeIndonesianWhatsAppNumber(application.owner_phone);
    if (!isValidIndonesianWhatsAppNumber(ownerPhone)) throw new Error("Perbaiki nomor WhatsApp owner sebelum memverifikasi pengajuan.");

    const marketing = Array.isArray(application.marketing_partners) ? application.marketing_partners[0] : application.marketing_partners;
    const suffix = `${Date.now()}`.slice(-6);
    const baseSlug = application.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "tenant";
    const slug = `${baseSlug}-${suffix}`;
    const username = `owner_${suffix}`;
    const password = randomBytes(18).toString("base64url");
    const { data: lastRange } = await admin.from("warkops").select("unique_code_range_end").order("unique_code_range_end", { ascending: false }).limit(1).maybeSingle();
    const rangeStart = Math.max(100, Math.ceil((Number(lastRange?.unique_code_range_end || 99) + 1) / 100) * 100);
    if (application.marketing_partner_id) {
      try {
        const { data: partnerRow } = await admin
          .from("marketing_partners")
          .select("id, full_name, phone, city_area, referral_code, commission_rate, status, bank_name, bank_account_number, bank_account_name")
          .eq("id", application.marketing_partner_id)
          .maybeSingle();

        if (partnerRow) {
          await admin.from("marketing_agents").upsert({
            id: partnerRow.id,
            nama: partnerRow.full_name,
            phone: partnerRow.phone,
            area: partnerRow.city_area || "Umum",
            referral_code: partnerRow.referral_code,
            commission_per_receipt: Number(partnerRow.commission_rate) || 15,
            bank_name: partnerRow.bank_name,
            bank_account_number: partnerRow.bank_account_number,
            bank_account_name: partnerRow.bank_account_name,
            is_active: partnerRow.status === "ACTIVE",
          });
        }
      } catch (syncErr) {
        console.warn("Peringatan sinkronisasi marketing_agents:", syncErr);
      }
    }

    const { data: tenant, error: tenantError } = await admin.from("warkops").insert({
      nama: application.business_name, slug, owner_name: application.owner_name, owner_phone: ownerPhone,
      address: application.address, province: application.province, city_regency: application.city_regency, unique_code_range_start: rangeStart,
      unique_code_range_end: rangeStart + 99, marketing_agent_id: application.marketing_partner_id,
      marketing_commission_per_receipt: Number(marketing?.commission_rate || 0), is_active: true,
    }).select().single();
    if (tenantError) throw tenantError;
    createdTenantId = tenant.id;

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: `${username}@okesih.local`, password, email_confirm: true,
      app_metadata: { role: "OWNER", warkop_id: tenant.id },
      user_metadata: { role: "OWNER", warkop_id: tenant.id, warkop_slug: slug },
    });
    if (authError || !authData.user) throw authError || new Error("Akun owner gagal dibuat.");
    createdUserId = authData.user.id;
    const { error: memberError } = await admin.from("warkop_members").insert({ warkop_id: tenant.id, user_id: authData.user.id, username, role: "OWNER" });
    const { error: onboardingError } = memberError ? { error: null } : await admin.from("owner_onboarding").insert({ warkop_id: tenant.id, owner_user_id: authData.user.id });
    if (memberError || onboardingError) throw memberError || onboardingError;

    const message = [
      `Halo ${cleanWhatsAppMessageField(application.owner_name)}, pengajuan *${cleanWhatsAppMessageField(tenant.nama)}* telah diverifikasi dan diaktifkan oleh OKESIH. 🎉`,
      "",
      "*KREDENSIAL OWNER*",
      `Username: *${username}*`,
      `Password sementara: *${password}*`,
      `Login: ${APP_ORIGINS.PUBLIC}/login`,
      `Menu usaha: ${APP_ORIGINS.PUBLIC}/menu/${slug}`,
      "",
      "Silakan login, ganti password sementara, lalu ikuti petunjuk instalasi aplikasi OKESIH Owner.",
    ].join("\n");
    const whatsappUrl = createWhatsAppUrl(ownerPhone, message);
    preparedAccess = { tenantId: tenant.id, name: tenant.nama, username, whatsappUrl };

    const { data: approved, error: approvalError } = await admin.from("tenant_applications").update({ status: "APPROVED", warkop_id: tenant.id, owner_phone: ownerPhone, review_notes: String(body.notes || "Terverifikasi"), reviewed_at: new Date().toISOString() }).eq("id", applicationId).eq("status", "PROCESSING").select("id").maybeSingle();
    if (approvalError || !approved) throw approvalError || new Error("Status verifikasi gagal disimpan.");
    completed = true;
    if (application.marketing_partner_id) {
      try {
        const { error: counterError } = await admin.from("marketing_partners").update({ total_tenants_acquired: Number(marketing?.total_tenants_acquired || 0) + 1 }).eq("id", application.marketing_partner_id);
        if (counterError) console.error("Gagal memperbarui jumlah tenant marketing:", counterError);
      } catch { console.error("Koneksi pembaruan jumlah tenant marketing gagal."); }
    }
    return NextResponse.json({ success: true, data: { tenantId: tenant.id, name: tenant.nama, username, whatsappUrl } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (claimed && !completed) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        const cleanup = createAdminClient(url, key);
        const { data: persisted, error: statusError } = await cleanup.from("tenant_applications").select("status,warkop_id").eq("id", applicationId).maybeSingle();
        if (statusError || !persisted) return NextResponse.json({ error: "Status verifikasi belum dapat dipastikan. Muat ulang; jangan membuat akun baru sebelum status diperiksa." }, { status: 503 });
        if (persisted.status === "APPROVED" && persisted.warkop_id === createdTenantId && preparedAccess) return NextResponse.json({ success: true, data: preparedAccess }, { headers: { "Cache-Control": "private, no-store" } });
        if (persisted.status !== "PROCESSING") return NextResponse.json({ error: "Status pengajuan telah berubah. Muat ulang untuk memeriksa hasil verifikasi." }, { status: 409 });
        const authCleanup = createdUserId ? await cleanup.auth.admin.deleteUser(createdUserId) : { error: null };
        const tenantCleanup = !authCleanup.error && createdTenantId ? await cleanup.from("warkops").delete().eq("id", createdTenantId) : { error: authCleanup.error };
        if (!authCleanup.error && !tenantCleanup.error) {
          await cleanup.from("tenant_applications").update({ status: "PENDING" }).eq("id", applicationId).eq("status", "PROCESSING");
        } else {
          return NextResponse.json({ error: "Pembuatan akun belum selesai dan pembersihan gagal. Pengajuan tetap PROCESSING agar tidak membuat akun ganda. Periksa akun dan tenant sebelum mengulang verifikasi." }, { status: 500 });
        }
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pengajuan gagal diproses." }, { status: 500 });
  }
}
