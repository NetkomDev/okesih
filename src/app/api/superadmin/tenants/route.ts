import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Konfigurasi server database belum lengkap." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Ambil seluruh data warkop
    const { data: warkops, error: warkopErr } = await supabase
      .from("warkops")
      .select("*")
      .order("created_at", { ascending: false });

    if (warkopErr) {
      console.error("Supabase warkops error:", warkopErr);
      return NextResponse.json({ error: warkopErr.message }, { status: 500 });
    }

    // 2. Ambil data owners dari warkop_members
    const { data: members } = await supabase
      .from("warkop_members")
      .select("warkop_id, username, role")
      .eq("role", "OWNER");

    // 3. Ambil data marketing partners untuk mapping nama agen
    const { data: marketings } = await supabase
      .from("marketing_partners")
      .select("id, full_name, referral_code");

    const marketingMap = new Map<string, { name: string; code: string }>();
    marketings?.forEach((m) => {
      marketingMap.set(m.id, { name: m.full_name, code: m.referral_code });
    });

    const ownerMap = new Map<string, string>();
    members?.forEach((mem) => {
      if (!ownerMap.has(mem.warkop_id)) {
        ownerMap.set(mem.warkop_id, mem.username);
      }
    });

    // Format data ke format TenantWarkop dashboard
    const formattedTenants = (warkops || []).map((w) => {
      const start = w.unique_code_range_start || 100;
      const end = w.unique_code_range_end || 199;
      const mktInfo = w.marketing_agent_id ? marketingMap.get(w.marketing_agent_id) : null;

      return {
        id: w.id,
        name: w.nama,
        slug: w.slug,
        ownerName: ownerMap.get(w.id) || "Owner Warkop",
        phone: "0812xxxxxxx",
        province: w.province || "Belum diatur",
        cityRegency: w.city_regency || "Belum diatur",
        uniqueCodeRange: `${start} - ${end}`,
        marketingAgentId: w.marketing_agent_id || "direct",
        marketingAgentName: mktInfo ? `${mktInfo.name} (${mktInfo.code})` : "Direct HQ (Tanpa Marketing)",
        commissionPerReceipt: Number(w.marketing_commission_per_receipt) || 0,
        todayTransactions: 0, // Akan diakumulasi dari transaksi shift riil
        totalSaasBilling: 0,
        paymentStatus: "PAID",
        status: w.is_active ? "ACTIVE" : "SUSPENDED",
        joinedDate: new Date(w.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      };
    });

    return NextResponse.json({ data: formattedTenants });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal server." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Konfigurasi server database belum lengkap." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      name,
      slug,
      ownerName,
      phone,
      province,
      cityRegency,
      uniqueCodeRange,
      marketingAgentId,
      commissionPerReceipt,
      username,
    } = body;

    if (!name || !slug || !province || !cityRegency) {
      return NextResponse.json(
        { error: "Nama warkop, slug, provinsi, dan kota/kabupaten wajib diisi." },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parsing rentang kode unik (misal "500 - 599")
    let rangeStart = 100;
    let rangeEnd = 199;
    if (uniqueCodeRange && typeof uniqueCodeRange === "string") {
      const parts = uniqueCodeRange.split("-").map((s: string) => parseInt(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        rangeStart = parts[0];
        rangeEnd = parts[1];
      }
    }

    // 1. Insert ke tabel warkops
    const { data: newWarkop, error: warkopErr } = await supabase
      .from("warkops")
      .insert({
        nama: name.trim(),
        slug: slug.trim().toLowerCase(),
        province: province.trim(),
        city_regency: cityRegency.trim(),
        unique_code_range_start: rangeStart,
        unique_code_range_end: rangeEnd,
        marketing_agent_id: marketingAgentId === "direct" ? null : marketingAgentId,
        marketing_commission_per_receipt: Number(commissionPerReceipt) || 0,
        is_active: true,
      })
      .select()
      .single();

    if (warkopErr) {
      console.error("Gagal insert warkop:", warkopErr);
      return NextResponse.json({ error: warkopErr.message }, { status: 500 });
    }

    // 2. Insert owner ke warkop_members
    const finalOwnerUsername = username || `owner_${slug.replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
    await supabase.from("warkop_members").insert({
      warkop_id: newWarkop.id,
      username: finalOwnerUsername,
      role: "OWNER",
    });

    // 3. Update counter akuisisi marketing jika diasosiasikan
    if (marketingAgentId && marketingAgentId !== "direct") {
      // Ambil counter lama
      const { data: mktData } = await supabase
        .from("marketing_partners")
        .select("total_tenants_acquired")
        .eq("id", marketingAgentId)
        .single();

      if (mktData) {
        await supabase
          .from("marketing_partners")
          .update({
            total_tenants_acquired: (mktData.total_tenants_acquired || 0) + 1,
          })
          .eq("id", marketingAgentId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newWarkop.id,
        name: newWarkop.nama,
        slug: newWarkop.slug,
        ownerName: ownerName || finalOwnerUsername,
        phone: phone || "-",
        province: newWarkop.province,
        cityRegency: newWarkop.city_regency,
        uniqueCodeRange: `${rangeStart} - ${rangeEnd}`,
        marketingAgentId: newWarkop.marketing_agent_id || "direct",
        commissionPerReceipt: Number(newWarkop.marketing_commission_per_receipt) || 0,
        status: "ACTIVE",
        joinedDate: "Hari Ini",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal server." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Konfigurasi server database belum lengkap." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { id, is_active } = body;

    if (!id || typeof is_active !== "boolean") {
      return NextResponse.json({ error: "ID dan status is_active diperlukan." }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("warkops")
      .update({ is_active })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Gagal update warkop:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal server." },
      { status: 500 }
    );
  }
}
