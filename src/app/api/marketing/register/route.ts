import { NextRequest, NextResponse } from "next/server";
import { createRegistrationToken, readRegistrationToken, MARKETING_REGISTRATION_COOKIE, MARKETING_REGISTRATION_TTL } from "@/lib/marketing-registration";
import type { MarketingRegistration } from "@/lib/marketing-registration-types";
import { createClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/device-auth";
import {
  cleanWhatsAppMessageField,
  createWhatsAppUrl,
  getSuperAdminWhatsAppNumber,
  isValidIndonesianWhatsAppNumber,
  normalizeIndonesianWhatsAppNumber,
} from "@/lib/whatsapp";

type RegistrationRow = {
  id: string; full_name: string; phone: string; email: string | null;
  city_area: string; bank_name: string; bank_account_number: string;
  bank_account_name: string; experience_notes: string | null;
  referral_code: string; status: string; created_at: string; user_id: string | null;
};

const registrationColumns = "id,full_name,phone,email,city_area,bank_name,bank_account_number,bank_account_name,experience_notes,referral_code,status,created_at,user_id";

function registrationResponse(data: RegistrationRow) {
  const message = data.status === "PENDING" ? [
    "*PENDAFTARAN MITRA MARKETING OKESIH*", "",
    `Nama: *${cleanWhatsAppMessageField(data.full_name)}*`,
    `WhatsApp: +${data.phone}`,
    `Email: ${cleanWhatsAppMessageField(data.email) || "-"}`,
    `Wilayah: ${cleanWhatsAppMessageField(data.city_area)}`,
    `Kode Referral: *${cleanWhatsAppMessageField(data.referral_code)}*`, "",
    "Pendaftaran telah tersimpan di Dashboard Super Admin dan menunggu verifikasi.",
  ].join("\n") : [
    "Halo Admin OKESIH, saya ingin menanyakan status atau akses akun marketing saya.",
    `Nama: ${cleanWhatsAppMessageField(data.full_name)}`,
    `Kode referral: ${cleanWhatsAppMessageField(data.referral_code)}`,
  ].join("\n");
  const registration: MarketingRegistration = {
    id: data.id, fullName: data.full_name, phone: data.phone, email: data.email,
    cityArea: data.city_area, bankName: data.bank_name,
    bankAccountNumber: data.bank_account_number, bankAccountName: data.bank_account_name,
    experienceNotes: data.experience_notes, referralCode: data.referral_code,
    status: data.status, createdAt: data.created_at,
    applicationReady: data.status === "ACTIVE" && Boolean(data.user_id),
    whatsappUrl: createWhatsAppUrl(getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER), message),
  };
  return NextResponse.json({ success: true, data: registration }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(MARKETING_REGISTRATION_COOKIE)?.value;
  if (!token) return NextResponse.json({ data: null }, { headers: { "Cache-Control": "private, no-store" } });
  try {
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!secret || !url) throw new Error("Konfigurasi database belum lengkap.");
    const id = readRegistrationToken(token, secret);
    if (!id) return NextResponse.json({ error: "Akses pendaftaran kedaluwarsa atau tidak valid. Hubungi Admin melalui WhatsApp untuk bantuan." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const { data, error } = await createClient(url, secret).from("marketing_partners").select(registrationColumns).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Data pendaftaran tidak ditemukan. Hubungi Admin untuk bantuan." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    return registrationResponse(data);
  } catch {
    return NextResponse.json({ error: "Status pendaftaran belum dapat dimuat. Silakan coba lagi." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    if (request.cookies.has(MARKETING_REGISTRATION_COOKIE)) return GET(request);
    getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);
    const body = await request.json();
    const {
      fullName,
      phone,
      email,
      cityArea,
      bankName,
      bankAccountNumber,
      bankAccountName,
      experienceNotes,
    } = body;

    if (!fullName || !phone || !cityArea || !bankAccountNumber || !bankAccountName) {
      return NextResponse.json(
        { error: "Mohon lengkapi semua kolom yang wajib diisi (Nama, No HP/WA, Kota/Wilayah, dan Rekening Bank)." },
        { status: 400 }
      );
    }

    const marketingPhone = normalizeIndonesianWhatsAppNumber(phone);
    if (!isValidIndonesianWhatsAppNumber(marketingPhone)) {
      return NextResponse.json(
        { error: "Nomor WhatsApp tidak valid. Gunakan nomor Indonesia aktif, misalnya 081234567890." },
        { status: 400 },
      );
    }

    // Buat kode referral unik otomatis jika belum ada
    // Format: MKT-[KODE_WILAYAH]-[ANGKA_ACAK]
    const cleanCity = cityArea.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "IDN";
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const referralCode = `MKT-${cleanCity}-${randomSuffix}`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Konfigurasi server database belum lengkap." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await supabase
      .from("platform_settings")
      .select("default_marketing_commission")
      .eq("id", "global")
      .maybeSingle();
    const defaultCommission = Number(settings?.default_marketing_commission) || 15;

    const { data, error } = await supabase
      .from("marketing_partners")
      .insert([
        {
          full_name: fullName.trim(),
          phone: marketingPhone,
          email: email ? email.trim().toLowerCase() : null,
          city_area: cityArea.trim(),
          referral_code: referralCode,
          bank_name: bankName || "BCA",
          bank_account_number: bankAccountNumber.trim(),
          bank_account_name: bankAccountName.trim(),
          experience_notes: experienceNotes ? experienceNotes.trim() : null,
          status: "PENDING",
          commission_rate: defaultCommission,
        },
      ])
      .select(registrationColumns)
      .single();

    if (error) {
      console.error("Supabase insert marketing partner error:", error);
      return NextResponse.json(
        { error: `Gagal menyimpan pendaftaran: ${error.message}` },
        { status: 500 }
      );
    }

    const response = registrationResponse(data);
    response.cookies.set(MARKETING_REGISTRATION_COOKIE, createRegistrationToken(data.id, supabaseServiceKey), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/marketing/register",
      maxAge: MARKETING_REGISTRATION_TTL,
    });
    return response;
  } catch (err: unknown) {
    console.error("Error in /api/marketing/register:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal server." },
      { status: err instanceof Error && "status" in err && typeof err.status === "number" ? err.status : 500 }
    );
  }
}
