import { NextRequest } from "next/server";
import { z } from "zod";
import { requireCashier } from "@/lib/cashier-api";
import { DeviceApiError, assertSameOrigin, deviceErrorResponse, randomToken, requireDevice, sha256 } from "@/lib/device-auth";

const orderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  tableNumber: z.string().trim().min(1).max(20),
  paymentMethod: z.enum(["QRIS", "CASH"]),
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

    const { data: shift, error: shiftError } = await admin
      .from("shifts")
      .select("id")
      .eq("warkop_id", warkopId)
      .eq("opened_by", cashier.member.id)
      .eq("device_id", device.id)
      .eq("status", "OPEN")
      .maybeSingle();
    if (shiftError) throw shiftError;
    if (!shift) throw new DeviceApiError("Shift kasir belum aktif.", 409);

    const uniqueMenuIds = [...new Set(input.items.map((item) => item.menuId))];
    const { data: menuRows, error: menuError } = await admin
      .from("menus")
      .select("id,nama,harga,is_available")
      .eq("warkop_id", warkopId)
      .in("id", uniqueMenuIds)
      .eq("is_available", true);
    if (menuError || !menuRows || menuRows.length !== uniqueMenuIds.length) {
      throw new DeviceApiError("Salah satu menu tidak tersedia. Muat ulang daftar menu.", 400);
    }

    const menuMap = new Map(menuRows.map((menu) => [menu.id, menu]));
    const items = input.items.map((item) => {
      const menu = menuMap.get(item.menuId)!;
      return { menu_id: menu.id, name: menu.nama, price: Number(menu.harga), qty: item.qty, notes: item.notes };
    });
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    if (!Number.isFinite(total) || total <= 0) throw new DeviceApiError("Total pesanan tidak valid.", 400);

    const { data: created, error: createError } = await admin.rpc("create_customer_order", {
      p_warkop_id: warkopId,
      p_table_number: input.tableNumber,
      p_payment_method: input.paymentMethod,
      p_payment_proof_url: null,
      p_items: items,
      p_total: total,
      p_idempotency_key: input.idempotencyKey,
      p_customer_token_hash: sha256(randomToken()),
    });
    if (createError) throw createError;

    const createdOrder = created as { id?: string; queueNumber?: number; total?: number } | null;
    if (!createdOrder?.id) throw new DeviceApiError("Pesanan kasir gagal dibuat.", 500);

    const cashierName = cashier.member.display_name || cashier.member.username;
    const { data: updated, error: updateError } = await admin
      .from("transactions")
      .update({
        status_pesanan: "COOKING",
        confirmed_at: new Date().toISOString(),
        shift_id: shift.id,
        waiter_name: `Kasir: ${cashierName}`,
      })
      .eq("id", createdOrder.id)
      .eq("warkop_id", warkopId)
      .eq("status_pesanan", "AWAITING_CONFIRMATION")
      .select("id,nomor_antrean,total_harga,status_pesanan")
      .maybeSingle();
    if (updateError) throw updateError;

    let order = updated;
    if (!order) {
      const { data: existing, error: existingError } = await admin
        .from("transactions")
        .select("id,nomor_antrean,total_harga,status_pesanan")
        .eq("id", createdOrder.id)
        .eq("warkop_id", warkopId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing || existing.status_pesanan !== "COOKING") {
        throw new DeviceApiError("Pesanan tersimpan tetapi belum dapat dikirim ke dapur. Periksa daftar konfirmasi.", 409);
      }
      order = existing;
    }

    await Promise.all([
      admin.from("audit_logs").insert({
        warkop_id: warkopId,
        actor_user_id: cashier.user.id,
        device_id: device.id,
        action: "CASHIER_ORDER_CREATED",
        target_type: "transaction",
        target_id: order.id,
        metadata: { table: input.tableNumber, payment_method: input.paymentMethod, total, shift_id: shift.id, cashier: cashierName },
      }),
      admin.from("shifts").update({ last_activity_at: new Date().toISOString() }).eq("id", shift.id),
    ]);

    return Response.json({ order }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data pesanan kasir tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}
