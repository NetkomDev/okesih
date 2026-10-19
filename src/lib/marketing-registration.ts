import { createHmac, timingSafeEqual } from "node:crypto";

export const MARKETING_REGISTRATION_COOKIE = "okesih_marketing_registration";
export const MARKETING_REGISTRATION_TTL = 60 * 60 * 24 * 365;

export function createRegistrationToken(id: string, secret: string, now = Date.now()) {
  const payload = `${id}.${Math.floor(now / 1000) + MARKETING_REGISTRATION_TTL}`;
  const signature = createHmac("sha256", secret).update(`marketing-registration-v1:${payload}`).digest("hex");
  return `${payload}.${signature}`;
}

export function readRegistrationToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expires, signature] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d+$/.test(expires) || !/^[0-9a-f]{64}$/.test(signature)) return null;
  if (Number(expires) <= Math.floor(now / 1000)) return null;
  const expected = createHmac("sha256", secret).update(`marketing-registration-v1:${id}.${expires}`).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected) ? id : null;
}
