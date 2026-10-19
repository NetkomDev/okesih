import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin, DeviceApiError } from "@/lib/device-auth";
import { marketingProfile, marketingProfileUpdateSchema, type MarketingProfileRow } from "@/lib/marketing-profile";

export const dynamic = "force-dynamic";
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

async function getMarketingContext() {
  const session = await createServerSupabaseClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user || user.app_metadata?.role !== "MARKETING") throw new DeviceApiError("Sesi login marketing tidak valid.", 401);
  const admin = createAdminClient();
  const { data, error } = await admin.from("marketing_partners").select("*").eq("user_id", user.id).eq("status", "ACTIVE").maybeSingle();
  if (error) throw error;
  if (!data) throw new DeviceApiError("Akun marketing tidak aktif atau tidak terhubung.", 403);
  const { data: rates } = await admin.from("platform_settings").select("*").eq("id", "global").maybeSingle();
  const resolvedLevel = data.membership_level || (typeof data.notes_admin === "string" && data.notes_admin.includes("[LEVEL:COORDINATOR]") ? "COORDINATOR" : "MARKETING");
  const partner = {
    ...data,
    membership_level: resolvedLevel,
    commission_rate: rates?.default_marketing_commission !== undefined ? Number(rates.default_marketing_commission) : Number(data.commission_rate ?? 0),
    coordinator_commission_rate: rates?.coordinator_commission_per_receipt !== undefined ? Number(rates.coordinator_commission_per_receipt) : 0,
  } as MarketingProfileRow;
  const { count, error: countError } = await admin.from("warkops").select("id", { count: "exact", head: true }).eq("marketing_agent_id", partner.id);
  if (countError) throw countError;
  return { admin, user, partner, totalTenants: count ?? 0 };
}
function failure(error: unknown) {
  console.error("Marketing profile request failed:", error);
  return json({ error: error instanceof DeviceApiError ? error.message : "Profil belum dapat diproses. Silakan coba lagi." }, error instanceof DeviceApiError ? error.status : 500);
}
export async function GET() {
  try {
    const { partner, user, totalTenants } = await getMarketingContext();
    return json({ profile: marketingProfile(partner, totalTenants, user.email) });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, user, partner, totalTenants } = await getMarketingContext();
    const parsed = marketingProfileUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: "Periksa isian: nama minimal 2 karakter, wilayah dan rekening wajib lengkap, username 4–30 karakter, serta password minimal 6 karakter." }, 400);
    const body = parsed.data;
    const current = marketingProfile(partner, totalTenants, user.email);
    const credentials = "username" in body;
    const usernameChanged = credentials && body.username !== current.username;
    const passwordChanged = credentials && body.newPassword !== undefined;
    const updates = credentials ? { username: body.username } : {
      full_name: body.fullName, phone: body.phone, city_area: body.cityArea,
      bank_name: body.bankName, bank_account_number: body.bankAccountNumber, bank_account_name: body.bankAccountName,
    };
    // Optimistic concurrency prevents a second tab from overwriting a concurrent save.
    const { data: saved, error } = await admin.from("marketing_partners").update(updates)
      .eq("id", partner.id).eq("user_id", user.id).eq("status", "ACTIVE").eq("updated_at", partner.updated_at).select("*").maybeSingle();
    if (error) {
      if (error.code === "23505") return json({ error: "Username sudah digunakan. Pilih username lain." }, 409);
      throw error;
    }
    if (!saved) return json({ error: "Data berubah saat disimpan. Muat ulang profil dan coba lagi." }, 409);
    if (credentials && (usernameChanged || passwordChanged)) {
      // Validate everything first; apply email and password in one Auth operation.
      const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
        ...(usernameChanged ? { email: `${body.username}@okesih.local`, email_confirm: true } : {}),
        ...(passwordChanged ? { password: body.newPassword } : {}),
      });
      if (authError) {
        const rollback = await admin.from("marketing_partners").update({ username: partner.username })
          .eq("id", partner.id).eq("updated_at", saved.updated_at).select("id").maybeSingle();
        if (rollback.error || !rollback.data) {
          console.error("Marketing username rollback failed", { partnerId: partner.id });
          return json({ error: "Perubahan login gagal. Hubungi admin untuk memeriksa sinkronisasi username; kredensial lama tetap berlaku." }, 500);
        }
        return json({ error: "Kredensial belum diubah. Username mungkin sudah digunakan atau password belum memenuhi persyaratan." }, 400);
      }
    }
    const audit = await admin.from("audit_logs").insert({ actor_user_id: user.id, action: "MARKETING_PROFILE_UPDATED", target_type: "marketing_partner", target_id: partner.id, metadata: { username_changed: usernameChanged, password_changed: passwordChanged, updated_fields: Object.keys(updates) } });
    if (audit.error) console.error("Marketing profile audit failed", audit.error.code);
    return json({ success: true, usernameChanged, passwordChanged, username: credentials ? body.username : current.username,
      profile: marketingProfile({ ...saved, commission_rate: partner.commission_rate, coordinator_commission_rate: partner.coordinator_commission_rate } as MarketingProfileRow, totalTenants, credentials ? `${body.username}@okesih.local` : user.email) });
  } catch (error) { return failure(error); }
}
