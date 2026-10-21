import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { DeviceApiError } from "@/lib/device-auth";
export const AUDIT_COOKIE = "okesih_audit_access";
export const AUDIT_TTL = 600;
export async function auditPinSettings(admin: SupabaseClient, warkopId: string) {
  const { data, error } = await admin.from("tenant_audit_pins").select("pin_hash,version").eq("warkop_id", warkopId).maybeSingle();
  if (error) throw error;
  return { hasPin: Boolean(data?.pin_hash), version: String(data?.version || "none") };
}
function signature(value: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Audit session configuration missing");
  return createHmac("sha256", secret).update(`audit:${value}`).digest("hex");
}
export function createAuditAccess(deviceId: string, version: string, now = Date.now()) {
  const payload = `${deviceId}.${version}.${Math.floor(now / 1000) + AUDIT_TTL}`;
  return `${payload}.${signature(payload)}`;
}
export function validAuditAccess(token: string | undefined, deviceId: string, version: string, now = Date.now()) {
  if (!token) return false;
  const [device, revision, expiry, mac, ...extra] = token.split(".");
  if (extra.length || device !== deviceId || revision !== version || !/^\d+$/.test(expiry || "") || Number(expiry) <= now / 1000 || !/^[a-f0-9]{64}$/.test(mac || "")) return false;
  return timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(`${device}.${revision}.${expiry}`), "hex"));
}
export async function requireAuditAccess(request: NextRequest, admin: SupabaseClient, warkopId: string, deviceId: string) {
  const settings = await auditPinSettings(admin, warkopId);
  if (settings.hasPin && !validAuditAccess(request.cookies.get(AUDIT_COOKIE)?.value, deviceId, settings.version)) {
    throw new DeviceApiError("Otorisasi histori berakhir. Masukkan kembali PIN owner.", 403);
  }
}
