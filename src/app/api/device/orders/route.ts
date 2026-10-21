import { NextRequest } from "next/server";
import { z } from "zod";
import { requireCashier } from "@/lib/cashier-api";
import { DeviceApiError, assertSameOrigin, deviceErrorResponse, requireDevice, sha256 } from "@/lib/device-auth";

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["COOKING", "READY", "DONE", "REJECTED"]),
  idempotencyKey: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = transitionSchema.parse(await request.json());
    const { admin, device, warkopId, deviceType } = await requireDevice(request, ["POS", "KDS"]);
    const cashier = deviceType === "POS" ? await requireCashier(request, admin, warkopId) : null;
    if (deviceType === "POS" && !input.shiftId) throw new DeviceApiError("Identitas shift diperlukan.", 409);
    const { data, error } = await admin.rpc("transition_order_v2", { p_warkop_id: warkopId, p_device_id: device.id, p_member_id: cashier?.member.id || null, p_input: input, p_hash: sha256(JSON.stringify(input)) });
    if (error) throw new DeviceApiError(error.code === "P0001" ? error.message : "Perubahan belum dapat disimpan.", error.code === "P0001" ? 409 : 503);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Perubahan pesanan tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}
