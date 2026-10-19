import { z } from "zod";
import { isValidIndonesianWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from "./whatsapp";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const marketingProfileUpdateSchema = z.union([
  z.object({
    fullName: text(2, 150),
    phone: z.string().transform(normalizeIndonesianWhatsAppNumber).refine(isValidIndonesianWhatsAppNumber, "Nomor WhatsApp Indonesia tidak valid."),
    cityArea: text(1, 100), bankName: text(1, 50),
    bankAccountNumber: text(1, 50).regex(/^\d+$/, "Nomor rekening hanya boleh berisi angka."),
    bankAccountName: text(2, 150),
  }).strict(),
  z.object({
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{4,30}$/, "Username harus 4–30 karakter: huruf, angka, _ atau -."),
    newPassword: z.string().min(6).max(256).optional(),
  }).strict(),
]);

export type MarketingProfileRow = {
  membership_level?: string; coordinator_commission_rate?: number;
  id: string; user_id: string; username: string | null; full_name: string;
  phone: string; city_area: string; referral_code: string;
  bank_name: string; bank_account_number: string; bank_account_name: string;
  commission_rate: number | string; status: string; updated_at: string;
};
export function marketingProfile(row: MarketingProfileRow, totalTenants: number, authEmail?: string) {
  return {
    membershipLevel: row.membership_level || "MARKETING", coordinatorCommissionRate: Number(row.coordinator_commission_rate ?? 0),
    id: row.id, userId: row.user_id,
    username: authEmail?.endsWith("@okesih.local") ? authEmail.slice(0, -"@okesih.local".length) : row.username || "",
    fullName: row.full_name, phone: row.phone,
    cityArea: row.city_area, referralCode: row.referral_code,
    bankName: row.bank_name, bankAccountNumber: row.bank_account_number,
    bankAccountName: row.bank_account_name, commissionRate: Number(row.commission_rate),
    totalTenants, status: row.status,
  };
}
