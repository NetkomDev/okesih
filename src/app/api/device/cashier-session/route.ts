import { NextRequest } from "next/server";
import { z } from "zod";
import { requireCashier } from "@/lib/cashier-api";
import { DeviceApiError, assertSameOrigin, deviceErrorResponse, requireDevice } from "@/lib/device-auth";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({
    action: z.literal("end"),
    actualCash: z.coerce.number().min(0).max(999_999_999_999),
    notes: z.string().trim().max(500).optional(),
  }),
]);

async function activeShift(admin: Awaited<ReturnType<typeof requireDevice>>["admin"], warkopId: string) {
  const { data: shift, error } = await admin
    .from("shifts")
    .select("id,opened_by,device_id,opened_at,status,total_cash_expected,last_activity_at")
    .eq("warkop_id", warkopId)
    .eq("status", "OPEN")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!shift) return null;

  const [{ data: member }, { data: device }, { data: cashRows }] = await Promise.all([
    admin.from("warkop_members").select("id,username,display_name").eq("id", shift.opened_by).maybeSingle(),
    admin.from("device_installations").select("id,device_name").eq("id", shift.device_id).maybeSingle(),
    admin.from("transactions").select("total_harga").eq("shift_id", shift.id).eq("payment_method", "CASH").not("status_pesanan", "in", "(VOID,REJECTED)"),
  ]);

  return {
    id: shift.id,
    cashierId: shift.opened_by,
    cashierName: member?.display_name || member?.username || "Kasir",
    deviceId: shift.device_id,
    deviceName: device?.device_name || "Perangkat Kasir",
    openedAt: shift.opened_at,
    expectedCash: (cashRows || []).reduce((sum, row) => sum + Number(row.total_harga || 0), 0),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { admin, device, warkopId } = await requireDevice(request, ["POS"]);
    const shift = await activeShift(admin, warkopId);
    try {
      const { member } = await requireCashier(request, admin, warkopId);
      return Response.json({
        authenticated: true,
        cashier: { id: member.id, username: member.username, name: member.display_name || member.username },
        shift,
        ownsActiveShift: Boolean(shift && shift.cashierId === member.id && shift.deviceId === device.id),
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof DeviceApiError && [401, 403].includes(error.status)) {
        return Response.json({ authenticated: false, shift }, { headers: { "Cache-Control": "no-store" } });
      }
      throw error;
    }
  } catch (error) {
    return deviceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const input = actionSchema.parse(await request.json());
    const { admin, device, warkopId } = await requireDevice(request, ["POS"]);
    const { member } = await requireCashier(request, admin, warkopId);

    if (input.action === "start") {
      const { data, error } = await admin.rpc("start_cashier_shift", {
        p_warkop_id: warkopId,
        p_member_id: member.id,
        p_device_id: device.id,
      });
      if (error) {
        const activeName = error.message.match(/SHIFT_ALREADY_OPEN:([^\n]+)/)?.[1];
        if (activeName) throw new DeviceApiError(`Shift masih digunakan oleh ${activeName}. Akhiri shift tersebut terlebih dahulu.`, 409);
        throw error;
      }
      return Response.json({ shift: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    const shift = await activeShift(admin, warkopId);
    if (!shift) throw new DeviceApiError("Tidak ada shift kasir yang aktif.", 409);
    if (shift.cashierId !== member.id || shift.deviceId !== device.id) {
      throw new DeviceApiError("Shift aktif dimiliki kasir atau perangkat lain.", 403);
    }

    const { data, error } = await admin.rpc("end_cashier_shift", {
      p_shift_id: shift.id,
      p_member_id: member.id,
      p_actual_cash_deposited: input.actualCash,
      p_notes: input.notes || null,
    });
    if (error) throw error;
    return Response.json({ result: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data shift kasir tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}

