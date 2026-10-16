import { NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, deviceErrorResponse, requireDevice } from "@/lib/device-auth";

const verifySchema = z.object({
  pin: z.string().min(1).max(10),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireDevice(request, ["POS"]);
    const { pin } = verifySchema.parse(await request.json());

    // Ambil PIN owner warkop
    const { data: member, error } = await admin
      .from("warkop_members")
      .select("display_name")
      .eq("warkop_id", warkopId)
      .eq("role", "OWNER")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!member?.display_name || !member.display_name.startsWith("AUDIT_PIN:")) {
      // Jika owner belum mengonfigurasi PIN, izinkan akses secara default
      return Response.json({ verified: true, hasPin: false });
    }

    const storedPin = member.display_name.slice("AUDIT_PIN:".length).trim();
    const verified = storedPin === pin.trim();

    return Response.json({
      verified,
      hasPin: true,
      error: verified ? null : "PIN yang Anda masukkan salah.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ verified: false, error: "Format PIN tidak valid." }, { status: 400 });
    }
    return deviceErrorResponse(error);
  }
}
