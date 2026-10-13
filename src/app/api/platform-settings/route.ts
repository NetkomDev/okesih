import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DEFAULT_SETTINGS = {
  queueDismissSeconds: 60,
  saasFeePerReceipt: 50,
  defaultMarketingCommission: 15,
  updatedAt: null as string | null,
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function toResponse(row: Record<string, unknown> | null) {
  if (!row) return DEFAULT_SETTINGS;
  return {
    queueDismissSeconds: Number(row.global_queue_dismiss_seconds),
    saasFeePerReceipt: Number(row.saas_fee_per_receipt),
    defaultMarketingCommission: Number(row.default_marketing_commission),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function GET() {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Konfigurasi database server belum lengkap." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("platform_settings")
    .select("global_queue_dismiss_seconds, saas_fee_per_receipt, default_marketing_commission, updated_at")
    .eq("id", "global")
    .maybeSingle();

  if (error) {
    console.error("Gagal membaca platform settings:", error);
    return NextResponse.json({ error: "Konfigurasi platform belum dapat dibaca." }, { status: 500 });
  }

  return NextResponse.json({ data: toResponse(data) });
}

export async function PATCH(request: Request) {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  const role = String(user?.user_metadata?.role || "").toUpperCase();
  const isSuperAdmin = role === "SUPERADMIN" || user?.email?.toLowerCase().startsWith("superadmin");

  if (!user || !isSuperAdmin) {
    return NextResponse.json({ error: "Hanya super admin yang dapat mengubah parameter global." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const queueDismissSeconds = Number(body.queueDismissSeconds);
  const saasFeePerReceipt = Number(body.saasFeePerReceipt);
  const defaultMarketingCommission = Number(body.defaultMarketingCommission);

  if (!Number.isInteger(queueDismissSeconds) || queueDismissSeconds < 10 || queueDismissSeconds > 600) {
    return NextResponse.json({ error: "Durasi antrean harus antara 10–600 detik." }, { status: 400 });
  }
  if (!Number.isInteger(saasFeePerReceipt) || saasFeePerReceipt < 0 || saasFeePerReceipt > 100000) {
    return NextResponse.json({ error: "Tarif SaaS harus antara Rp0–Rp100.000 per struk." }, { status: 400 });
  }
  if (!Number.isInteger(defaultMarketingCommission) || defaultMarketingCommission < 0 || defaultMarketingCommission > saasFeePerReceipt) {
    return NextResponse.json({ error: "Komisi harus bernilai positif dan tidak melebihi tarif SaaS." }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Konfigurasi database server belum lengkap." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("platform_settings")
    .upsert({
      id: "global",
      global_queue_dismiss_seconds: queueDismissSeconds,
      saas_fee_per_receipt: saasFeePerReceipt,
      default_marketing_commission: defaultMarketingCommission,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .select("global_queue_dismiss_seconds, saas_fee_per_receipt, default_marketing_commission, updated_at")
    .single();

  if (error) {
    console.error("Gagal menyimpan platform settings:", error);
    return NextResponse.json({ error: "Parameter global gagal disimpan." }, { status: 500 });
  }

  return NextResponse.json({ data: toResponse(data) });
}
