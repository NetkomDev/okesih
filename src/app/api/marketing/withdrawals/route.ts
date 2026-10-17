import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/device-auth";
import { createWhatsAppUrl, getSuperAdminWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from "@/lib/whatsapp";

async function marketingContext() {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user || String(user.app_metadata?.role).toUpperCase() !== "MARKETING") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi database belum lengkap.");
  const admin = createAdminClient(url, key, { auth: { persistSession: false } });
  const { data: partner, error } = await admin.from("marketing_partners")
    .select("id,full_name,phone,referral_code,bank_name,bank_account_number,bank_account_name,status")
    .eq("user_id", user.id).eq("status", "ACTIVE").single();
  if (error || !partner) return null;
  return { admin, partner };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await marketingContext();
    if (!ctx) return NextResponse.json({ error: "Akun marketing tidak aktif atau tidak terhubung." }, { status: 401 });
    const amount = Number((await request.json()).amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 9_999_999_999) {
      return NextResponse.json({ error: "Nominal pencairan harus berupa Rupiah bulat dan lebih dari nol." }, { status: 400 });
    }

    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);

    const { data, error } = await ctx.admin.rpc("request_marketing_commission_withdrawal", {
      p_marketing_partner_id: ctx.partner.id,
      p_amount: amount,
    });
    if (error) {
      const status = error.code === "P0001" ? 409 : error.code === "22023" ? 400 : 500;
      return NextResponse.json({ error: error.message || "Pencairan komisi gagal disimpan." }, { status });
    }

    const requestId = String(data.id);
    const remainingBalance = Number(data.available_balance || 0);
    const marketingPhone = normalizeIndonesianWhatsAppNumber(ctx.partner.phone);
    const message = [
      "*PENGAJUAN PENCAIRAN KOMISI OKESIH*", "",
      `Marketing: *${ctx.partner.full_name}*`,
      `Kode Referral: ${ctx.partner.referral_code}`,
      `WhatsApp Marketing: +${marketingPhone}`, "",
      `Nominal: *Rp ${amount.toLocaleString("id-ID")}*`,
      `Rekening: ${ctx.partner.bank_name} · ${ctx.partner.bank_account_number}`,
      `Atas Nama: ${ctx.partner.bank_account_name}`,
      `Sisa Saldo Tersedia: Rp ${remainingBalance.toLocaleString("id-ID")}`,
      `ID Pengajuan: ${requestId}`, "",
      "Pengajuan sudah tersimpan. Mohon verifikasi dan transfer melalui Dashboard Super Admin.",
    ].join("\n");
    const whatsappUrl = createWhatsAppUrl(adminPhone, message);
    return NextResponse.json({ success: true, data: { ...data, whatsappUrl } });
  } catch (error) {
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pencairan komisi gagal diproses." }, { status });
  }
}
