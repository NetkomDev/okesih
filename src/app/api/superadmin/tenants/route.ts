import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalizeIndonesianWhatsAppNumber(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

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

    const todayWita = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const startTodayUtc = new Date(`${todayWita}T00:00:00+08:00`).toISOString();
    const endTodayUtc = new Date(`${todayWita}T23:59:59.999+08:00`).toISOString();

    // Format data sekaligus mengambil angka operasional riil per tenant.
    const formattedTenants = await Promise.all((warkops || []).map(async (w) => {
      const start = w.unique_code_range_start || 100;
      const end = w.unique_code_range_end || 199;
      const mktInfo = w.marketing_agent_id ? marketingMap.get(w.marketing_agent_id) : null;
      const [{ count: todayTransactions }, { data: billing }] = await Promise.all([
        supabase.from("transactions").select("id", { count: "exact", head: true })
          .eq("warkop_id", w.id)
          .gte("created_at", startTodayUtc)
          .lte("created_at", endTodayUtc)
          .not("status_pesanan", "in", "(VOID,REJECTED)"),
        supabase.from("saas_billings")
          .select("tagihan_pokok, status_bayar")
          .eq("warkop_id", w.id)
          .eq("tanggal", todayWita)
          .maybeSingle(),
      ]);

      return {
        id: w.id,
        name: w.nama,
        slug: w.slug,
        ownerName: w.owner_name || ownerMap.get(w.id) || "Owner Warkop",
        phone: w.owner_phone ? `+${w.owner_phone}` : "Belum diatur",
        province: w.province || "Belum diatur",
        cityRegency: w.city_regency || "Belum diatur",
        uniqueCodeRange: `${start} - ${end}`,
        marketingAgentId: w.marketing_agent_id || "direct",
        marketingAgentName: mktInfo ? `${mktInfo.name} (${mktInfo.code})` : "Direct HQ (Tanpa Marketing)",
        commissionPerReceipt: Number(w.marketing_commission_per_receipt) || 0,
        todayTransactions: todayTransactions || 0,
        totalSaasBilling: Number(billing?.tagihan_pokok) || 0,
        paymentStatus: billing?.status_bayar === "PAID" ? "PAID" : billing ? "UNPAID" : "UNPAID",
        status: w.is_active ? "ACTIVE" : "SUSPENDED",
        joinedDate: new Date(w.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      };
    }));

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
      password,
    } = body;

    if (!name || !slug || !ownerName || !phone || !province || !cityRegency || !username || !password) {
      return NextResponse.json(
        { error: "Data tenant, wilayah, nomor WhatsApp, dan kredensial owner wajib diisi." },
        { status: 400 }
      );
    }

    const ownerWhatsApp = normalizeIndonesianWhatsAppNumber(phone);
    if (!/^628\d{8,11}$/.test(ownerWhatsApp)) {
      return NextResponse.json(
        { error: "Nomor WhatsApp owner tidak valid. Gunakan nomor Indonesia aktif, misalnya 081234567890." },
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
        owner_name: ownerName.trim(),
        owner_phone: ownerWhatsApp,
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

    // 2. Buat akun Auth owner yang benar-benar bisa dipakai login.
    const finalOwnerUsername = username || `owner_${slug.replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
    const ownerEmail = `${finalOwnerUsername.toLowerCase()}@okesih.local`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: String(password),
      email_confirm: true,
      app_metadata: { role: "OWNER", warkop_id: newWarkop.id },
      user_metadata: { role: "OWNER", warkop_id: newWarkop.id, warkop_slug: newWarkop.slug },
    });
    if (authError || !authData.user) {
      await supabase.from("warkops").delete().eq("id", newWarkop.id);
      return NextResponse.json({ error: authError?.message || "Akun owner gagal dibuat." }, { status: 500 });
    }

    const { error: memberError } = await supabase.from("warkop_members").insert({
      warkop_id: newWarkop.id,
      user_id: authData.user.id,
      username: finalOwnerUsername,
      role: "OWNER",
    });
    if (memberError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from("warkops").delete().eq("id", newWarkop.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // 3. Antrekan pesan. Worker WhatsApp Web pada perangkat super admin akan
    // mengirimkannya dari nomor +62 856-9448-8510.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://okesih.com").replace(/\/$/, "");
    const welcomeMessage = [
      `Halo ${ownerName.trim()}, selamat datang di OKESIH! 🎉`,
      "",
      `Tenant *${newWarkop.nama}* Anda telah aktif dan siap digunakan.`,
      "",
      "Berikut kredensial login Owner:",
      `Username: *${finalOwnerUsername}*`,
      `Password: *${String(password)}*`,
      `Login: ${appUrl}/login`,
      "",
      "Mohon simpan data ini dengan aman dan segera ganti password setelah login pertama.",
      "",
      "Salam,",
      "Tim OKESIH",
    ].join("\n");

    const { error: outboxError } = await supabase.from("whatsapp_outbox").insert({
      warkop_id: newWarkop.id,
      recipient_phone: ownerWhatsApp,
      message: welcomeMessage,
    });
    if (outboxError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from("warkops").delete().eq("id", newWarkop.id);
      return NextResponse.json(
        { error: `Tenant dibatalkan karena pesan WhatsApp gagal diantrekan: ${outboxError.message}` },
        { status: 500 }
      );
    }

    // 4. Update counter akuisisi marketing jika diasosiasikan
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
        ownerName: ownerName.trim(),
        phone: `+${ownerWhatsApp}`,
        province: newWarkop.province,
        cityRegency: newWarkop.city_regency,
        uniqueCodeRange: `${rangeStart} - ${rangeEnd}`,
        marketingAgentId: newWarkop.marketing_agent_id || "direct",
        commissionPerReceipt: Number(newWarkop.marketing_commission_per_receipt) || 0,
        status: "ACTIVE",
        joinedDate: "Hari Ini",
        whatsappQueued: true,
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
