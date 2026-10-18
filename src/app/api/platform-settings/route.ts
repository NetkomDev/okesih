import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrustedUserRole } from "@/lib/auth-role";
import {
  DEFAULT_PLATFORM_SETTINGS,
  parsePlatformSettings,
} from "@/lib/platform-settings";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function toResponse(row: Record<string, unknown> | null) {
  return parsePlatformSettings(row);
}

export async function GET() {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Konfigurasi database server belum lengkap." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("platform_settings")
    .select("*")
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
  const role = getTrustedUserRole(user);
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

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Konfigurasi database server belum lengkap." }, { status: 500 });
  }

  // Ambil setting aktif yang ada saat ini sebagai baseline
  const { data: current } = await admin
    .from("platform_settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();

  const queueDismissSeconds = body.queueDismissSeconds !== undefined
    ? Number(body.queueDismissSeconds)
    : Number(current?.global_queue_dismiss_seconds ?? DEFAULT_PLATFORM_SETTINGS.queueDismissSeconds);

  const saasFeePerReceipt = body.saasFeePerReceipt !== undefined
    ? Number(body.saasFeePerReceipt)
    : Number(current?.saas_fee_per_receipt ?? DEFAULT_PLATFORM_SETTINGS.saasFeePerReceipt);

  const defaultMarketingCommission = body.defaultMarketingCommission !== undefined
    ? Number(body.defaultMarketingCommission)
    : Number(current?.default_marketing_commission ?? DEFAULT_PLATFORM_SETTINGS.defaultMarketingCommission);

  if (!Number.isInteger(queueDismissSeconds) || queueDismissSeconds < 10 || queueDismissSeconds > 600) {
    return NextResponse.json({ error: "Durasi antrean harus antara 10–600 detik." }, { status: 400 });
  }
  if (!Number.isInteger(saasFeePerReceipt) || saasFeePerReceipt < 0 || saasFeePerReceipt > 100000) {
    return NextResponse.json({ error: "Tarif SaaS harus antara Rp0–Rp100.000 per struk." }, { status: 400 });
  }
  if (!Number.isInteger(defaultMarketingCommission) || defaultMarketingCommission < 0 || defaultMarketingCommission > saasFeePerReceipt) {
    return NextResponse.json({ error: "Komisi harus bernilai positif dan tidak melebihi tarif SaaS." }, { status: 400 });
  }

  const qrisImageUrl = body.qrisImageUrl !== undefined
    ? String(body.qrisImageUrl).trim()
    : (current?.qris_image_url ?? DEFAULT_PLATFORM_SETTINGS.qrisImageUrl);

  const qrisMerchantName = body.qrisMerchantName !== undefined
    ? String(body.qrisMerchantName).trim()
    : (current?.qris_merchant_name ?? DEFAULT_PLATFORM_SETTINGS.qrisMerchantName);

  const bankName = body.bankName !== undefined
    ? String(body.bankName).trim()
    : (current?.bank_name ?? DEFAULT_PLATFORM_SETTINGS.bankName);

  const bankAccountNumber = body.bankAccountNumber !== undefined
    ? String(body.bankAccountNumber).trim()
    : (current?.bank_account_number ?? DEFAULT_PLATFORM_SETTINGS.bankAccountNumber);

  const bankAccountName = body.bankAccountName !== undefined
    ? String(body.bankAccountName).trim()
    : (current?.bank_account_name ?? DEFAULT_PLATFORM_SETTINGS.bankAccountName);

  const { data, error } = await admin
    .from("platform_settings")
    .upsert({
      id: "global",
      global_queue_dismiss_seconds: queueDismissSeconds,
      saas_fee_per_receipt: saasFeePerReceipt,
      default_marketing_commission: defaultMarketingCommission,
      qris_image_url: qrisImageUrl,
      qris_merchant_name: qrisMerchantName,
      bank_name: bankName,
      bank_account_number: bankAccountNumber,
      bank_account_name: bankAccountName,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Gagal menyimpan platform settings:", error);
    return NextResponse.json({ error: "Parameter global gagal disimpan." }, { status: 500 });
  }

  // Terapkan durasi auto-dismiss secara serentak ke seluruh warkop tenant
  if (body.queueDismissSeconds !== undefined) {
    const { error: cascadeError } = await admin
      .from("warkops")
      .update({ queue_dismiss_seconds: queueDismissSeconds })
      .not("id", "is", null);
    if (cascadeError) {
      console.warn("Peringatan: Gagal cascade queue_dismiss_seconds ke warkops:", cascadeError.message);
    }
  }

  // Revalidasi cache ISR dan halaman publik
  try {
    revalidateTag("platform-settings", { expire: 0 });
    revalidatePath("/", "page");
    revalidatePath("/marketing", "page");
    revalidatePath("/marketing/daftar", "page");
  } catch (revalidateErr) {
    console.warn("Peringatan: Gagal revalidate tag/path:", revalidateErr);
  }

  return NextResponse.json({ data: toResponse(data) });
}
