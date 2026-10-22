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
import { recruitmentSchema } from "@/lib/marketing-recruitment";
import { randomDigits } from "@/lib/generated-credentials";
import { isCoordinatorLevel } from "@/lib/affiliate";

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
    const raw = await request.json().catch(() => null);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ error: "Data pendaftaran tidak valid." }, { status: 400 });
    const parsed = recruitmentSchema.omit({ requestId: true }).safeParse({ ...raw, bankName: raw.bankName || "BCA" });
    if (!parsed.success) return NextResponse.json({ error: "Periksa nama, WhatsApp, wilayah, email, dan nomor rekening angka." }, { status: 400 });
    const body = { ...parsed.data, coordinatorReferralCode: raw.coordinatorReferralCode };
    const {
      fullName,
      phone,
      email,
      cityArea,
      bankName,
      bankAccountNumber,
      bankAccountName,
      experienceNotes,
      coordinatorReferralCode,
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
    const referralCode = `MKT-${cleanCity}-${randomDigits(3)}`;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Konfigurasi server database belum lengkap." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings, error: settingsError } = await supabase.from("platform_settings")
      .select("default_marketing_commission").eq("id", "global").single();
    if (settingsError || !settings) return NextResponse.json({ error: "Parameter komisi belum dapat dibaca." }, { status: 503 });
    let uplineId: string | null = null;
    if (coordinatorReferralCode !== undefined) {
      if (typeof coordinatorReferralCode !== "string" || !/^[a-z0-9_-]{1,50}$/i.test(coordinatorReferralCode.trim())) {
        return NextResponse.json({ error: "Kode referral koordinator tidak valid." }, { status: 400 });
      }

      const { data: coordinatorCandidate, error: referralError } = await supabase
        .from("marketing_partners")
        .select("id, status, user_id, membership_level, upline_id")
        .eq("referral_code", coordinatorReferralCode.trim().toUpperCase())
        .maybeSingle();

      if (referralError) {
        return NextResponse.json({ error: "Referral belum dapat diperiksa." }, { status: 503 });
      }

      let validCoordinatorId: string | null = null;
      if (coordinatorCandidate && coordinatorCandidate.status === "ACTIVE" && coordinatorCandidate.user_id) {
        const isCoord = isCoordinatorLevel(coordinatorCandidate.membership_level) && !coordinatorCandidate.upline_id;
        if (isCoord) validCoordinatorId = String(coordinatorCandidate.id);
      }

      if (!validCoordinatorId) {
        return NextResponse.json({ error: "Koordinator tidak ditemukan atau sudah tidak aktif." }, { status: 400 });
      }
      uplineId = validCoordinatorId;
    }

    const baseInsert: Record<string, unknown> = {
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
      commission_rate: Number(settings.default_marketing_commission),
    };

    if (uplineId) {
      baseInsert.notes_admin = `[UPLINE:${uplineId}]`;
    }

    let data: RegistrationRow | null = null;
    let error: { code?: string; message: string } | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const result = await supabase.from("marketing_partners").insert([{
        ...baseInsert,
        referral_code: attempt === 0 ? referralCode : `MKT-${cleanCity}-${randomDigits(3)}`,
        membership_level: "MITRA", upline_id: uplineId,
      }]).select(registrationColumns).single();
      data = result.data;
      error = result.error;
      if (!error || error.code !== "23505") break;
    }

    if (error || !data) {
      console.error("Supabase insert marketing partner error:", error);
      return NextResponse.json(
        { error: error ? `Gagal menyimpan pendaftaran: ${error.message}` : "Gagal menyimpan data pendaftaran mitra." },
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
