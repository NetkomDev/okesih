import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCoordinatorLevel } from "@/lib/affiliate";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("ref")?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]{1,50}$/.test(code)) {
    return NextResponse.json({ error: "Kode referral koordinator tidak valid." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: partner, error } = await admin
    .from("marketing_partners")
    .select("full_name, referral_code, status, membership_level, upline_id, user_id")
    .eq("referral_code", code)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Referral belum dapat diperiksa." }, { status: 503 });
  }

  if (!partner || partner.status !== "ACTIVE" || !partner.user_id) {
    return NextResponse.json({ error: "Koordinator tidak ditemukan atau sudah tidak aktif." }, { status: 404 });
  }

  const isCoord = isCoordinatorLevel(partner.membership_level);

  if (!isCoord) {
    return NextResponse.json({ error: "Kode referral ini bukan milik Koordinator Mitra." }, { status: 404 });
  }

  return NextResponse.json(
    { data: { name: partner.full_name, code: partner.referral_code } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
