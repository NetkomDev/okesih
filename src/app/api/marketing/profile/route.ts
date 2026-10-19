import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin } from "@/lib/device-auth";
import {
  isValidIndonesianWhatsAppNumber,
  normalizeIndonesianWhatsAppNumber,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function getMarketingContext() {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user || String(user.app_metadata?.role).toUpperCase() !== "MARKETING") {
    return null;
  }

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("marketing_partners")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (!partner) return null;
  return { admin, user, partner };
}

export async function GET() {
  try {
    const ctx = await getMarketingContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Sesi login marketing tidak valid atau akun tidak aktif." },
        { status: 401 }
      );
    }

    const { partner, user } = ctx;
    return NextResponse.json({
      success: true,
      profile: {
        id: partner.id,
        userId: user.id,
        username: partner.username || "",
        fullName: partner.full_name,
        phone: partner.phone,
        email: partner.email || "",
        cityArea: partner.city_area || "",
        referralCode: partner.referral_code,
        bankName: partner.bank_name || "",
        bankAccountNumber: partner.bank_account_number || "",
        bankAccountName: partner.bank_account_name || "",
        commissionRate: Number(partner.commission_rate || 0),
        totalTenants: partner.total_tenants_acquired || 0,
        status: partner.status,
      },
    });
  } catch (error) {
    console.error("GET /api/marketing/profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengambil data profil." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await getMarketingContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Sesi login marketing tidak valid atau akun tidak aktif." },
        { status: 401 }
      );
    }

    const { admin, user, partner } = ctx;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Data permintaan tidak valid." }, { status: 400 });
    }

    const {
      fullName,
      phone,
      cityArea,
      bankName,
      bankAccountNumber,
      bankAccountName,
      username,
      newPassword,
    } = body;

    const partnerUpdates: Record<string, any> = {};
    let usernameChanged = false;
    let passwordChanged = false;
    let updatedUsername = partner.username || "";

    // 1. Validasi & Update Username
    if (username !== undefined) {
      const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (cleanUsername !== (partner.username || "")) {
        if (cleanUsername.length < 4 || cleanUsername.length > 30) {
          return NextResponse.json(
            { error: "Username harus terdiri dari 4-30 karakter (huruf kecil, angka, _ atau -)." },
            { status: 400 }
          );
        }

        // Cek keunikan username di tabel marketing_partners
        const { data: existingMarketing } = await admin
          .from("marketing_partners")
          .select("id")
          .eq("username", cleanUsername)
          .neq("id", partner.id)
          .maybeSingle();

        if (existingMarketing) {
          return NextResponse.json(
            { error: "Username sudah digunakan oleh akun lain. Silakan pilih username yang berbeda." },
            { status: 400 }
          );
        }

        // Cek keunikan username di tabel warkop_members
        const { data: existingMember } = await admin
          .from("warkop_members")
          .select("id")
          .eq("username", cleanUsername)
          .maybeSingle();

        if (existingMember) {
          return NextResponse.json(
            { error: "Username sudah digunakan oleh akun lain di sistem. Silakan pilih username lain." },
            { status: 400 }
          );
        }

        // Update email di Supabase Auth (auth.users) sesuai konvensi `${username}@okesih.local`
        const newEmail = `${cleanUsername}@okesih.local`;
        const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
          email: newEmail,
          email_confirm: true,
        });

        if (authError) {
          return NextResponse.json(
            { error: `Gagal memperbarui username di sistem auth: ${authError.message}` },
            { status: 500 }
          );
        }

        partnerUpdates.username = cleanUsername;
        usernameChanged = true;
        updatedUsername = cleanUsername;
      }
    }

    // 2. Validasi & Update Password Baru
    if (newPassword !== undefined && String(newPassword).trim() !== "") {
      const trimmedPass = String(newPassword).trim();
      if (trimmedPass.length < 6) {
        return NextResponse.json(
          { error: "Password baru minimal 6 karakter." },
          { status: 400 }
        );
      }

      const { error: passError } = await admin.auth.admin.updateUserById(user.id, {
        password: trimmedPass,
      });

      if (passError) {
        return NextResponse.json(
          { error: `Gagal memperbarui password di database: ${passError.message}` },
          { status: 500 }
        );
      }

      passwordChanged = true;
    }

    // 3. Validasi & Update Data Profil
    if (fullName !== undefined) {
      const cleanName = String(fullName).trim();
      if (cleanName.length < 2) {
        return NextResponse.json({ error: "Nama lengkap minimal 2 karakter." }, { status: 400 });
      }
      partnerUpdates.full_name = cleanName;
    }

    if (phone !== undefined) {
      const normPhone = normalizeIndonesianWhatsAppNumber(phone);
      if (!isValidIndonesianWhatsAppNumber(normPhone)) {
        return NextResponse.json(
          { error: "Nomor WhatsApp tidak valid. Gunakan format nomor Indonesia (contoh: 08123456789)." },
          { status: 400 }
        );
      }
      partnerUpdates.phone = normPhone;
    }

    if (cityArea !== undefined) {
      partnerUpdates.city_area = String(cityArea).trim();
    }

    if (bankName !== undefined) {
      partnerUpdates.bank_name = String(bankName).trim();
    }

    if (bankAccountNumber !== undefined) {
      partnerUpdates.bank_account_number = String(bankAccountNumber).trim();
    }

    if (bankAccountName !== undefined) {
      partnerUpdates.bank_account_name = String(bankAccountName).trim();
    }

    if (Object.keys(partnerUpdates).length > 0) {
      partnerUpdates.updated_at = new Date().toISOString();
      const { error: updateError } = await admin
        .from("marketing_partners")
        .update(partnerUpdates)
        .eq("id", partner.id);

      if (updateError) {
        return NextResponse.json(
          { error: `Gagal menyimpan pembaruan profil: ${updateError.message}` },
          { status: 500 }
        );
      }
    }

    // Catat log audit jika ada perubahan kredensial atau profil
    try {
      await admin.from("audit_logs").insert({
        actor_user_id: user.id,
        action: "MARKETING_PROFILE_UPDATED",
        target_type: "marketing_partner",
        target_id: partner.id,
        metadata: {
          username_changed: usernameChanged,
          new_username: usernameChanged ? updatedUsername : undefined,
          password_changed: passwordChanged,
          updated_fields: Object.keys(partnerUpdates),
          updated_at: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn("Audit log notice on profile update:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "Profil dan kredensial berhasil diperbarui.",
      usernameChanged,
      passwordChanged,
      username: updatedUsername,
    });
  } catch (error) {
    console.error("PATCH /api/marketing/profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan internal saat memperbarui profil." },
      { status: 500 }
    );
  }
}
