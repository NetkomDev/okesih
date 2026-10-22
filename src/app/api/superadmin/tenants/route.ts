import { createAccount } from "@/lib/create-account";
import { z } from "zod";
import { paginationSchema } from "@/lib/reporting";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/device-auth";
import { APP_ORIGINS } from "@/lib/app-origins";
import {
  cleanWhatsAppMessageField,
  createWhatsAppUrl,
  isValidIndonesianWhatsAppNumber,
  normalizeIndonesianWhatsAppNumber,
} from "@/lib/whatsapp";

async function superAdminClient() {
  const sessionClient = await createServerSupabaseClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user || String(user.app_metadata?.role).toUpperCase() !== "SUPERADMIN") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi database belum lengkap.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  try {
    const supabase = await superAdminClient();
    if (!supabase) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });
    const query = paginationSchema.extend({ search: z.string().trim().max(120).default(""), province: z.string().max(100).default("") })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const { data, error } = await supabase.rpc("report_superadmin_tenants", {
      p_page: query.page, p_page_size: query.pageSize, p_search: query.search, p_province: query.province,
    });
    if (error) throw error;
    return NextResponse.json({ ...data, data: data.data.map((tenant: { joinedAt: string }) => ({
      ...tenant, joinedDate: new Date(tenant.joinedAt).toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short", year: "numeric" }),
    })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof z.ZodError ? "Parameter pencarian atau halaman tidak valid." : err instanceof Error ? err.message : "Gagal memuat tenant." }, { status: err instanceof z.ZodError ? 400 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await superAdminClient();
    if (!supabase) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });

    const body = await request.json();
    const {
      name,
      slug,
      ownerName,
      phone,
      address,
      province,
      cityRegency,
      uniqueCodeRange,
      marketingAgentId,
      commissionPerReceipt,
      username,
      password,
    } = body;

    if (!name || !slug || !ownerName || !phone || !address || !province || !cityRegency || !username || !password) {
      return NextResponse.json(
        { error: "Data tenant, alamat, wilayah, nomor WhatsApp, dan kredensial owner wajib diisi." },
        { status: 400 }
      );
    }

    const ownerWhatsApp = normalizeIndonesianWhatsAppNumber(phone);
    if (!isValidIndonesianWhatsAppNumber(ownerWhatsApp)) {
      return NextResponse.json(
        { error: "Nomor WhatsApp owner tidak valid. Gunakan nomor Indonesia aktif, misalnya 081234567890." },
        { status: 400 }
      );
    }

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

    const targetMarketingAgentId = marketingAgentId === "direct" ? null : marketingAgentId;

    // Pastikan kompatibilitas foreign key warkops_marketing_agent_id_fkey dengan menyinkronkan data partner ke marketing_agents
    if (targetMarketingAgentId) {
      try {
        const { data: partnerRow } = await supabase
          .from("marketing_partners")
          .select("id, full_name, phone, city_area, referral_code, commission_rate, status, bank_name, bank_account_number, bank_account_name")
          .eq("id", targetMarketingAgentId)
          .maybeSingle();

        if (partnerRow) {
          await supabase.from("marketing_agents").upsert({
            id: partnerRow.id,
            nama: partnerRow.full_name,
            phone: partnerRow.phone,
            area: partnerRow.city_area || "Umum",
            referral_code: partnerRow.referral_code,
            commission_per_receipt: Number(partnerRow.commission_rate) || 15,
            bank_name: partnerRow.bank_name,
            bank_account_number: partnerRow.bank_account_number,
            bank_account_name: partnerRow.bank_account_name,
            is_active: partnerRow.status === "ACTIVE",
          });
        }
      } catch (syncErr) {
        console.warn("Peringatan sinkronisasi marketing_agents:", syncErr);
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
        address: address.trim(),
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
    let finalOwnerUsername = String(username).trim().toLowerCase();
    const { data: authData, error: authError, username: assignedUsername } = await createAccount(supabase, finalOwnerUsername, {
      password: String(password),
      email_confirm: true,
      app_metadata: { role: "OWNER", warkop_id: newWarkop.id },
      user_metadata: { role: "OWNER", warkop_id: newWarkop.id, warkop_slug: newWarkop.slug },
    });
    finalOwnerUsername = assignedUsername;
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

    // Tenant baru harus menyelesaikan penggantian password dan onboarding PWA
    // pada login pertamanya. Akun owner lama dibackfill sebagai sudah selesai
    // oleh migrasi 12 agar rilis ini tidak mengunci pengguna yang sudah aktif.
    const { error: onboardingError } = await supabase.from("owner_onboarding").insert({
      warkop_id: newWarkop.id,
      owner_user_id: authData.user.id,
    });
    if (onboardingError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from("warkops").delete().eq("id", newWarkop.id);
      return NextResponse.json(
        { error: `Onboarding owner gagal disiapkan: ${onboardingError.message}` },
        { status: 500 }
      );
    }

    // 3. Siapkan pesan untuk dibuka dan dikirim oleh Super Admin melalui
    // aplikasi WhatsApp pada perangkatnya, tanpa pengiriman otomatis/API.
    const welcomeMessage = [
      `Halo ${cleanWhatsAppMessageField(ownerName)}, selamat datang di OKESIH! 🎉`,
      "",
      `Aplikasi Kasir *${cleanWhatsAppMessageField(newWarkop.nama)}* Anda telah aktif dan siap digunakan.`,
      "",
      "Berikut kredensial login Owner:",
      `Username:\n\`${finalOwnerUsername}\``,
      `Password:\n\`${String(password)}\``,
      `Login: ${APP_ORIGINS.PUBLIC}/login`,
      `Menu usaha: ${APP_ORIGINS.PUBLIC}/menu/${newWarkop.slug}`,
      "",
      "Mohon simpan data ini dengan aman dan segera ganti password setelah login pertama.",
      "",
      "Salam,",
      "Tim OKESIH",
    ].join("\n");

    const whatsappUrl = createWhatsAppUrl(ownerWhatsApp, welcomeMessage);

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
        username: finalOwnerUsername,
        id: newWarkop.id,
        name: newWarkop.nama,
        slug: newWarkop.slug,
        ownerName: ownerName.trim(),
        phone: `+${ownerWhatsApp}`,
        address: newWarkop.address,
        province: newWarkop.province,
        cityRegency: newWarkop.city_regency,
        uniqueCodeRange: `${rangeStart} - ${rangeEnd}`,
        marketingAgentId: newWarkop.marketing_agent_id || "direct",
        commissionPerReceipt: Number(newWarkop.marketing_commission_per_receipt) || 0,
        status: "ACTIVE",
        joinedDate: "Hari Ini",
        whatsappUrl,
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
    assertSameOrigin(request);
    const supabase = await superAdminClient();
    if (!supabase) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });

    const body = await request.json();
    const { id, is_active } = body;

    if (!id || typeof is_active !== "boolean") {
      return NextResponse.json({ error: "ID dan status is_active diperlukan." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("warkops")
      .update({ is_active })
      .eq("id", id)
      .is("archived_at", null)
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

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await superAdminClient();
    if (!admin) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 403 });
    const session = await createServerSupabaseClient();
    const { data: { user } } = await session.auth.getUser();
    const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    const { data, error } = await admin.rpc("archive_tenant_and_purge_finance", { p_warkop_id: id, p_actor: user!.id });
    if (error) throw error;
    return NextResponse.json({ success: true, data, message: "Tenant diarsipkan; transaksi, billing, dan komisi terkait telah dihapus." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "ID tenant tidak valid." : "Pengarsipan gagal. Tidak ada penghapusan sebagian." }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
