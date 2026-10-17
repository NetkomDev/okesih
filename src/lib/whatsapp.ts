const DEFAULT_SUPERADMIN_WHATSAPP_NUMBER = "6285694488510";

export function normalizeIndonesianWhatsAppNumber(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function isValidIndonesianWhatsAppNumber(value: unknown) {
  return /^628\d{8,11}$/.test(normalizeIndonesianWhatsAppNumber(value));
}

export function getSuperAdminWhatsAppNumber(configuredValue?: string) {
  const phone = normalizeIndonesianWhatsAppNumber(
    configuredValue || DEFAULT_SUPERADMIN_WHATSAPP_NUMBER,
  );
  if (!isValidIndonesianWhatsAppNumber(phone)) {
    throw new Error("Nomor WhatsApp Super Admin belum dikonfigurasi dengan benar.");
  }
  return phone;
}

export function createWhatsAppUrl(recipientPhone: unknown, message: string) {
  const phone = normalizeIndonesianWhatsAppNumber(recipientPhone);
  if (!isValidIndonesianWhatsAppNumber(phone)) {
    throw new Error("Nomor tujuan WhatsApp tidak valid.");
  }
  const normalizedMessage = message.replace(/\r\n/g, "\n").trim();
  if (!normalizedMessage) throw new Error("Pesan WhatsApp tidak boleh kosong.");
  return `https://wa.me/${phone}?text=${encodeURIComponent(normalizedMessage)}`;
}

export function cleanWhatsAppMessageField(value: unknown) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
}

export function formatWhatsAppRupiah(value: unknown) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export function formatWhatsAppDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00+08:00`);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
