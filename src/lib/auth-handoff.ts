import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

export const AUTH_HANDOFF_TTL_SECONDS = 60;

export interface AuthHandoffSession {
  accessToken: string;
  refreshToken: string;
}

function encryptionKey() {
  return createHash("sha256")
    .update(`${serverEnv.SUPABASE_SERVICE_ROLE_KEY}|okesih-auth-handoff-v1`)
    .digest();
}

export function createHandoffCode() {
  const code = randomBytes(32).toString("base64url");
  return { code, hash: hashHandoffCode(code) };
}

export function hashHandoffCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function encryptHandoffSession(session: AuthHandoffSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptHandoffSession(payload: string): AuthHandoffSession {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Payload handoff tidak valid.");

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as Partial<AuthHandoffSession>;
  if (!parsed.accessToken || !parsed.refreshToken) throw new Error("Sesi handoff tidak lengkap.");
  return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
}
