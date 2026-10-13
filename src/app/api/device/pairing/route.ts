import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DeviceApiError,
  assertSameOrigin,
  deviceErrorResponse,
  pairingCode,
  randomToken,
  setDeviceCookie,
  sha256,
  type DeviceType,
} from "@/lib/device-auth";

const requestSchema = z.object({
  deviceType: z.enum(["POS", "KDS"]),
  deviceName: z.string().trim().min(2).max(100),
});

const pollSchema = z.object({
  pairingId: z.string().uuid(),
  pollSecret: z.string().min(30).max(200),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = requestSchema.parse(await request.json());
    const admin = createAdminClient();
    const pollSecret = randomToken();
    let code = pairingCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: conflict } = await admin
        .from("device_pairing_requests")
        .select("id")
        .eq("code_hash", sha256(code))
        .eq("status", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!conflict) break;
      code = pairingCode();
    }

    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const { data, error } = await admin
      .from("device_pairing_requests")
      .insert({
        device_type: input.deviceType,
        device_name: input.deviceName,
        code_hash: sha256(code),
        poll_secret_hash: sha256(pollSecret),
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json(
      { pairingId: data.id, pollSecret, code, expiresAt },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data perangkat tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = pollSchema.parse(await request.json());
    const admin = createAdminClient();
    const { data: pairing, error } = await admin
      .from("device_pairing_requests")
      .select("id,device_type,status,expires_at")
      .eq("id", input.pairingId)
      .eq("poll_secret_hash", sha256(input.pollSecret))
      .maybeSingle();

    if (error || !pairing) throw new DeviceApiError("Permintaan pairing tidak ditemukan.", 404);
    if (pairing.status === "PENDING" && new Date(pairing.expires_at).getTime() <= Date.now()) {
      await admin.from("device_pairing_requests").update({ status: "EXPIRED" }).eq("id", pairing.id);
      return NextResponse.json({ status: "EXPIRED" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (pairing.status === "PENDING") {
      return NextResponse.json({ status: "PENDING" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!(["APPROVED", "CONSUMED"] as string[]).includes(pairing.status)) {
      return NextResponse.json({ status: pairing.status }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data: device } = await admin
      .from("device_installations")
      .select("id,device_type,expires_at,status")
      .eq("pairing_request_id", pairing.id)
      .eq("token_hash", sha256(input.pollSecret))
      .maybeSingle();
    if (!device || device.status !== "ACTIVE") throw new DeviceApiError("Perangkat tidak lagi aktif.", 401);

    await admin.from("device_pairing_requests").update({ status: "CONSUMED", consumed_at: new Date().toISOString() }).eq("id", pairing.id);
    const response = NextResponse.json(
      { status: "APPROVED", deviceType: device.device_type },
      { headers: { "Cache-Control": "no-store" } },
    );
    setDeviceCookie(response, device.device_type as DeviceType, input.pollSecret, device.expires_at);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Kredensial pairing tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}

