import { NextRequest } from "next/server";
import { z } from "zod";
import { requireCashier } from "@/lib/cashier-api";
import { DeviceApiError, assertSameOrigin, deviceErrorResponse, randomToken, requireDevice, sha256 } from "@/lib/device-auth";

const orderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  shiftId: z.string().uuid(),
  tableNumber: z.string().trim().min(1).max(20),
  paymentMethod: z.enum(["QRIS", "CASH"]),
  cashReceived: z.number().int().nonnegative().max(1_000_000_000).optional(),
  items: z.array(z.object({
    menuId: z.string().uuid(),
    qty: z.number().int().min(1).max(99),
    notes: z.string().trim().max(300).default(""),
  })).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = orderSchema.parse(await request.json());
    const { admin, device, warkopId } = await requireDevice(request, ["POS"]);
    const cashier = await requireCashier(request, admin, warkopId);

    const { data: order, error } = await admin.rpc("create_order_v2", {
      p_warkop_id: warkopId, p_input: input, p_hash: sha256(JSON.stringify({ ...input, deviceId: device.id, memberId: cashier.member.id })),
      p_token_hash: sha256(randomToken()), p_device_id: device.id, p_member_id: cashier.member.id,
    });
    if (error) throw new DeviceApiError(error.code === "P0001" ? error.message : "Pesanan belum dapat disimpan.", error.code === "P0001" ? 409 : 503);
    return Response.json({ order }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data pesanan kasir tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}
