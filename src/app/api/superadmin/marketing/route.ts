import { NextResponse } from "next/server";
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

    let query = supabase
      .from("marketing_partners")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (city && city !== "ALL") {
      query = query.ilike("city_area", `%${city}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enriched = (data || []).map((row: Record<string, unknown>) => ({
      ...row,
      membership_level: row.membership_level || (typeof row.notes_admin === "string" && row.notes_admin.includes("[LEVEL:COORDINATOR]") ? "COORDINATOR" : "MITRA"),
    }));

    return NextResponse.json({ data: enriched });
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
    const username = String(body.username).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (username.length < 4) return NextResponse.json({ error: "Username marketing minimal 4 karakter." }, { status: 400 });
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: `${username}@okesih.local`,
      password: String(body.password),
      email_confirm: true,
      app_metadata: { role: "MARKETING" },
      user_metadata: { role: "MARKETING" },
    });
    if (authError || !authData.user) return NextResponse.json({ error: authError?.message || "Akun marketing gagal dibuat." }, { status: 500 });

    const { data, error } = await supabase.from("marketing_partners").insert({
      full_name: String(body.name).trim(),
      phone,
      city_area: String(body.area).trim(),
      referral_code: String(body.referralCode).trim().toUpperCase(),
      commission_rate: Number(body.commissionPerReceipt) || 0,
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
        commission_per_receipt: Number(data.commission_rate) || 15,
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
      `Username: *${username}*`,
      `Password: *${String(body.password)}*`,
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
    if (commissionRate !== undefined) updatePayload.commission_rate = commissionRate;

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
        const { count: downlineCount } = await supabase
          .from("marketing_partners")
          .select("id", { count: "exact", head: true })
          .eq("upline_id", id);

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
        const isUplineCoord = uplinePartner.membership_level === "COORDINATOR" ||
          (typeof uplinePartner.notes_admin === "string" && uplinePartner.notes_admin.includes("[LEVEL:COORDINATOR]"));
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
      const suffix = `${Date.now()}`.slice(-6);
      username = `marketing_${suffix}`;
      password = `okesih${suffix}!`;
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: `${username}@okesih.local`,
        password,
        email_confirm: true,
        app_metadata: { role: "MARKETING", marketing_partner_id: id },
        user_metadata: { role: "MARKETING", marketing_partner_id: id, referral_code: current.referral_code },
      });
      if (authError || !authData.user) {
        return NextResponse.json({ error: authError?.message || "Akun marketing gagal dibuat." }, { status: 500 });
      }
      createdAuthUserId = authData.user.id;
      updatePayload.user_id = authData.user.id;
      updatePayload.username = username;
    }

    let { data, error } = await supabase
      .from("marketing_partners")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    // Fallback jika kolom membership_level belum ada di DB
    if (error && error.message?.includes("membership_level")) {
      console.warn("Kolom membership_level belum ada di schema DB, menyimpan dengan fallback notes_admin...");
      delete updatePayload.membership_level;
      const retry = await supabase
        .from("marketing_partners")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (createdAuthUserId) await supabase.auth.admin.deleteUser(createdAuthUserId);
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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
        `Username: *${username}*`,
        `Password sementara: *${password}*`,
        `Login: ${APP_ORIGINS.PUBLIC}/login`,
        "",
        "Silakan login, simpan kredensial dengan aman, lalu pasang aplikasi Marketing OKESIH.",
      ].join("\n");
      whatsappUrl = createWhatsAppUrl(data.phone, message);
    } else if (membershipLevel !== undefined) {
      const isPromoted = targetLevel === "COORDINATOR";
      const message = isPromoted
        ? [
            `Halo ${cleanWhatsAppMessageField(data.full_name)}, selamat! Anda telah diangkat menjadi *Koordinator Mitra* OKESIH. 🎉`,
            "",
            "Fitur Jaringan kini telah aktif di akun Anda. Anda dapat mulai merekrut dan membina jaringan mitra marketing baru menggunakan link referral Anda di aplikasi.",
            "",
            "Buka Dashboard Marketing Anda untuk melihat menu *Jaringan Saya*.",
            "",
            "Salam,",
            "Super Admin OKESIH",
          ].join("\n")
        : [
            `Halo ${cleanWhatsAppMessageField(data.full_name)}, status keanggotaan Anda telah disesuaikan kembali menjadi *Mitra Marketing*.`,
            "",
            "Salam,",
            "Super Admin OKESIH",
          ].join("\n");
      whatsappUrl = createWhatsAppUrl(data.phone, message);
    }

    return NextResponse.json({ success: true, data: enrichedData, whatsappUrl });
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

    // 1. Ambil data mitra marketing yang akan dihapus
    const { data: partner, error: fetchError } = await supabase
      .from("marketing_partners")
      .select("id, full_name, phone, referral_code, user_id, username")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !partner) {
      return NextResponse.json({ error: fetchError?.message || "Data mitra marketing tidak ditemukan." }, { status: 404 });
    }

    // 2. Putuskan hubungan upline bagi mitra lain yang menjadikan mitra ini sebagai upline
    await supabase
      .from("marketing_partners")
      .update({ upline_id: null })
      .eq("upline_id", id);

    // 3. Putuskan hubungan tenant binaan dan reset komisi marketing per struk menjadi 0
    // Tenant binaan tetap aman, aktif, dan beroperasi normal seperti tenant yang didaftar langsung oleh Super Admin
    const { data: affectedWarkops, error: warkopUpdateError } = await supabase
      .from("warkops")
      .update({
        marketing_agent_id: null,
        marketing_commission_per_receipt: 0,
      })
      .eq("marketing_agent_id", id)
      .select("id, nama");

    if (warkopUpdateError) {
      console.error("Gagal melepaskan tenant binaan:", warkopUpdateError);
      return NextResponse.json({ error: "Gagal memperbarui relasi tenant binaan." }, { status: 500 });
    }

    // 4. Bersihkan antrean pengajuan tenant dari mitra ini
    await supabase
      .from("tenant_applications")
      .delete()
      .eq("marketing_partner_id", id);

    // 5. Bersihkan riwayat pengajuan pencairan komisi mitra ini
    await supabase
      .from("marketing_commission_withdrawals")
      .delete()
      .eq("marketing_partner_id", id);

    // 6. Bersihkan buku mutasi komisi mitra ini (baik sebagai partner_id maupun source_partner_id)
    await supabase
      .from("marketing_commission_mutations")
      .delete()
      .or(`partner_id.eq.${id},source_partner_id.eq.${id}`);

    // 7. Bersihkan data sinkronisasi di tabel marketing_agents
    await supabase
      .from("marketing_agents")
      .delete()
      .eq("id", id);

    // 8. Hapus record utama dari marketing_partners
    const { error: deletePartnerError } = await supabase
      .from("marketing_partners")
      .delete()
      .eq("id", id);

    if (deletePartnerError) {
      console.error("Gagal menghapus marketing_partners:", deletePartnerError);
      return NextResponse.json({ error: deletePartnerError.message }, { status: 500 });
    }

    // 9. Hapus akun Supabase Auth marketing jika terdaftar
    if (partner.user_id) {
      try {
        await supabase.auth.admin.deleteUser(partner.user_id);
      } catch (authDeleteErr) {
        console.warn("Peringatan saat menghapus auth user marketing:", authDeleteErr);
      }
    } else if (partner.username) {
      try {
        const { data: usersData } = await supabase.auth.admin.listUsers();
        const targetEmail = `${partner.username.toLowerCase()}@okesih.local`;
        const matched = usersData?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
        if (matched) {
          await supabase.auth.admin.deleteUser(matched.id);
        }
      } catch (authListErr) {
        console.warn("Peringatan saat mencari auth user marketing:", authListErr);
      }
    }

    // 10. Catat aktivitas ke audit_logs
    try {
      await supabase.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "MARKETING_PARTNER_DELETED",
        target_type: "marketing_partner",
        target_id: id,
        metadata: {
          partner_name: partner.full_name,
          phone: partner.phone,
          referral_code: partner.referral_code,
          username: partner.username,
          user_id: partner.user_id,
          detached_tenants_count: affectedWarkops?.length || 0,
          detached_tenants: (affectedWarkops || []).map((w: { id: string; nama: string }) => ({ id: w.id, nama: w.nama })),
        },
      });
    } catch (auditErr) {
      console.warn("Peringatan pencatatan audit log:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: `Mitra marketing ${partner.full_name} (${partner.referral_code}) berhasil dihapus permanen.`,
      detachedTenantsCount: affectedWarkops?.length || 0,
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
