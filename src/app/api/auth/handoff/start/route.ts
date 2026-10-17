import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { appUrl, roleSurface } from "@/lib/app-origins";
import {
  AUTH_HANDOFF_TTL_SECONDS,
  createHandoffCode,
  encryptHandoffSession,
} from "@/lib/auth-handoff";
import { getTrustedUserRole } from "@/lib/auth-role";
import { clientEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(256),
});

function noStoreJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !["https://okesih.com", "https://www.okesih.com", "http://localhost:3000"].includes(origin)) {
    return noStoreJson({ error: "Permintaan login tidak valid." }, 403);
  }

  const parsed = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStoreJson({ error: "Username dan password wajib diisi." }, 400);

  const email = parsed.data.username.includes("@")
    ? parsed.data.username.toLowerCase()
    : `${parsed.data.username.toLowerCase()}@okesih.local`;
  const auth = createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error || !data.user || !data.session) {
    return noStoreJson({ error: "Username atau password salah." }, 401);
  }

  const role = getTrustedUserRole(data.user);
  const targetSurface = roleSurface(role);
  if (!role || !targetSurface) {
    return noStoreJson({ error: "Akun tidak memiliki akses ke portal OKESIH." }, 403);
  }

  const admin = createAdminClient();
  await admin
    .from("auth_handoff_codes")
    .delete()
    .or(`expires_at.lt.${new Date().toISOString()},consumed_at.not.is.null`);
  const { code, hash } = createHandoffCode();
  const expiresAt = new Date(Date.now() + AUTH_HANDOFF_TTL_SECONDS * 1000).toISOString();
  const encryptedSession = encryptHandoffSession({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });

  const { error: insertError } = await admin.from("auth_handoff_codes").insert({
    code_hash: hash,
    user_id: data.user.id,
    user_role: role,
    target_surface: targetSurface,
    encrypted_session: encryptedSession,
    expires_at: expiresAt,
  });
  if (insertError) {
    console.error("Gagal membuat auth handoff:", insertError.message);
    return noStoreJson({ error: "Login belum dapat diproses. Silakan coba lagi." }, 500);
  }

  // Fragment tidak dikirim ke server tujuan atau log akses. Halaman tujuan
  // menukarkannya lewat POST, kemudian segera menghapus fragment dari address bar.
  return noStoreJson({ redirectTo: `${appUrl(targetSurface, "/auth/handoff")}#${code}` });
}
