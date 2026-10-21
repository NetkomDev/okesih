import "server-only";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DeviceApiError } from "@/lib/device-auth";

export async function enforceRateLimit(admin: SupabaseClient, request: Request, scope: string, limit: number, seconds: number, identity?: string) {
  // Vercel supplies x-real-ip; an unknown address intentionally shares a bucket.
  const subject = identity || request.headers.get("x-real-ip") || "unknown";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new DeviceApiError("Layanan belum tersedia.", 503);
  const bucket = createHmac("sha256", secret).update(`${scope}:${subject}`).digest("hex");
  const { data, error } = await admin.rpc("consume_api_limit", { p_bucket: bucket, p_limit: limit, p_window_seconds: seconds });
  if (error || !data) throw new DeviceApiError("Pemeriksaan permintaan belum tersedia. Coba kembali.", 503);
  if (!data.allowed) throw new DeviceApiError(`Terlalu banyak percobaan. Coba kembali dalam ${data.retryAfter} detik.`, 429);
}
