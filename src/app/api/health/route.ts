import { NextResponse } from "next/server";
import { clientEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const startTime = performance.now();
  let dbConnected = false;
  let dbMessage = "Belum terverifikasi";
  let dbLatencyMs = 0;
  let lastUpdatedAt: string | null = null;

  try {
    const admin = createAdminClient();
    const queryStart = performance.now();

    // Probe query database nyata ke tabel sistem platform_settings
    // Menguji ketersediaan Postgres, PostgREST pool, dan keabsahan koneksi jaringan.
    const { data, error } = await admin
      .from("platform_settings")
      .select("id, updated_at")
      .eq("id", "global")
      .limit(1)
      .maybeSingle();

    dbLatencyMs = Math.round(performance.now() - queryStart);

    if (error) {
      dbConnected = false;
      dbMessage = `Database query error: ${error.message}`;
    } else {
      dbConnected = true;
      dbMessage = "Koneksi PostgreSQL aktif dan query responsif";
      lastUpdatedAt = data?.updated_at || null;
    }
  } catch (err) {
    dbConnected = false;
    dbMessage = err instanceof Error ? err.message : "Gagal inisialisasi koneksi database";
  }

  const totalDurationMs = Math.round(performance.now() - startTime);
  const memUsage = process.memoryUsage();
  const isHealthy = dbConnected;

  const payload = {
    status: isHealthy ? "healthy" : "unhealthy",
    service: "OKESIH.COM Core System",
    version: "3.0-p2",
    timestamp: new Date().toISOString(),
    database: {
      url: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
      connected: dbConnected,
      message: dbMessage,
      latencyMs: dbLatencyMs,
      lastSettingsUpdate: lastUpdatedAt,
      probeTable: "platform_settings",
    },
    system: {
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: Math.round(memUsage.rss / 1024 / 1024),
      memoryHeapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      nodeVersion: process.version,
    },
    subsystems: {
      ocr: "tesseract-lstm/eng-isolated",
      pwa: "serwist-multi-surface",
      securityGuard: "active",
    },
    totalDurationMs,
  };

  return NextResponse.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
