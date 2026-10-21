import { z } from "zod";
import { assertSameOrigin } from "@/lib/device-auth";
import { auditPinSettings } from "@/lib/audit-access";
import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";
const schema = z.union([z.object({ action: z.literal("disable") }), z.object({ pin: z.string().regex(/^\d{4,6}$/) })]);
export async function GET(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const { hasPin } = await auditPinSettings(admin, warkopId);
    return Response.json({ hasPin, enabled: hasPin }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ownerErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId, user } = await requireOwner(request);
    const input = schema.parse(await request.json());
    const { error } = await admin.rpc("set_tenant_audit_pin", { p_warkop_id: warkopId, p_actor: user.id, p_pin: "pin" in input ? input.pin : null });
    if (error) throw error;
    return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "PIN harus 4–6 angka." }, { status: 400 });
    return ownerErrorResponse(error);
  }
}
