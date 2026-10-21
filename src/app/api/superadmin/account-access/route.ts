import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin, DeviceApiError } from "@/lib/device-auth";
import { AccessRecoveryError, recoverAccountAccess } from "@/lib/account-access-recovery";

const schema = z.object({
  kind: z.enum(["MARKETING", "TENANT", "APPLICATION"]),
  id: z.string().uuid(), phone: z.string().min(1).max(30),
  resetPassword: z.boolean().default(false),
  recipientConfirmed: z.literal(true),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await createServerSupabaseClient();
    const { data: { user } } = await session.auth.getUser();
    if (user?.app_metadata?.role !== "SUPERADMIN") return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 403 });
    const input = schema.parse(await request.json());
    const data = await recoverAccountAccess(createAdminClient(), user.id, input);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AccessRecoveryError || error instanceof DeviceApiError ? error.status : error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: error instanceof z.ZodError ? "Periksa nomor dan konfirmasi identitas penerima terlebih dahulu." : error instanceof Error ? error.message : "Pemulihan akses gagal." }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
