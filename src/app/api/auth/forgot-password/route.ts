import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cleanWhatsAppMessageField,
  createWhatsAppUrl,
  getSuperAdminWhatsAppNumber,
  isValidIndonesianWhatsAppNumber,
  normalizeIndonesianWhatsAppNumber,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
    }

    const role = String(body.role || "").toUpperCase();
    if (role !== "OWNER" && role !== "MARKETING") {
      return NextResponse.json(
        { error: "Pilihan peran harus Owner Bisnis atau Mitra Marketing." },
        { status: 400 }
      );
    }

    const rawIdentifier = String(body.identifier || "").trim();
    if (rawIdentifier.length < 3) {
      return NextResponse.json(
        { error: "Masukkan username atau nomor WhatsApp terdaftar (minimal 3 karakter)." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const sanitizedUsername = rawIdentifier.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const normalizedPhone = normalizeIndonesianWhatsAppNumber(rawIdentifier);
    const hasValidPhone = isValidIndonesianWhatsAppNumber(normalizedPhone);

    let accountName = "";
    let accountUsername = "";
    let accountPhone = "";
    let businessName = "";
    let roleLabel = "";
    let targetUserId: string | null = null;
    let targetWarkopId: string | null = null;

    if (role === "MARKETING") {
      roleLabel = "Mitra Marketing";
      let partner: any = null;

      // 1. Cari via username
      if (sanitizedUsername) {
        const { data } = await admin
          .from("marketing_partners")
          .select("id, user_id, full_name, phone, username, referral_code, status")
          .eq("username", sanitizedUsername)
          .maybeSingle();
        if (data) partner = data;
      }

      // 2. Cari via nomor HP jika belum ditemukan
      if (!partner && hasValidPhone) {
        const { data } = await admin
          .from("marketing_partners")
          .select("id, user_id, full_name, phone, username, referral_code, status")
          .eq("phone", normalizedPhone)
          .maybeSingle();
        if (data) partner = data;
      }

      // Fallback: cari dengan awalan 0 atau 62
      if (!partner && rawIdentifier.replace(/\D/g, "").length >= 9) {
        const digits = rawIdentifier.replace(/\D/g, "");
        const localDigits = digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
        const intlDigits = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
        const { data } = await admin
          .from("marketing_partners")
          .select("id, user_id, full_name, phone, username, referral_code, status")
          .or(`phone.eq.${localDigits},phone.eq.${intlDigits}`)
          .maybeSingle();
        if (data) partner = data;
      }

      if (!partner) {
        return NextResponse.json(
          { error: "Akun Mitra Marketing dengan username atau nomor WhatsApp tersebut tidak ditemukan." },
          { status: 404 }
        );
      }

      accountName = partner.full_name;
      accountUsername = partner.username || sanitizedUsername || "-";
      accountPhone = partner.phone;
      targetUserId = partner.user_id || null;
    } else {
      // Role: OWNER
      roleLabel = "Owner Bisnis";
      let ownerMember: any = null;
      let warkop: any = null;

      // 1. Cari via username di warkop_members (role OWNER)
      if (sanitizedUsername) {
        const { data: member } = await admin
          .from("warkop_members")
          .select("id, warkop_id, user_id, username, display_name, role, is_active, warkops(id, nama, owner_name, owner_phone)")
          .eq("role", "OWNER")
          .eq("username", sanitizedUsername)
          .maybeSingle();
        if (member) {
          ownerMember = member;
          warkop = Array.isArray(member.warkops) ? member.warkops[0] : member.warkops;
        }
      }

      // 2. Cari via nomor WhatsApp Owner di warkops jika belum ketemu
      if (!ownerMember && hasValidPhone) {
        const { data: wk } = await admin
          .from("warkops")
          .select("id, nama, owner_name, owner_phone, warkop_members(id, user_id, username, role)")
          .eq("owner_phone", normalizedPhone)
          .limit(1)
          .maybeSingle();
        if (wk) {
          warkop = wk;
          const members = Array.isArray(wk.warkop_members) ? wk.warkop_members : [wk.warkop_members];
          ownerMember = members.find((m: any) => m?.role === "OWNER") || null;
        }
      }

      // Fallback: nomor dengan variasi 0 / 62
      if (!ownerMember && rawIdentifier.replace(/\D/g, "").length >= 9) {
        const digits = rawIdentifier.replace(/\D/g, "");
        const localDigits = digits.startsWith("62") ? `0${digits.slice(2)}` : digits;
        const intlDigits = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
        const { data: wk } = await admin
          .from("warkops")
          .select("id, nama, owner_name, owner_phone, warkop_members(id, user_id, username, role)")
          .or(`owner_phone.eq.${localDigits},owner_phone.eq.${intlDigits}`)
          .limit(1)
          .maybeSingle();
        if (wk) {
          warkop = wk;
          const members = Array.isArray(wk.warkop_members) ? wk.warkop_members : [wk.warkop_members];
          ownerMember = members.find((m: any) => m?.role === "OWNER") || null;
        }
      }

      if (!ownerMember || !warkop) {
        return NextResponse.json(
          { error: "Akun Owner Bisnis dengan username atau nomor WhatsApp tersebut tidak ditemukan." },
          { status: 404 }
        );
      }

      accountName = warkop.owner_name || ownerMember.display_name || "Owner";
      accountUsername = ownerMember.username || sanitizedUsername || "-";
      accountPhone = warkop.owner_phone || "";
      businessName = warkop.nama || "";
      targetUserId = ownerMember.user_id || null;
      targetWarkopId = warkop.id || null;
    }

    // Persiapan pesan WhatsApp ke Super Admin
    const adminPhone = getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER);
    const now = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Makassar",
    }).format(new Date());

    const waLines = [
      "*PENGAJUAN RESET PASSWORD OKESIH*",
      "",
      `Peran: *${roleLabel}*`,
      `Nama: *${cleanWhatsAppMessageField(accountName)}*`,
    ];
    if (businessName) {
      waLines.push(`Usaha: *${cleanWhatsAppMessageField(businessName)}*`);
    }
    waLines.push(
      `Username: *${accountUsername}*`,
      `WhatsApp Terdaftar: +${accountPhone}`,
      `Waktu Pengajuan: ${now}`,
      "",
      "Halo Super Admin OKESIH, saya mengajukan permohonan reset password untuk akun di atas karena lupa password saat hendak login. Mohon bantuan verifikasi data dan pengaturan password baru. Terima kasih."
    );
    const waMessage = waLines.join("\n");
    const whatsappUrl = createWhatsAppUrl(adminPhone, waMessage);

    // 1. Simpan pengajuan ke audit_logs sistem
    try {
      await admin.from("audit_logs").insert({
        warkop_id: targetWarkopId,
        actor_user_id: targetUserId,
        action: "PASSWORD_RESET_REQUEST",
        target_type: "auth_user",
        target_id: targetUserId,
        metadata: {
          role,
          role_label: roleLabel,
          requester_name: accountName,
          requester_phone: accountPhone,
          username: accountUsername,
          business_name: businessName || null,
          requested_at: new Date().toISOString(),
          user_agent: request.headers.get("user-agent") || "unknown",
        },
      });
    } catch (auditErr) {
      console.warn("Audit log warning on password reset request:", auditErr);
    }

    // 2. Simpan juga antrian pesan ke whatsapp_outbox untuk sistem notifikasi
    try {
      await admin.from("whatsapp_outbox").insert({
        warkop_id: targetWarkopId,
        recipient_phone: adminPhone,
        message: waMessage,
        status: "PENDING",
      });
    } catch (outboxErr) {
      console.warn("Outbox queue warning on password reset request:", outboxErr);
    }

    return NextResponse.json({
      success: true,
      message: "Pengajuan reset password berhasil dicatat di sistem.",
      whatsappUrl,
      account: {
        role,
        roleLabel,
        name: accountName,
        username: accountUsername,
        phone: accountPhone,
        businessName: businessName || null,
      },
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan sistem saat memproses pengajuan." },
      { status: 500 }
    );
  }
}
