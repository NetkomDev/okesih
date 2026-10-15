import { NextRequest } from "next/server";
import { z } from "zod";
import { requireCashier } from "@/lib/cashier-api";
import { DeviceApiError, assertSameOrigin, deviceErrorResponse, requireDevice } from "@/lib/device-auth";

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["COOKING", "READY", "DONE", "REJECTED"]),
  idempotencyKey: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
});

const allowedTransitions: Record<"POS" | "KDS", Record<string, string[]>> = {
  POS: {
    AWAITING_CONFIRMATION: ["COOKING", "REJECTED"],
    READY: ["DONE"],
  },
  KDS: {
    COOKING: ["READY"],
    READY: ["DONE"],
  },
};

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = transitionSchema.parse(await request.json());
    const { admin, device, warkopId, deviceType } = await requireDevice(request, ["POS", "KDS"]);
    let cashier: Awaited<ReturnType<typeof requireCashier>> | null = null;
    let activeShift: { id: string } | null = null;

    if (deviceType === "POS") {
      cashier = await requireCashier(request, admin, warkopId);
      const { data: shift, error: shiftError } = await admin
        .from("shifts")
        .select("id")
        .eq("warkop_id", warkopId)
        .eq("opened_by", cashier.member.id)
        .eq("device_id", device.id)
        .eq("status", "OPEN")
        .maybeSingle();
      if (shiftError) throw shiftError;
      if (!shift) throw new DeviceApiError("Shift kasir belum aktif. Masuk dan mulai shift terlebih dahulu.", 409);
      if (!input.shiftId || input.shiftId !== shift.id) throw new DeviceApiError("Operasi berasal dari shift yang berbeda dan tidak dapat disinkronkan.", 409);
      activeShift = shift;
    }

    const { data: prior } = await admin
      .from("operation_idempotency")
      .select("response")
      .eq("warkop_id", warkopId)
      .eq("device_id", device.id)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (prior) return Response.json({ ...prior.response, duplicate: true });

    const { data: order, error: orderError } = await admin
      .from("transactions")
      .select("id,status_pesanan,payment_method,total_harga,table_number,nomor_antrean")
      .eq("id", input.orderId)
      .eq("warkop_id", warkopId)
      .maybeSingle();
    if (orderError || !order) throw new DeviceApiError("Pesanan tidak ditemukan.", 404);
    if (!allowedTransitions[deviceType][order.status_pesanan]?.includes(input.status)) {
      throw new DeviceApiError(`Perubahan ${order.status_pesanan} → ${input.status} tidak diizinkan untuk ${deviceType}.`, 409);
    }

    const patch: Record<string, string> = { status_pesanan: input.status };
    if (order.status_pesanan === "AWAITING_CONFIRMATION" && input.status === "COOKING") {
      patch.confirmed_at = new Date().toISOString();
      if (activeShift) patch.shift_id = activeShift.id;
    }
    const { data: updated, error } = await admin
      .from("transactions")
      .update(patch)
      .eq("id", order.id)
      .eq("warkop_id", warkopId)
      .eq("status_pesanan", order.status_pesanan)
      .select("id,status_pesanan,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!updated) throw new DeviceApiError("Pesanan telah berubah di perangkat lain. Muat ulang data.", 409);

    const response = { success: true, order: updated };
    await Promise.all([
      admin.from("operation_idempotency").insert({ warkop_id: warkopId, device_id: device.id, idempotency_key: input.idempotencyKey, operation: "ORDER_STATUS_TRANSITION", response }),
      admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: cashier?.user.id || null, device_id: device.id, action: `ORDER_${input.status}`, target_type: "transaction", target_id: order.id, metadata: { from: order.status_pesanan, to: input.status, payment_method: order.payment_method, total: order.total_harga, shift_id: activeShift?.id || null, cashier: cashier?.member.display_name || cashier?.member.username || null } }),
      activeShift ? admin.from("shifts").update({ last_activity_at: new Date().toISOString() }).eq("id", activeShift.id) : Promise.resolve(),
    ]);
    return Response.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Perubahan pesanan tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}
