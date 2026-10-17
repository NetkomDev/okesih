import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  APP_ENTRY_PATHS,
  normalizeHostname,
  roleSurface,
  surfaceForHostname,
} from "@/lib/app-origins";
import { decryptHandoffSession, hashHandoffCode } from "@/lib/auth-handoff";
import { getTrustedUserRole } from "@/lib/auth-role";
import { clientEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const inputSchema = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{40,80}$/) });

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function POST(request: NextRequest) {
  const hostname = normalizeHostname(request.headers.get("x-forwarded-host") || request.headers.get("host"));
  const currentSurface = surfaceForHostname(hostname);
  if (!currentSurface || currentSurface === "PUBLIC") {
    return errorResponse("Tujuan login tidak valid.", 400);
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Kode login tidak valid.", 400);

  const admin = createAdminClient();
  const consumedAt = new Date().toISOString();
  const { data: handoff, error: consumeError } = await admin
    .from("auth_handoff_codes")
    .update({ consumed_at: consumedAt })
    .eq("code_hash", hashHandoffCode(parsed.data.code))
    .eq("target_surface", currentSurface)
    .is("consumed_at", null)
    .gt("expires_at", consumedAt)
    .select("user_id,user_role,encrypted_session")
    .maybeSingle();

  if (consumeError || !handoff) {
    return errorResponse("Kode login sudah digunakan atau kedaluwarsa.", 401);
  }

  try {
    const session = decryptHandoffSession(handoff.encrypted_session);
    const { data: verified, error: verifyError } = await admin.auth.getUser(session.accessToken);
    const verifiedRole = getTrustedUserRole(verified.user);
    if (
      verifyError ||
      !verified.user ||
      verified.user.id !== handoff.user_id ||
      verifiedRole !== handoff.user_role ||
      roleSurface(verifiedRole) !== currentSurface
    ) {
      return errorResponse("Sesi login tidak valid.", 401);
    }

    const response = NextResponse.json(
      { redirectTo: APP_ENTRY_PATHS[currentSurface] },
      { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
    );
    const supabase = createServerClient(
      clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              const hostOnlyOptions = { ...options };
              delete hostOnlyOptions.domain;
              response.cookies.set(name, value, hostOnlyOptions);
            });
          },
        },
      },
    );
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
    if (sessionError) return errorResponse("Sesi login tidak dapat dibuat.", 401);
    return response;
  } catch (error) {
    console.error("Gagal mengonsumsi auth handoff:", error instanceof Error ? error.message : error);
    return errorResponse("Sesi login tidak dapat diproses.", 401);
  }
}
