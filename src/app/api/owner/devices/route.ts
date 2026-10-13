import { NextRequest } from "next/server";
import { z } from "zod";
import { requireOwner, ownerErrorResponse, OwnerApiError } from "@/lib/owner-api";
import { assertSameOrigin, sha256 } from "@/lib/device-auth";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), code: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal("rename"), deviceId: z.string().uuid(), deviceName: z.string().trim().min(2).max(100) }),
  z.object({ action: z.literal("revoke"), deviceId: z.string().uuid() }),
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
      const { data: pairing, error } = await admin
        .from("device_pairing_requests")
        .select("id,device_type,device_name,poll_secret_hash,status,expires_at")
        .eq("code_hash", sha256(input.code))
        .eq("status", "PENDING")
        .gt("expires_at", now)
        .maybeSingle();
      if (error || !pairing) throw new OwnerApiError("Kode pairing tidak valid atau sudah kedaluwarsa.", 404);

      const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60_000).toISOString();
      const { data: device, error: deviceError } = await admin
        .from("device_installations")
        .insert({
          warkop_id: warkopId,
          pairing_request_id: pairing.id,
          device_type: pairing.device_type,
          device_name: pairing.device_name,
          token_hash: pairing.poll_secret_hash,
          paired_by: user.id,
          expires_at: expiresAt,
        })
        .select("id,device_type,device_name,status,paired_at,last_seen_at,expires_at,revoked_at")
        .single();
      if (deviceError) throw deviceError;

      await Promise.all([
        admin.from("device_pairing_requests").update({ warkop_id: warkopId, status: "APPROVED", approved_by: user.id, approved_at: now }).eq("id", pairing.id),
        admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, device_id: device.id, action: "DEVICE_PAIRED", target_type: "device", target_id: device.id, metadata: { device_type: device.device_type, device_name: device.device_name } }),
      ]);
      return Response.json({ device }, { status: 201 });
    }

    if (input.action === "rename") {
      const { data, error } = await admin.from("device_installations").update({ device_name: input.deviceName, updated_at: now }).eq("id", input.deviceId).eq("warkop_id", warkopId).select("id").maybeSingle();
      if (error || !data) throw new OwnerApiError("Perangkat tidak ditemukan.", 404);
      await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, device_id: input.deviceId, action: "DEVICE_RENAMED", target_type: "device", target_id: input.deviceId });
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

