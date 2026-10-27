import { NextRequest } from "next/server";
import { z } from "zod";
import { requireCashier } from "@/lib/cashier-api";
import { assertSameOrigin, deviceErrorResponse, DeviceApiError, requireDevice, sha256 } from "@/lib/device-auth";

const schema = z.object({ orderId: z.string().uuid(), shiftId: z.string().uuid(), idempotencyKey: z.string().uuid(), cashReceived: z.number().int().min(0).max(1_000_000_000).optional() });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = schema.parse(await request.json());
    const { admin, device, warkopId } = await requireDevice(request, ["POS"]);
    const { member } = await requireCashier(request, admin, warkopId);
    const { data, error } = await admin.rpc("record_order_payment", {
      p_warkop_id: warkopId, p_device_id: device.id, p_member_id: member.id,
      p_input: input, p_hash: sha256(JSON.stringify(input)),
    });
    if (error) throw new DeviceApiError(error.code === "P0001" ? error.message : "Pembayaran belum dapat dicatat.", error.code === "P0001" ? 409 : 503);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data pembayaran tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}
