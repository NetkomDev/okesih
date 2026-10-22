import { z } from "zod";
import { isValidIndonesianWhatsAppNumber, normalizeIndonesianWhatsAppNumber } from "@/lib/whatsapp";

export const recruitmentSchema = z.object({
  requestId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(150),
  phone: z.string().max(30).transform(normalizeIndonesianWhatsAppNumber).refine(isValidIndonesianWhatsAppNumber),
  email: z.union([z.literal(""), z.email()]).optional(),
  cityArea: z.string().trim().min(2).max(150),
  bankName: z.string().trim().min(2).max(100),
  bankAccountNumber: z.string().trim().regex(/^\d{5,30}$/),
  bankAccountName: z.string().trim().min(2).max(150),
  experienceNotes: z.string().trim().max(2000).optional(),
});
