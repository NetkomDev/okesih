import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { DeviceApiError } from "@/lib/device-auth";

export type CashierMember = {
  id: string;
  warkop_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  role: "KASIR";
  is_active: boolean;
};

export async function requireCashier(
  request: Request,
  admin: SupabaseClient,
  warkopId: string,
): Promise<{ user: User; member: CashierMember }> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new DeviceApiError("Masuk dengan akun kasir untuk melanjutkan.", 401);

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new DeviceApiError("Sesi kasir tidak valid. Silakan masuk kembali.", 401);

  const { data: member, error: memberError } = await admin
    .from("warkop_members")
    .select("id,warkop_id,user_id,username,display_name,role,is_active")
    .eq("user_id", data.user.id)
    .eq("warkop_id", warkopId)
    .eq("role", "KASIR")
    .eq("is_active", true)
    .maybeSingle();

  if (memberError || !member) throw new DeviceApiError("Akun ini bukan kasir aktif untuk usaha tersebut.", 403);
  return { user: data.user, member: member as CashierMember };
}

