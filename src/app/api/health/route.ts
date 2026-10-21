import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const started = performance.now();
  let healthy = false;
  try {
    const { error } = await createAdminClient().from("platform_settings").select("id").limit(1).abortSignal(AbortSignal.timeout(5000));
    healthy = !error;
  } catch { /* Public probe deliberately omits internal errors. */ }
  if (!healthy) console.error(JSON.stringify({ event: "health_probe_failed", durationMs: Math.round(performance.now() - started) }));
  return Response.json({ status: healthy ? "healthy" : "unhealthy", timestamp: new Date().toISOString() }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
