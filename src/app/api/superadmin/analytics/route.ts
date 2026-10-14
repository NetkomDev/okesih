import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrustedUserRole } from "@/lib/auth-role";

const periods = new Set(["today", "week", "month", "year"]);

export async function GET(request: Request) {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  const isSuperAdmin = getTrustedUserRole(user) === "SUPERADMIN";
  if (!user || !isSuperAdmin) {
    return NextResponse.json({ error: "Akses super admin diperlukan." }, { status: 403 });
  }

  const periodParam = new URL(request.url).searchParams.get("period") || "today";
  const period = periods.has(periodParam) ? periodParam : "today";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Konfigurasi database server belum lengkap." }, { status: 500 });
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("get_superadmin_analytics", { p_period: period });
  if (error) {
    console.error("Gagal memuat analytics super admin:", error);
    return NextResponse.json({ error: "Riwayat pencapaian belum dapat dimuat." }, { status: 500 });
  }

  return NextResponse.json({ data });
}
