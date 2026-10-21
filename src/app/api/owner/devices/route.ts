import { enforceRateLimit } from "@/lib/api-rate-limit";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOwner, ownerErrorResponse, OwnerApiError } from "@/lib/owner-api";
import { assertSameOrigin, sha256 } from "@/lib/device-auth";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), code: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal("rename"), deviceId: z.string().uuid(), deviceName: z.string().trim().min(2).max(100) }),
  z.object({ action: z.literal("revoke"), deviceId: z.string().uuid() }),
  z.object({ action: z.literal("delete"), deviceId: z.string().uuid() }),
  z.object({ action: z.literal("revoke_all") }),
]);

export async function GET(request: NextRequest) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const [{ data: devices, error }, { data: onboarding }] = await Promise.all([
      admin
        .from("device_installations")
        .select("id,device_type,device_name,status,paired_at,last_seen_at,expires_at,revoked_at")
        .eq("warkop_id", warkopId)
        .order("paired_at", { ascending: false }),
      admin.from("owner_onboarding").select("password_changed_at,owner_pwa_installed_at,completed_at").eq("warkop_id", warkopId).maybeSingle(),
    ]);
    if (error) throw error;
    return Response.json({ devices: devices || [], onboarding }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { admin, user, warkopId } = await requireOwner(request);
    const input = actionSchema.parse(await request.json());
    const now = new Date().toISOString();

    if (input.action === "approve") {
      await enforceRateLimit(admin, request, "pairing-approve", 10, 300, user.id);
      const { data: device, error } = await admin.rpc("approve_device_pairing", { p_warkop_id: warkopId, p_actor: user.id, p_code_hash: sha256(input.code) });
      if (error) throw new OwnerApiError("Kode pairing tidak valid, kedaluwarsa, atau telah digunakan.", 409);
      return Response.json({ device }, { status: 201 });
    }

    if (input.action === "rename") {
      const { data, error } = await admin.from("device_installations").update({ device_name: input.deviceName, updated_at: now }).eq("id", input.deviceId).eq("warkop_id", warkopId).select("id").maybeSingle();
      if (error || !data) throw new OwnerApiError("Perangkat tidak ditemukan.", 404);
      await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, device_id: input.deviceId, action: "DEVICE_RENAMED", target_type: "device", target_id: input.deviceId });
      return Response.json({ success: true });
    }

    if (input.action === "delete") {
      const { error } = await admin.rpc("delete_revoked_device", {
        p_warkop_id: warkopId,
        p_device_id: input.deviceId,
        p_actor_user_id: user.id,
      });
      if (error?.message.includes("DEVICE_NOT_FOUND")) throw new OwnerApiError("Perangkat tidak ditemukan.", 404);
      if (error?.message.includes("DEVICE_MUST_BE_REVOKED")) throw new OwnerApiError("Cabut perangkat sebelum menghapusnya.", 409);
      if (error?.message.includes("DEVICE_HAS_OPEN_SHIFT")) throw new OwnerApiError("Akhiri shift kasir sebelum menghapus perangkat.", 409);
      if (error) throw error;
      return Response.json({ success: true });
    }

    const query = admin.from("device_installations").update({ status: "REVOKED", revoked_at: now, updated_at: now }).eq("warkop_id", warkopId).eq("status", "ACTIVE");
    const { error } = input.action === "revoke" ? await query.eq("id", input.deviceId) : await query;
    if (error) throw error;
    await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, device_id: input.action === "revoke" ? input.deviceId : null, action: input.action === "revoke" ? "DEVICE_REVOKED" : "ALL_DEVICES_REVOKED", target_type: "device", target_id: input.action === "revoke" ? input.deviceId : null });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Permintaan perangkat tidak valid." }, { status: 400 });
    return ownerErrorResponse(error);
  }
}
