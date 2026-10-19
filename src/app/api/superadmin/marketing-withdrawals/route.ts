import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/device-auth";

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
    const { data, error } = await ctx.admin.from("marketing_commission_withdrawals")
      .select("id,amount,status,bank_name,bank_account_number,bank_account_name,notes,created_at,reviewed_at,marketing_partners(full_name,phone,referral_code)")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pengajuan pencairan gagal dimuat." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await superAdminContext();
    if (!ctx) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });
    const body = await request.json();
    const id = String(body.id || "");
    const decision = String(body.decision || "").toUpperCase();
    if (!id || !["PAID", "REJECTED"].includes(decision)) {
      return NextResponse.json({ error: "ID dan keputusan pencairan wajib diisi." }, { status: 400 });
    }

    // Periksa status penerima sebelum menyetujui pembayaran
    if (decision === "PAID") {
      const { data: withdrawal, error: wError } = await ctx.admin
        .from("marketing_commission_withdrawals")
        .select("id, status, marketing_partner_id")
        .eq("id", id)
        .maybeSingle();

      if (wError || !withdrawal) {
        return NextResponse.json({ error: "Pengajuan pencairan tidak ditemukan." }, { status: 404 });
      }

      if (withdrawal.marketing_partner_id) {
        const { data: partner, error: pError } = await ctx.admin
          .from("marketing_partners")
          .select("id, full_name, status")
          .eq("id", withdrawal.marketing_partner_id)
          .maybeSingle();

        if (pError || !partner || partner.status !== "ACTIVE") {
          return NextResponse.json(
            { error: `Pencairan tidak dapat disetujui karena akun mitra ${partner?.full_name || ""} berstatus nonaktif/ditangguhkan.` },
            { status: 400 }
          );
        }
      }
    }

    const { data, error } = await ctx.admin.rpc("review_marketing_commission_withdrawal", {
      p_withdrawal_id: id,
      p_decision: decision,
      p_admin_id: ctx.user.id,
      p_notes: String(body.notes || ""),
    });
    if (error) {
      const status = error.code === "P0001" ? 409 : error.code === "P0002" ? 404 : error.code === "22023" ? 400 : 500;
      return NextResponse.json({ error: error.message || "Pengajuan pencairan gagal diproses." }, { status });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pengajuan pencairan gagal diproses." }, { status });
  }
}
