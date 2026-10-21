import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_ORIGINS } from "@/lib/app-origins";
import { createWhatsAppUrl, cleanWhatsAppMessageField, isValidIndonesianWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from "@/lib/whatsapp";

export class AccessRecoveryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function recoverAccountAccess(admin: SupabaseClient, actorId: string, input: {
  kind: "MARKETING" | "TENANT" | "APPLICATION";
  id: string;
  phone: string;
  resetPassword: boolean;
}) {
  const phone = normalizeIndonesianWhatsAppNumber(input.phone);
  if (!isValidIndonesianWhatsAppNumber(phone)) throw new AccessRecoveryError("Nomor WhatsApp tidak valid. Periksa kembali nomor penerima.");
  const table = input.kind === "MARKETING" ? "marketing_partners" : input.kind === "TENANT" ? "warkops" : "tenant_applications";
  const { data: record, error } = await admin.from(table).select("*").eq("id", input.id).maybeSingle();
  if (error) throw new AccessRecoveryError("Data akun gagal dimuat.", 500);
  if (!record) throw new AccessRecoveryError("Data tidak ditemukan.", 404);
  if (input.kind === "APPLICATION" && (record.status !== "PENDING" || input.resetPassword)) throw new AccessRecoveryError("Pengajuan sudah diproses. Kelola akses dari daftar tenant.", 409);

  let userId: string | null = null;
  let username: string | null = null;
  if (input.resetPassword) {
    if (input.kind === "MARKETING") {
      if (record.status !== "ACTIVE" || !record.user_id) throw new AccessRecoveryError("Akun marketing belum aktif. Verifikasi pendaftaran terlebih dahulu.", 409);
      userId = record.user_id;
      username = record.username;
    } else {
      if (!record.is_active || record.archived_at) throw new AccessRecoveryError("Tenant belum aktif. Aktifkan tenant sebelum memulihkan akses.", 409);
      const { data: member, error: memberError } = await admin.from("warkop_members").select("user_id,username").eq("warkop_id", input.id).eq("role", "OWNER").maybeSingle();
      if (memberError || !member) throw new AccessRecoveryError("Akun owner tidak ditemukan atau terdapat lebih dari satu owner. Periksa keanggotaan tenant.", 409);
      userId = member.user_id;
      username = member.username;
    }
    if (!userId || !username) throw new AccessRecoveryError("Akun belum memiliki identitas login yang lengkap.", 409);
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
    if (authError || !authData.user) throw new AccessRecoveryError("Akun login tidak ditemukan.", 409);
    const expectedRole = input.kind === "MARKETING" ? "MARKETING" : "OWNER";
    const metadata = authData.user.app_metadata;
    if (metadata.role !== expectedRole || (input.kind === "MARKETING" ? metadata.marketing_partner_id !== input.id : metadata.warkop_id !== input.id)) throw new AccessRecoveryError("Identitas akun tidak cocok dengan data pendaftaran.", 409);
  }

  const oldPhone = input.kind === "MARKETING" ? record.phone : record.owner_phone;
  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_user_id: actorId,
    action: input.resetPassword ? "ACCOUNT_ACCESS_RESET_REQUESTED" : "ACCOUNT_PHONE_CORRECTION_REQUESTED",
    target_type: input.kind.toLowerCase(), target_id: input.id,
    metadata: { old_phone: oldPhone, new_phone: phone },
  });
  if (auditError) throw new AccessRecoveryError("Pencatatan audit gagal. Belum ada perubahan akun.", 500);

  let update = admin.from(table).update(input.kind === "MARKETING" ? { phone } : { owner_phone: phone }).eq("id", input.id);
  if (input.kind === "APPLICATION") update = update.eq("status", "PENDING");
  const { data: updated, error: updateError } = await update.select("id").maybeSingle();
  if (updateError || !updated) throw new AccessRecoveryError("Nomor belum dapat disimpan atau data sedang diproses. Muat ulang dan coba lagi.", 409);
  const sync = input.kind === "MARKETING"
    ? await admin.from("marketing_agents").update({ phone }).eq("id", input.id)
    : input.kind === "TENANT"
      ? await admin.from("tenant_applications").update({ owner_phone: phone }).eq("warkop_id", input.id)
      : { error: null };
  if (sync.error) throw new AccessRecoveryError("Nomor utama sudah disimpan, tetapi sinkronisasi gagal. Ulangi penyimpanan; password belum diubah.", 500);

  let whatsappUrl: string | null = null;
  if (input.resetPassword && userId && username) {
    const password = randomBytes(18).toString("base64url");
    const message = [
      `Halo ${cleanWhatsAppMessageField(input.kind === "MARKETING" ? record.full_name : record.owner_name)}, akses akun OKESIH Anda telah diperbarui oleh Super Admin.`, "",
      `Username: *${cleanWhatsAppMessageField(username)}*`,
      `Password baru: *${password}*`,
      `Login: ${APP_ORIGINS.PUBLIC}/login`, "",
      "Password sebelumnya sudah tidak berlaku. Simpan akses ini dengan aman dan ganti password setelah masuk.",
    ].join("\n");
    whatsappUrl = createWhatsAppUrl(phone, message);
    const { error: resetError } = await admin.auth.admin.updateUserById(userId, { password });
    if (resetError) throw new AccessRecoveryError("Nomor sudah diperbarui, tetapi reset password gagal. Coba reset akses kembali.", 502);
  }
  const { error: completionError } = await admin.from("audit_logs").insert({
    actor_user_id: actorId,
    action: input.resetPassword ? "ACCOUNT_ACCESS_RESET_COMPLETED" : "ACCOUNT_PHONE_CORRECTED",
    target_type: input.kind.toLowerCase(), target_id: input.id,
    metadata: { old_phone: oldPhone, new_phone: phone },
  });
  return { phone, username, whatsappUrl, warning: completionError ? "Perubahan berhasil, tetapi pencatatan audit penyelesaian gagal." : null };
}
