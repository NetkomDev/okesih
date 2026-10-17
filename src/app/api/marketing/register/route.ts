import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/device-auth";
import {
  cleanWhatsAppMessageField,
  createWhatsAppUrl,
  getSuperAdminWhatsAppNumber,
  isValidIndonesianWhatsAppNumber,
  normalizeIndonesianWhatsAppNumber,
} from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
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
      .select()
      .single();

    if (error) {
      console.error("Supabase insert marketing partner error:", error);
      return NextResponse.json(
        { error: `Gagal menyimpan pendaftaran: ${error.message}` },
        { status: 500 }
      );
    }

    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);
    const message = [
      "*PENDAFTARAN MITRA MARKETING OKESIH*",
      "",
      `Nama: *${cleanWhatsAppMessageField(data.full_name)}*`,
      `WhatsApp: +${marketingPhone}`,
      `Email: ${cleanWhatsAppMessageField(data.email) || "-"}`,
      `Wilayah: ${cleanWhatsAppMessageField(data.city_area)}`,
      `Kode Referral: *${cleanWhatsAppMessageField(data.referral_code)}*`,
      "",
      "Pendaftaran telah tersimpan di Dashboard Super Admin dan menunggu verifikasi.",
    ].join("\n");

    return NextResponse.json({
      success: true,
      message: "Pendaftaran berhasil diterima! Tim Admin akan segera meninjau dan mengaktifkan akun kemitraan Anda.",
      data: {
        id: data.id,
        fullName: data.full_name,
        referralCode: data.referral_code,
        cityArea: data.city_area,
        status: data.status,
        whatsappUrl: createWhatsAppUrl(adminPhone, message),
      },
    });
  } catch (err: unknown) {
    console.error("Error in /api/marketing/register:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan internal server." },
      { status: err instanceof Error && "status" in err && typeof err.status === "number" ? err.status : 500 }
    );
  }
}
