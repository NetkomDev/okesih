import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Konfigurasi server database belum lengkap." },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const city = searchParams.get("city");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Konfigurasi database belum lengkap." }, { status: 500 });

    const body = await request.json();
    if (!body.name || !body.phone || !body.area || !body.referralCode || !body.accountNumber || !body.username || !body.password) {
      return NextResponse.json({ error: "Nama, kontak, wilayah, kode referral, dan rekening wajib diisi." }, { status: 400 });
    }

    const supabase = createClient(url, key);
    const phone = normalizePhone(body.phone);
    if (!/^628\d{8,11}$/.test(phone)) return NextResponse.json({ error: "Nomor WhatsApp marketing tidak valid." }, { status: 400 });
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
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://okesih.com").replace(/\/$/, "");
    const message = [
      `Halo ${data.full_name}, akun Marketing OKESIH Anda sudah aktif. 🎉`, "",
      `Kode referral: *${data.referral_code}*`,
      `Username: *${username}*`,
      `Password: *${String(body.password)}*`,
      `Login: ${appUrl}/login`, "",
      "Setelah login, buka Dashboard Marketing lalu tekan Install Aplikasi agar OKESIH tersimpan di layar utama HP.",
      "Mohon segera ganti dan simpan kredensial dengan aman.", "", "Salam,", "Tim OKESIH",
    ].join("\n");
    const { error: outboxError } = await supabase.from("whatsapp_outbox").insert({ recipient_phone: phone, message });
    if (outboxError) {
      await supabase.from("marketing_partners").delete().eq("id", data.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: `Marketing dibatalkan karena WhatsApp gagal diantrekan: ${outboxError.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true, data, credentials: { username, password: String(body.password) }, whatsappQueued: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Terjadi kesalahan internal." }, { status: 500 });
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
    const { id, status, commissionRate, notesAdmin } = body;

    if (!id) {
      return NextResponse.json({ error: "ID marketing partner diperlukan." }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const updatePayload: Record<string, unknown> = {};
    if (status) updatePayload.status = status;
    if (commissionRate !== undefined) updatePayload.commission_rate = commissionRate;
    if (notesAdmin !== undefined) updatePayload.notes_admin = notesAdmin;

    const { data, error } = await supabase
      .from("marketing_partners")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal." },
      { status: 500 }
    );
  }
}
