import { z } from "zod";
import { assertSameOrigin, deviceErrorResponse } from "@/lib/device-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { cleanWhatsAppMessageField, createWhatsAppUrl, getSuperAdminWhatsAppNumber } from "@/lib/whatsapp";
const schema = z.object({ role: z.enum(["OWNER", "MARKETING"]), identifier: z.string().trim().min(3).max(160) });
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    await enforceRateLimit(createAdminClient(), request, "account-help", 5, 900);
    // Never look up an account or disclose whether the submitted identity exists.
    const message = ["Permohonan bantuan akses OKESIH", `Peran: ${input.role}`, `Identitas yang saya masukkan: ${cleanWhatsAppMessageField(input.identifier)}`, "Mohon verifikasi kepemilikan melalui kontak yang sudah terdaftar sebelum mengganti password."].join("\n");
    return Response.json({ success: true, message: "Lanjutkan ke bantuan Admin. Kepemilikan akun akan diverifikasi melalui kontak terdaftar.", whatsappUrl: createWhatsAppUrl(getSuperAdminWhatsAppNumber(process.env.SUPERADMIN_WHATSAPP_NUMBER), message) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Masukkan peran dan identitas akun yang valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}
