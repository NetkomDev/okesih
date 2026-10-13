import { NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/device-auth";
import { OwnerApiError, ownerErrorResponse, requireOwner } from "@/lib/owner-api";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("change_password"), password: z.string().min(8).max(128) }),
  z.object({ action: z.literal("pwa_installed") }),
  z.object({ action: z.literal("complete") }),
]);

async function ensureOnboarding(request: NextRequest) {
  const context = await requireOwner(request);
  const { data, error } = await context.admin.from("owner_onboarding").upsert({ warkop_id: context.warkopId, owner_user_id: context.user.id, updated_at: new Date().toISOString() }, { onConflict: "warkop_id" }).select("password_changed_at,owner_pwa_installed_at,completed_at").single();
  if (error) throw error;
  return { ...context, onboarding: data };
}

export async function GET(request: NextRequest) {
  try {
    const { onboarding } = await ensureOnboarding(request);
    return Response.json({ onboarding }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const { admin, user, warkopId, onboarding } = await ensureOnboarding(request);
    const now = new Date().toISOString();
    if (input.action === "change_password") {
      const { error } = await admin.auth.admin.updateUserById(user.id, { password: input.password });
      if (error) throw new OwnerApiError(error.message, 400);
      await admin.from("owner_onboarding").update({ password_changed_at: now, updated_at: now }).eq("warkop_id", warkopId);
      await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, action: "OWNER_INITIAL_PASSWORD_CHANGED", target_type: "owner" });
    } else if (input.action === "pwa_installed") {
      await admin.from("owner_onboarding").update({ owner_pwa_installed_at: now, updated_at: now }).eq("warkop_id", warkopId);
    } else {
      if (!onboarding.password_changed_at) throw new OwnerApiError("Ganti password awal sebelum menyelesaikan onboarding.", 409);
      await admin.from("owner_onboarding").update({ completed_at: now, updated_at: now }).eq("warkop_id", warkopId);
    }
    const { data } = await admin.from("owner_onboarding").select("password_changed_at,owner_pwa_installed_at,completed_at").eq("warkop_id", warkopId).single();
    return Response.json({ onboarding: data });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data onboarding tidak valid." }, { status: 400 });
    return ownerErrorResponse(error);
  }
}
