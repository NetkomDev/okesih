import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, deviceErrorResponse, requireDevice } from "@/lib/device-auth";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { auditPinSettings, createAuditAccess, AUDIT_COOKIE, AUDIT_TTL } from "@/lib/audit-access";
const schema = z.object({ pin: z.string().regex(/^\d{4,6}$/) });
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId, device } = await requireDevice(request, ["POS"]);
    await enforceRateLimit(admin, request, "audit-pin", 5, 300, device.id);
    const { pin } = schema.parse(await request.json());
    const settings = await auditPinSettings(admin, warkopId);
    const { data, error } = settings.hasPin ? await admin.rpc("verify_tenant_audit_pin", { p_warkop_id: warkopId, p_pin: pin }) : { data: true, error: null };
    if (error) throw error;
    if (!data) return Response.json({ verified: false, error: "PIN tidak sesuai." }, { status: 403 });
    const response = NextResponse.json({ verified: true, hasPin: settings.hasPin }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(AUDIT_COOKIE, createAuditAccess(device.id, settings.version), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/device", maxAge: AUDIT_TTL });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ verified: false, error: "PIN harus 4–6 angka." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}
