import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_ORIGINS } from "@/lib/app-origins";
import { assertSameOrigin, DeviceApiError } from "@/lib/device-auth";
import { recruitmentSchema } from "@/lib/marketing-recruitment";
import { randomDigits } from "@/lib/generated-credentials";
import { cleanWhatsAppMessageField as clean, createWhatsAppUrl, getSuperAdminWhatsAppNumber } from "@/lib/whatsapp";

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function coordinatorContext() {
  const session = await createServerSupabaseClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user || user.app_metadata?.role !== "MARKETING") throw new DeviceApiError("Sesi marketing diperlukan.", 401);
  const admin = createAdminClient();
  const { data: partner, error } = await admin.from("marketing_partners")
    .select("id, full_name, referral_code, status, membership_level, upline_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!partner || partner.status !== "ACTIVE" || partner.membership_level !== "COORDINATOR" || partner.upline_id) {
    throw new DeviceApiError("Fitur ini khusus Koordinator Mitra aktif.", 403);
  }
  return { admin, partner };
}
function failure(error: unknown) {
  if (error instanceof DeviceApiError) return json({ error: error.message }, error.status);
  console.error("Marketing network request failed", error);
  return json({ error: "Jaringan belum dapat diproses. Silakan coba lagi." }, 503);
}
export async function GET() {
  try {
    const { admin, partner } = await coordinatorContext();
    const { data, error } = await admin.rpc("report_marketing_network", { p_partner_id: partner.id });
    if (error || !data) throw error || new Error("Laporan tidak tersedia.");
    return json({ data: { ...data, referralUrl: `${APP_ORIGINS.PUBLIC}/marketing/daftar?ref=${encodeURIComponent(partner.referral_code)}` } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, partner } = await coordinatorContext();
    const parsed = recruitmentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Lengkapi nama, WhatsApp Indonesia aktif, wilayah, dan rekening angka. Periksa format email jika diisi." }, 400);
    const body = parsed.data;
    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);
    const columns = "id,full_name,phone,city_area,referral_code,status,upline_id";
    // A request UUID survives retries. Reusing it never creates a second recruit.
    const existing = await admin.from("marketing_partners").select(columns).eq("id", body.requestId).maybeSingle();
    if (existing.error) throw existing.error;
    let recruit = existing.data;
    if (recruit && recruit.upline_id !== partner.id) return json({ error: "ID pendaftaran telah digunakan. Mulai pendaftaran baru." }, 409);
    if (!recruit) {
      const { data: rates, error } = await admin.from("platform_settings").select("default_marketing_commission").eq("id", "global").single();
      if (error || !rates) throw error || new Error("Parameter komisi tidak tersedia.");
      const region = body.cityArea.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "IDN";
      for (let attempt = 0; attempt < 10; attempt++) {
        const saved = await admin.from("marketing_partners").insert({
          id: body.requestId, full_name: body.fullName, phone: body.phone, email: body.email || null,
          city_area: body.cityArea, bank_name: body.bankName, bank_account_number: body.bankAccountNumber,
          bank_account_name: body.bankAccountName, experience_notes: body.experienceNotes || null,
          referral_code: `MKT-${region}-${randomDigits(3)}`, status: "PENDING", membership_level: "MITRA",
          upline_id: partner.id, commission_rate: Number(rates.default_marketing_commission),
        }).select(columns).single();
        if (!saved.error) { recruit = saved.data; break; }
        // Includes the case where another retry committed the same request first.
        const retry = await admin.from("marketing_partners").select(columns).eq("id", body.requestId).maybeSingle();
        if (retry.error) throw retry.error;
        if (retry.data) {
          if (retry.data.upline_id !== partner.id) return json({ error: "ID pendaftaran telah digunakan." }, 409);
          recruit = retry.data; break;
        }
        if (saved.error.code !== "23505") throw saved.error;
      }
    }
    if (!recruit) throw new Error("Kode referral belum berhasil dibuat.");
    const message = ["*PENDAFTARAN MITRA OLEH KORMIT OKESIH*", "",
      `Koordinator: ${clean(partner.full_name)} (${clean(partner.referral_code)})`,
      `Nama mitra baru: ${clean(recruit.full_name)}`, `WhatsApp mitra baru: +${recruit.phone}`,
      `Wilayah: ${clean(recruit.city_area)}`, `Kode referral: ${clean(recruit.referral_code)}`, "",
      "Pendaftaran tersimpan. Verifikasi melalui Dashboard Super Admin → Mitra Marketing Lapangan.",
      "Setelah disetujui, kirim kredensial langsung ke WhatsApp mitra baru, bukan koordinator.",
    ].join("\n");
    return json({ success: true, data: { id: recruit.id, name: recruit.full_name, status: recruit.status,
      whatsappUrl: createWhatsAppUrl(adminPhone, message) } });
  } catch (error) { return failure(error); }
}
