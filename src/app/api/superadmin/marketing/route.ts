import { z } from "zod";
import { paginationSchema } from "@/lib/reporting";
import { createAccount } from "@/lib/create-account";
import { NextResponse } from "next/server";
import { randomDigits } from "@/lib/generated-credentials";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertSameOrigin, DeviceApiError } from "@/lib/device-auth";
import { APP_ORIGINS } from "@/lib/app-origins";
import {
  cleanWhatsAppMessageField,
  createWhatsAppUrl,
  isValidIndonesianWhatsAppNumber,
  normalizeIndonesianWhatsAppNumber,
} from "@/lib/whatsapp";

async function superAdminClient() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user || String(user.app_metadata?.role).toUpperCase() !== "SUPERADMIN") return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Konfigurasi database belum lengkap.");
    const client = createClient(url, key, { auth: { persistSession: false } });
    (client as unknown as { currentUser: typeof user }).currentUser = user;
    return client;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await superAdminClient();
    if (!supabase) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const city = searchParams.get("city");
    if (searchParams.has("page") || searchParams.has("pageSize")) {
      const parsed = paginationSchema.extend({ search: z.string().trim().max(120).default(""), status: z.enum(["ALL", "ACTIVE", "PENDING", "INACTIVE"]).default("ALL") }).safeParse(Object.fromEntries(searchParams));
      if (!parsed.success) return NextResponse.json({ error: "Parameter daftar mitra tidak valid." }, { status: 400 });
      const input = parsed.data;
      const { data, error } = await supabase.rpc("report_superadmin_marketing_page", {
        p_page: input.page, p_page_size: input.pageSize, p_search: input.search, p_status: input.status,
      });
      if (error || !data) return NextResponse.json({ error: "Daftar mitra belum dapat dimuat." }, { status: 503 });
      return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
    }
    // Existing callers (including the tenant registration selector) retain their contract.
    const { data, error } = await supabase.rpc("report_superadmin_marketing", {
      p_status: status && status !== "ALL" ? status : null,
      p_city: city && city !== "ALL" ? city : null,
    });
    if (error) return NextResponse.json({ error: "Data komisi mitra belum dapat dimuat." }, { status: 503 });
    return NextResponse.json({ data: data || [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await superAdminClient();
    if (!supabase) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });

    const body = await request.json();
    if (!body.name || !body.phone || !body.area || !body.referralCode || !body.accountNumber || !body.username || !body.password) {
      return NextResponse.json({ error: "Nama, kontak, wilayah, kode referral, dan rekening wajib diisi." }, { status: 400 });
    }

    const phone = normalizeIndonesianWhatsAppNumber(body.phone);
    if (!isValidIndonesianWhatsAppNumber(phone)) return NextResponse.json({ error: "Nomor WhatsApp marketing tidak valid." }, { status: 400 });
    let username = String(body.username).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (username.length < 4) return NextResponse.json({ error: "Username marketing minimal 4 karakter." }, { status: 400 });
    const { data: rates, error: ratesError } = await supabase.from("platform_settings").select("default_marketing_commission").eq("id", "global").single();
    if (ratesError || !rates) return NextResponse.json({ error: "Parameter komisi belum dapat dibaca." }, { status: 503 });
    const { data: authData, error: authError, username: assignedUsername } = await createAccount(supabase, username, {
      password: String(body.password),
      email_confirm: true,
      app_metadata: { role: "MARKETING" },
      user_metadata: { role: "MARKETING" },
    });
    username = assignedUsername;
    if (authError || !authData.user) return NextResponse.json({ error: authError?.message || "Akun marketing gagal dibuat." }, { status: 500 });

    const { data, error } = await supabase.from("marketing_partners").insert({
      full_name: String(body.name).trim(),
      phone,
      city_area: String(body.area).trim(),
      referral_code: String(body.referralCode).trim().toUpperCase(),
      commission_rate: Number(rates.default_marketing_commission),
      bank_name: String(body.bankName || "-").trim(),
      bank_account_number: String(body.accountNumber).trim(),
      bank_account_name: String(body.accountName || body.name).trim(),
      status: "ACTIVE",
      user_id: authData.user.id,
      username,
    }).select().single();

    if (error) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await supabase.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { role: "MARKETING", marketing_partner_id: data.id },
      user_metadata: { role: "MARKETING", marketing_partner_id: data.id, referral_code: data.referral_code },
    });
    try {
      await supabase.from("marketing_agents").upsert({
        id: data.id,
        nama: data.full_name,
        phone: data.phone,
        area: data.city_area || "Umum",
        referral_code: data.referral_code,
        commission_per_receipt: Number(data.commission_rate) || 0,
        bank_name: data.bank_name,
        bank_account_number: data.bank_account_number,
        bank_account_name: data.bank_account_name,
        is_active: true,
      });
    } catch (syncErr) {
      console.warn("Peringatan sinkronisasi marketing_agents:", syncErr);
    }
    const message = [
      `Halo ${cleanWhatsAppMessageField(data.full_name)}, akun Marketing OKESIH Anda sudah aktif. 🎉`, "",
      `Kode referral: *${data.referral_code}*`,
      `Username:\n\`${username}\``,
      `Password:\n\`${String(body.password)}\``,
      `Login: ${APP_ORIGINS.PUBLIC}/login`, "",
      "Setelah login, buka Dashboard Marketing lalu tekan Install Aplikasi agar OKESIH tersimpan di layar utama HP.",
      "Mohon segera ganti dan simpan kredensial dengan aman.", "", "Salam,", "Tim OKESIH",
    ].join("\n");
    return NextResponse.json({
      success: true,
      data,
      credentials: { username, password: String(body.password) },
      whatsappUrl: createWhatsAppUrl(phone, message),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Terjadi kesalahan internal." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await superAdminClient();
    if (!supabase) return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });

    const body = await request.json();
    const { id, status, commissionRate, notesAdmin, membershipLevel, uplineId } = body;

    if (!id) {
      return NextResponse.json({ error: "ID marketing partner diperlukan." }, { status: 400 });
    }

    const { data: current, error: currentError } = await supabase
      .from("marketing_partners")
      .select("*")
      .eq("id", id)
      .single();
    if (currentError || !current) {
      return NextResponse.json({ error: currentError?.message || "Mitra marketing tidak ditemukan." }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {};
    if (status) updatePayload.status = status;
    if (commissionRate !== undefined) return NextResponse.json({ error: "Tarif komisi diatur melalui Parameter Master Global." }, { status: 400 });

    let targetNotes = notesAdmin !== undefined ? notesAdmin : current.notes_admin;
    let targetLevel: string | undefined = undefined;

    // Validasi penegakan batas 2 level kemitraan
    if (membershipLevel !== undefined) {
      const isCoord = String(membershipLevel).toUpperCase() === "COORDINATOR" || String(membershipLevel).toUpperCase() === "KOORDINATOR";
      targetLevel = isCoord ? "COORDINATOR" : "MITRA";

      if (isCoord) {
        // 1. Koordinator tidak boleh memiliki upline (dilarang multi-tier > 2 level)
        const hasExistingUpline = Boolean(current.upline_id) ||
          (typeof current.notes_admin === "string" && current.notes_admin.includes("[UPLINE:"));
        if (hasExistingUpline) {
          return NextResponse.json({
            error: "Mitra yang masih memiliki upline tidak dapat diangkat menjadi Koordinator. Lepaskan hubungan upline terlebih dahulu agar batas 2 level kemitraan terjaga."
          }, { status: 400 });
        }

        // 2. Koordinator harus berstatus aktif
        const finalStatus = status || current.status;
        if (finalStatus !== "ACTIVE") {
          return NextResponse.json({
            error: "Hanya mitra aktif yang dapat diangkat menjadi Koordinator Mitra."
          }, { status: 400 });
        }

        updatePayload.upline_id = null;
        targetNotes = (targetNotes || "").replace(/\[UPLINE:[^\]]+\]/g, "").trim();
      } else {
        // Jika mencabut status Koordinator, pastikan tidak ada downline yang menggantung
        const { count: downlineCount, error: downlineError } = await supabase
          .from("marketing_partners")
          .select("id", { count: "exact", head: true })
          .eq("upline_id", id);

        if (downlineError) return NextResponse.json({ error: "Relasi mitra belum dapat diperiksa." }, { status: 503 });
        if (downlineCount && downlineCount > 0) {
          return NextResponse.json({
            error: `Tidak dapat mencabut status Koordinator karena masih memiliki ${downlineCount} mitra downline binaan. Alihkan atau lepaskan downline terlebih dahulu.`
          }, { status: 400 });
        }
      }

      updatePayload.membership_level = targetLevel;
      const cleanNotes = (targetNotes || "").replace(/\[LEVEL:(?:COORDINATOR|MITRA)\]/g, "").trim();
      targetNotes = `${cleanNotes} [LEVEL:${targetLevel}]`.trim();
    }

    // Validasi pengaturan upline_id
    if (uplineId !== undefined) {
      if (uplineId) {
        if (uplineId === id) {
          return NextResponse.json({ error: "Mitra tidak dapat menjadi upline untuk dirinya sendiri." }, { status: 400 });
        }
        if (targetLevel === "COORDINATOR" || (!targetLevel && current.membership_level === "COORDINATOR")) {
          return NextResponse.json({ error: "Koordinator Mitra tidak diperbolehkan memiliki upline." }, { status: 400 });
        }

        const { data: uplinePartner, error: upError } = await supabase
          .from("marketing_partners")
          .select("id, full_name, status, membership_level, upline_id, notes_admin")
          .eq("id", uplineId)
          .maybeSingle();

        if (upError || !uplinePartner) {
          return NextResponse.json({ error: "Data koordinator upline tidak ditemukan." }, { status: 404 });
        }
        if (uplinePartner.status !== "ACTIVE") {
          return NextResponse.json({ error: "Koordinator upline harus berstatus aktif." }, { status: 400 });
        }
        const isUplineCoord = uplinePartner.membership_level === "COORDINATOR";
        if (!isUplineCoord) {
          return NextResponse.json({ error: "Upline yang dipilih harus berstatus Koordinator Mitra." }, { status: 400 });
        }
        const uplineHasUpline = Boolean(uplinePartner.upline_id) ||
          (typeof uplinePartner.notes_admin === "string" && uplinePartner.notes_admin.includes("[UPLINE:"));
        if (uplineHasUpline) {
          return NextResponse.json({ error: "Upline tidak boleh memiliki upline lain (maksimal 2 level jaringan kemitraan)." }, { status: 400 });
        }

        updatePayload.upline_id = uplineId;
        const cleanUplineNotes = (targetNotes || "").replace(/\[UPLINE:[^\]]+\]/g, "").trim();
        targetNotes = `${cleanUplineNotes} [UPLINE:${uplineId}]`.trim();
      } else {
        updatePayload.upline_id = null;
        targetNotes = (targetNotes || "").replace(/\[UPLINE:[^\]]+\]/g, "").trim();
      }
    }

    if (targetNotes !== undefined) updatePayload.notes_admin = targetNotes;

    let createdAuthUserId: string | null = null;
    let username: string | null = null;
    let password: string | null = null;
    if (status === "ACTIVE" && !current.user_id) {
      if (!isValidIndonesianWhatsAppNumber(current.phone)) return NextResponse.json({ error: "Perbaiki nomor WhatsApp sebelum mengaktifkan marketing." }, { status: 400 });
      const suffix = randomDigits(3);
      username = `marketing_${suffix}`;
      password = randomDigits(6);
      const { data: authData, error: authError, username: assignedUsername } = await createAccount(supabase, username, {
        password,
        email_confirm: true,
        app_metadata: { role: "MARKETING", marketing_partner_id: id },
        user_metadata: { role: "MARKETING", marketing_partner_id: id, referral_code: current.referral_code },
      });
      username = assignedUsername;
      if (authError || !authData.user) {
        return NextResponse.json({ error: authError?.message || "Akun marketing gagal dibuat." }, { status: 500 });
      }
      createdAuthUserId = authData.user.id;
      updatePayload.user_id = authData.user.id;
      updatePayload.username = username;
    }

    const savePartner = () => {
      let query = supabase.from("marketing_partners").update(updatePayload).eq("id", id);
      if (createdAuthUserId) query = query.is("user_id", null).eq("status", current.status).eq("phone", current.phone);
      return query.select().maybeSingle();
    };
    let { data, error } = await savePartner();

    if (error && createdAuthUserId) {
      const { data: persisted, error: readError } = await supabase.from("marketing_partners").select("*").eq("id", id).maybeSingle();
      if (readError) return NextResponse.json({ error: "Status aktivasi belum dapat dipastikan. Muat ulang untuk memeriksa akun sebelum mengulang." }, { status: 503 });
      if (persisted?.user_id === createdAuthUserId) { data = persisted; error = null; }
    }
    if (error || !data) {
      if (createdAuthUserId) await supabase.auth.admin.deleteUser(createdAuthUserId);
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error?.message || "Data marketing sudah berubah. Muat ulang sebelum memverifikasi kembali." }, { status: error ? 500 : 409 });
    }

    // Normalisasi membership_level pada respons
    const resolvedLevel = data?.membership_level || (data?.notes_admin?.includes("[LEVEL:COORDINATOR]") ? "COORDINATOR" : "MITRA");
    const enrichedData = { ...data, membership_level: resolvedLevel };

    let whatsappUrl: string | null = null;
    if (username && password) {
      const message = [
        `Halo ${cleanWhatsAppMessageField(data.full_name)}, pendaftaran Marketing OKESIH Anda telah disetujui. 🎉`,
        "",
        `Kode referral: *${cleanWhatsAppMessageField(data.referral_code)}*`,
        `Username:\n\`${username}\``,
        `Password sementara:\n\`${password}\``,
        `Login: ${APP_ORIGINS.PUBLIC}/login`,
        "",
        "Silakan login, ganti password sementara di dashboard, lalu pasang aplikasi Marketing OKESIH.",
      ].join("\n");
      whatsappUrl = createWhatsAppUrl(data.phone, message);
    } else if (membershipLevel !== undefined) {
      const isPromoted = targetLevel === "COORDINATOR";
      const message = isPromoted
        ? [
            `Halo ${cleanWhatsAppMessageField(data.full_name)}, selamat! Anda telah diangkat menjadi *Koordinator Mitra* OKESIH. 🎉`,
            "",
            "Menu KorMit kini telah aktif di akun Anda. Anda dapat mulai merekrut dan membina jaringan mitra marketing baru menggunakan link referral Anda di aplikasi.",
            "",
            "Buka Dashboard Marketing Anda untuk melihat menu *KorMit*.",
            "",
            "Salam,",
            "Admin OKESIH",
          ].join("\n")
        : [
            `Halo ${cleanWhatsAppMessageField(data.full_name)}, status keanggotaan Anda telah disesuaikan kembali menjadi *Mitra Marketing*.`,
            "",
            "Salam,",
            "Admin OKESIH",
          ].join("\n");
      whatsappUrl = createWhatsAppUrl(data.phone, message);
    }

    return NextResponse.json({ success: true, data: enrichedData, whatsappUrl }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const supabase = await superAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Akses Super Admin diperlukan." }, { status: 401 });
    }
    const user = (supabase as unknown as { currentUser: { id: string; email?: string } }).currentUser;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID mitra marketing diperlukan." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("delete_marketing_partner_safely", { p_partner_id: id, p_admin_id: user.id });
    if (error || !data) {
      const status = error?.code === "P0001" ? 409 : error?.code === "P0002" ? 404 : 503;
      return NextResponse.json({ error: status === 503 ? "Penghapusan belum dapat dipastikan. Muat ulang data sebelum mencoba lagi." : error?.message }, { status });
    }
    let authCleanupPending = false;
    if (data.userId) {
      const result = await supabase.auth.admin.deleteUser(data.userId);
      authCleanupPending = Boolean(result.error);
      if (result.error) console.error("Marketing auth cleanup pending", { partnerId: id, userId: data.userId });
    }
    return NextResponse.json({ success: true, authCleanupPending,
      message: `Mitra marketing ${data.name} berhasil dihapus.${authCleanupPending ? " Akun login belum terhapus; akses mitra telah terputus." : ""}`,
      detachedTenantsCount: data.detachedTenantsCount,
    });
  } catch (err: unknown) {
    if (err instanceof DeviceApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal saat menghapus marketing." },
      { status: 500 }
    );
  }
}
