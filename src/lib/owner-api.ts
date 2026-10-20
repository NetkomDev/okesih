import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireOwner(request: Request) {
  const admin = createAdminClient();
  let user: User | null = null;

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    const { data, error } = await admin.auth.getUser(token);
    if (!error && data?.user) {
      user = data.user;
    }
  }

  // Fallback ke sesi cookies jika Bearer token tidak disediakan atau tidak lagi valid
  if (!user) {
    try {
      const serverSupabase = await createServerSupabaseClient();
      const { data, error } = await serverSupabase.auth.getUser();
      if (!error && data?.user) {
        user = data.user;
      }
    } catch {
      // Abaikan kegagalan resolusi cookie
    }
  }

  if (!user) {
    throw new OwnerApiError(token ? "Sesi login tidak valid." : "Sesi login tidak ditemukan.", 401);
  }

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

export async function touchWarkopUpdatedAt(admin: ReturnType<typeof createAdminClient>, warkopId: string) {
  try {
    await admin
      .from("warkops")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", warkopId);
  } catch {
    // Non-blocking: kegagalan menyentuh timestamp tidak boleh menggagalkan mutasi data utama
  }
}

export function ownerErrorResponse(error: unknown) {
  const status = error instanceof OwnerApiError
    ? error.status
    : error instanceof Error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;
  const message = error instanceof Error ? error.message : "Terjadi kesalahan internal.";
  return Response.json({ error: message }, { status });
}

