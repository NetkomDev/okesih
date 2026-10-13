import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireOwner(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new OwnerApiError("Sesi login tidak ditemukan.", 401);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  const user = data.user;
  if (error || !user) throw new OwnerApiError("Sesi login tidak valid.", 401);
  // Jangan mempercayai user_metadata karena dapat diubah oleh pengguna.
  // Keanggotaan pada database adalah sumber otorisasi yang kanonis.
  const { data: membership, error: membershipError } = await admin
    .from("warkop_members")
    .select("warkop_id,role,is_active")
    .eq("user_id", user.id)
    .eq("role", "OWNER")
    .eq("is_active", true)
    .single();
  if (membershipError || !membership) throw new OwnerApiError("Akses khusus owner.", 403);

  return { admin, user, warkopId: membership.warkop_id };
}

export class OwnerApiError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

export function ownerErrorResponse(error: unknown) {
  const status = error instanceof OwnerApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Terjadi kesalahan internal.";
  return Response.json({ error: message }, { status });
}
