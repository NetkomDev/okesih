import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeviceType = "POS" | "KDS";

export const DEVICE_COOKIE: Record<DeviceType, string> = {
  POS: "okesih_pos_device",
  KDS: "okesih_kds_device",
};

export class DeviceApiError extends Error {
  constructor(message: string, public status = 500, public code?: string) {
    super(message);
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function pairingCode() {
  return String(randomInt(100000, 1000000));
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new DeviceApiError("Permintaan lintas situs ditolak.", 403);
  }
}

export async function requireDevice(request: NextRequest, allowedTypes: DeviceType[]) {
  const admin = createAdminClient();
  let matchedType: DeviceType | null = null;
  let token: string | undefined;

  const requestedType = request.headers.get("X-Device-Type");
  if (requestedType && !allowedTypes.includes(requestedType as DeviceType)) {
    throw new DeviceApiError("Jenis perangkat tidak diizinkan.", 403);
  }
  for (const type of allowedTypes.filter((type) => !requestedType || requestedType === type)) {
    const candidate = request.cookies.get(DEVICE_COOKIE[type])?.value;
    if (candidate) {
      matchedType = type;
      token = candidate;
      break;
    }
  }

  if (!token || !matchedType) throw new DeviceApiError("Perangkat belum dipasangkan.", 401);

  const { data: device, error } = await admin
    .from("device_installations")
    .select("id,warkop_id,device_type,device_name,status,expires_at,last_seen_at")
    .eq("token_hash", sha256(token))
    .eq("device_type", matchedType)
    .maybeSingle();

  if (error) throw new DeviceApiError("Status perangkat belum dapat diperiksa.", 503);
  if (!device) throw new DeviceApiError("Perangkat telah dihapus permanen.", 401, "DEVICE_REMOVED");
  if (device.status !== "ACTIVE") throw new DeviceApiError("Akses perangkat telah dicabut.", 401);
  if (new Date(device.expires_at).getTime() <= Date.now()) {
    await admin.from("device_installations").update({ status: "EXPIRED" }).eq("id", device.id);
    throw new DeviceApiError("Sesi perangkat kedaluwarsa. Lakukan pairing ulang.", 401);
  }

  const { data: tenant, error: tenantError } = await admin.from("warkops").select("is_active").eq("id", device.warkop_id).maybeSingle();
  if (tenantError) throw new DeviceApiError("Status usaha belum dapat diperiksa.", 503);
  if (!tenant?.is_active) throw new DeviceApiError("Usaha sedang nonaktif.", 403);

  if (Date.now() - new Date(device.last_seen_at).getTime() > 5 * 60_000) {
    const { error: heartbeatError } = await admin.from("device_installations").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    if (heartbeatError) console.error("device_heartbeat_failed", { code: heartbeatError.code });
  }

  return { admin, device, warkopId: device.warkop_id as string, deviceType: device.device_type as DeviceType };
}

export function setDeviceCookie(response: NextResponse, type: DeviceType, token: string, expiresAt: string) {
  response.cookies.set(DEVICE_COOKIE[type], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt),
    priority: "high",
  });
}

export function clearDeviceCookie(response: NextResponse, type: DeviceType) {
  response.cookies.set(DEVICE_COOKIE[type], "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function deviceErrorResponse(error: unknown) {
  const status = error instanceof DeviceApiError ? error.status : 500;
  const message = error instanceof DeviceApiError ? error.message : "Terjadi kesalahan internal.";
  return Response.json({ error: message, ...(error instanceof DeviceApiError && error.code ? { code: error.code } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}
