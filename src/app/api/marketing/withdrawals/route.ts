import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/device-auth";
import { createWhatsAppUrl, getSuperAdminWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from "@/lib/whatsapp";

async function marketingContext() {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user || String(user.app_metadata?.role).toUpperCase() !== "MARKETING") return { user: null, partner: null };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi database belum lengkap.");
  const admin = createAdminClient(url, key, { auth: { persistSession: false } });
  const { data: partner, error } = await admin.from("marketing_partners")
    .select("id,full_name,phone,referral_code,bank_name,bank_account_number,bank_account_name,status,commission_paid")
    .eq("user_id", user.id).maybeSingle();
  if (error || !partner) return { user, partner: null, admin };
  return { user, admin, partner };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await marketingContext();
    if (!ctx.user || !ctx.partner || !ctx.admin) {
      return NextResponse.json({ error: "Akun marketing tidak terhubung." }, { status: 401 });
    }
    if (ctx.partner.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Akun kemitraan Anda dinonaktifkan. Anda tidak dapat melakukan pencairan komisi." },
        { status: 403 }
      );
    }
    const amount = Number((await request.json()).amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 9_999_999_999) {
      return NextResponse.json({ error: "Nominal pencairan harus berupa Rupiah bulat dan lebih dari nol." }, { status: 400 });
    }

    // Verifikasi saldo tersedia dari sumber tunggal (marketing_commission_mutations)
    const [mutationsRes, pendingRes] = await Promise.all([
      ctx.admin
        .from("marketing_commission_mutations")
        .select("total_amount")
        .eq("partner_id", ctx.partner.id),
      ctx.admin
        .from("marketing_commission_withdrawals")
        .select("amount")
        .eq("marketing_partner_id", ctx.partner.id)
        .eq("status", "PENDING"),
    ]);

    const totalEarned = (mutationsRes.data || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const pendingAmount = (pendingRes.data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const paidAmount = Number(ctx.partner.commission_paid || 0);
    const availableBalance = Math.max(0, totalEarned - paidAmount - pendingAmount);

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: `Saldo komisi tidak mencukupi. Saldo tersedia: Rp ${availableBalance.toLocaleString("id-ID")}.` },
        { status: 400 }
      );
    }

    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);

    let withdrawalData: { id: string; amount: number; status: string; available_balance: number };
    const { data, error } = await ctx.admin.rpc("request_marketing_commission_withdrawal", {
      p_marketing_partner_id: ctx.partner.id,
      p_amount: amount,
    });

    if (error) {
      // Fallback jika RPC di database belum dimigrasikan ke sumber mutasi baru
      const { data: inserted, error: insertError } = await ctx.admin
        .from("marketing_commission_withdrawals")
        .insert({
          marketing_partner_id: ctx.partner.id,
          amount,
          bank_name: ctx.partner.bank_name,
          bank_account_number: ctx.partner.bank_account_number,
          bank_account_name: ctx.partner.bank_account_name,
          status: "PENDING",
        })
        .select("id, amount, status")
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message || "Pencairan komisi gagal disimpan." }, { status: 500 });
      }

      withdrawalData = {
        id: String(inserted.id),
        amount: Number(inserted.amount),
        status: String(inserted.status),
        available_balance: availableBalance - amount,
      };
    } else {
      withdrawalData = {
        id: String(data.id),
        amount: Number(data.amount),
        status: String(data.status),
        available_balance: Number(data.available_balance ?? availableBalance - amount),
      };
    }

    const requestId = withdrawalData.id;
    const remainingBalance = withdrawalData.available_balance;
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
    return NextResponse.json({ success: true, data: { ...withdrawalData, whatsappUrl } });
  } catch (error) {
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pencairan komisi gagal diproses." }, { status });
  }
}
