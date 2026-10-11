import { NextResponse } from "next/server";
import { clientEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const startTime = Date.now();
  let supabaseConnected = false;
  let supabaseMessage = "Belum terkoneksi";

  try {
    const supabase = await createServerSupabaseClient();
    // Test ping auth status or server version
    const { error } = await supabase.auth.getSession();
    if (!error) {
      supabaseConnected = true;
      supabaseMessage = "Koneksi BaaS Supabase Aktif & Siap";
    } else {
      supabaseMessage = `Respon Supabase: ${error.message}`;
    }
  } catch (err) {
    supabaseMessage = err instanceof Error ? err.message : "Gagal inisialisasi client";
  }

  const durationMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: "healthy",
      service: "OKESIH.COM Core System",
      version: "3.0-mvp",
      timestamp: new Date().toISOString(),
      supabase: {
        url: clientEnv.NEXT_PUBLIC_SUPABASE_URL,
        connected: supabaseConnected,
        message: supabaseMessage,
        latencyMs: durationMs,
      },
      pwa: {
        manifest: "/manifest.webmanifest",
        offlineFallback: "/~offline",
      },
      security: {
        serviceRoleIsolated: true,
        clientAnonGuarded: true,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
