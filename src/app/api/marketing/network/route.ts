import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_ORIGINS } from "@/lib/app-origins";
import { isCoordinatorLevel } from "@/lib/affiliate";

export async function GET() {
  try {
    const session = await createServerSupabaseClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user || user.app_metadata?.role !== "MARKETING") {
      return NextResponse.json({ error: "Sesi marketing diperlukan." }, { status: 401 });
    }

    const admin = createAdminClient();

    // Query partner secara tangguh
    let partnerData: Record<string, unknown> | null = null;
    const { data: partnerWithLevel, error: pError } = await admin
      .from("marketing_partners")
      .select("id, referral_code, status, membership_level, notes_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    if (pError && pError.message?.includes("membership_level")) {
      const { data: partnerFallback } = await admin
        .from("marketing_partners")
        .select("id, referral_code, status, notes_admin")
        .eq("user_id", user.id)
        .maybeSingle();
      partnerData = partnerFallback;
    } else {
      partnerData = partnerWithLevel;
    }

    if (!partnerData) {
      return NextResponse.json({ error: "Akun kemitraan tidak ditemukan." }, { status: 404 });
    }

    if (partnerData.status !== "ACTIVE") {
      return NextResponse.json({ error: "Akun kemitraan Anda sedang dinonaktifkan." }, { status: 403 });
    }

    const isCoord = isCoordinatorLevel(partnerData.membership_level as string | undefined) ||
      (typeof partnerData.notes_admin === "string" && partnerData.notes_admin.includes("[LEVEL:COORDINATOR]"));

    if (!isCoord) {
      return NextResponse.json({ error: "Fitur ini khusus Koordinator Mitra aktif." }, { status: 403 });
    }

    const partnerId = String(partnerData.id);
    const referralCode = String(partnerData.referral_code || "");
    const referralUrl = `${APP_ORIGINS.PUBLIC}/marketing/daftar?ref=${encodeURIComponent(referralCode)}`;

    // Coba panggil RPC report_marketing_network jika ada
    const { data: rpcData, error: rpcError } = await admin.rpc("report_marketing_network", {
      p_partner_id: partnerId,
    });

    if (!rpcError && rpcData) {
      return NextResponse.json(
        { data: { ...rpcData, referralUrl } },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    // Fallback TypeScript calculation jika RPC belum dipasang di database
    let members: Array<{
      id: string;
      name: string;
      area: string;
      status: string;
      tenants: number;
      networkCommission: number;
    }> = [];
    let totalCommission = 0;

    // Cari downlines
    const { data: downlines } = await admin
      .from("marketing_partners")
      .select("id, full_name, city_area, status, notes_admin")
      .order("created_at", { ascending: false });

    // Filter mitra yang memiliki upline = partnerId (baik via kolom upline_id atau via tag di notes_admin)
    const matchingDownlines = (downlines || []).filter((d: Record<string, unknown>) => {
      if (d.upline_id && d.upline_id === partnerId) return true;
      if (typeof d.notes_admin === "string" && d.notes_admin.includes(`[UPLINE:${partnerId}]`)) return true;
      return false;
    });

    // Ambil mutasi komisi jika tabel sudah ada
    const { data: mutations } = await admin
      .from("marketing_commission_mutations")
      .select("total_amount, source_partner_id, kind")
      .eq("partner_id", partnerId)
      .eq("kind", "NETWORK");

    const commBySource: Record<string, number> = {};
    if (mutations && Array.isArray(mutations)) {
      for (const m of mutations) {
        const amt = Number(m.total_amount) || 0;
        totalCommission += amt;
        if (m.source_partner_id) {
          commBySource[m.source_partner_id] = (commBySource[m.source_partner_id] || 0) + amt;
        }
      }
    }

    // Ambil jumlah tenant per downline
    for (const d of matchingDownlines) {
      const { count } = await admin
        .from("warkops")
        .select("id", { count: "exact", head: true })
        .eq("marketing_agent_id", d.id);

      members.push({
        id: String(d.id),
        name: String(d.full_name || "Mitra"),
        area: String(d.city_area || "Wilayah belum diisi"),
        status: String(d.status || "PENDING"),
        tenants: count || 0,
        networkCommission: commBySource[String(d.id)] || 0,
      });
    }

    return NextResponse.json(
      { data: { members, totalCommission, referralUrl } },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    console.error("GET /api/marketing/network error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Jaringan belum dapat dimuat." },
      { status: 500 }
    );
  }
}
