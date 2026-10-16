import { NextRequest } from "next/server";
import { deviceErrorResponse, requireDevice } from "@/lib/device-auth";

export async function GET(request: NextRequest) {
  try {
    const { admin, device, warkopId, deviceType } = await requireDevice(request, ["POS", "KDS"]);
    const statuses = deviceType === "POS"
      ? ["AWAITING_CONFIRMATION", "COOKING", "READY"]
      : ["COOKING", "READY"];
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

    const [profileResult, menuResult, tableResult, waiterResult, shiftResult, orderResult, historyResult, ownerMemberResult] = await Promise.all([
      admin.from("warkops").select("id,nama,slug,is_active,logo_url,offline_limit_hours,queue_dismiss_seconds,qris_image_url,qris_merchant_name").eq("id", warkopId).single(),
      admin.from("menus").select("id,nama,harga,kategori,desc_menu,is_available").eq("warkop_id", warkopId).order("kategori").order("nama"),
      admin.from("warkop_tables").select("id,label,sort_order,is_active").eq("warkop_id", warkopId).eq("is_active", true).order("sort_order"),
      admin.from("waiters").select("id,name,phone,is_active").eq("warkop_id", warkopId).eq("is_active", true).order("name"),
      admin.from("shifts").select("id,opened_at,status,opened_by").eq("warkop_id", warkopId).eq("status", "OPEN").order("opened_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("transactions").select("id,table_number,nomor_antrean,total_harga,payment_method,payment_proof_url,status_pesanan,waiter_name,created_at,updated_at").eq("warkop_id", warkopId).in("status_pesanan", statuses).gte("created_at", since).order("created_at"),
      deviceType === "POS"
        ? admin.from("transactions").select("id,table_number,nomor_antrean,total_harga,payment_method,payment_proof_url,status_pesanan,waiter_name,created_at,updated_at").eq("warkop_id", warkopId).order("created_at", { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
      deviceType === "POS"
        ? admin.from("warkop_members").select("display_name").eq("warkop_id", warkopId).eq("role", "OWNER").order("created_at").limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const firstError = [profileResult.error, menuResult.error, tableResult.error, waiterResult.error, shiftResult.error, orderResult.error, historyResult.error, ownerMemberResult.error].find(Boolean);
    if (firstError) throw firstError;

    const hasAuditPin = Boolean(ownerMemberResult.data?.display_name && ownerMemberResult.data.display_name.startsWith("AUDIT_PIN:"));

    const allOrdersList = [
      ...(orderResult.data || []),
      ...(historyResult.data || []),
    ];
    const uniqueOrderIds = [...new Set(allOrdersList.map((order) => order.id))];

    const { data: items, error: itemError } = uniqueOrderIds.length
      ? await admin.from("transaction_items").select("id,transaction_id,menu_id,nama_menu,harga_satuan,qty,notes").in("transaction_id", uniqueOrderIds)
      : { data: [], error: null };
    if (itemError) throw itemError;

    const itemsByOrder = new Map<string, typeof items>();
    for (const item of items || []) {
      const current = itemsByOrder.get(item.transaction_id) || [];
      current.push(item);
      itemsByOrder.set(item.transaction_id, current);
    }

    const signedProofs = new Map<string, string>();
    const ordersWithProof = allOrdersList.filter((order) => Boolean(order.payment_proof_url));
    const uniqueProofOrders = [...new Map(ordersWithProof.map((order) => [order.id, order])).values()];
    await Promise.all(uniqueProofOrders.map(async (order) => {
      if (!order.payment_proof_url) return;
      const { data } = await admin.storage.from("bukti-transfer").createSignedUrl(order.payment_proof_url, 10 * 60);
      if (data?.signedUrl) signedProofs.set(order.id, data.signedUrl);
    }));

    return Response.json({
      serverTime: new Date().toISOString(),
      device: { id: device.id, name: device.device_name, type: deviceType, expiresAt: device.expires_at },
      profile: profileResult.data,
      menus: menuResult.data || [],
      tables: tableResult.data || [],
      waiters: waiterResult.data || [],
      shift: shiftResult.data || null,
      orders: (orderResult.data || []).map((order) => ({
        ...order,
        payment_proof_url: signedProofs.get(order.id) || null,
        items: itemsByOrder.get(order.id) || [],
      })),
      historyOrders: (historyResult.data || []).map((order) => ({
        ...order,
        payment_proof_url: signedProofs.get(order.id) || null,
        items: itemsByOrder.get(order.id) || [],
      })),
      hasAuditPin,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
