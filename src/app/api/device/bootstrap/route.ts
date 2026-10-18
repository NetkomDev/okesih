import { NextRequest } from "next/server";
import { deviceErrorResponse, requireDevice } from "@/lib/device-auth";

export async function GET(request: NextRequest) {
  try {
    const { admin, device, warkopId, deviceType } = await requireDevice(request, ["POS", "KDS"]);
    const includeHistory = deviceType === "POS" && request.nextUrl.searchParams.get("history") !== "0";
    const clientMetaVersion = request.nextUrl.searchParams.get("meta_version");
    const statuses = deviceType === "POS"
      ? ["AWAITING_CONFIRMATION", "COOKING", "READY"]
      : ["COOKING", "READY"];
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

    // 1. Ambil profil warkop untuk memeriksa status aktif dan versi metadata (updated_at)
    const profileResult = await admin
      .from("warkops")
      .select("id,nama,slug,is_active,logo_url,offline_limit_hours,queue_dismiss_seconds,qris_image_url,qris_merchant_name,updated_at")
      .eq("id", warkopId)
      .single();

    if (profileResult.error) throw profileResult.error;

    const currentMetaVersion = profileResult.data?.updated_at || "";
    const isMetadataUnchanged = Boolean(
      deviceType === "POS" &&
      clientMetaVersion &&
      clientMetaVersion === currentMetaVersion
    );

    // 2. Jika versi metadata sama, lewati query menu, meja, dan pelayan
    const [menuResult, tableResult, waiterResult, shiftResult, orderResult, historyResult, ownerMemberResult] = await Promise.all([
      deviceType === "POS" && !isMetadataUnchanged
        ? admin.from("menus").select("id,nama,harga,kategori,desc_menu,is_available").eq("warkop_id", warkopId).order("kategori").order("nama")
        : Promise.resolve({ data: null, error: null }),
      deviceType === "POS" && !isMetadataUnchanged
        ? admin.from("warkop_tables").select("id,label,sort_order,is_active").eq("warkop_id", warkopId).eq("is_active", true).order("sort_order")
        : Promise.resolve({ data: null, error: null }),
      deviceType === "POS" && !isMetadataUnchanged
        ? admin.from("waiters").select("id,name,phone,is_active").eq("warkop_id", warkopId).eq("is_active", true).order("name")
        : Promise.resolve({ data: null, error: null }),
      deviceType === "POS"
        ? admin.from("shifts").select("id,opened_at,status,opened_by").eq("warkop_id", warkopId).eq("status", "OPEN").order("opened_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      admin.from("transactions").select("id,table_number,nomor_antrean,total_harga,payment_method,payment_proof_url,status_pesanan,waiter_name,created_at,updated_at").eq("warkop_id", warkopId).in("status_pesanan", statuses).gte("created_at", since).order("created_at"),
      includeHistory
        ? admin.from("transactions").select("id,table_number,nomor_antrean,total_harga,payment_method,payment_proof_url,status_pesanan,waiter_name,created_at,updated_at").eq("warkop_id", warkopId).order("created_at", { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
      deviceType === "POS"
        ? admin.from("warkop_members").select("display_name").eq("warkop_id", warkopId).eq("role", "OWNER").order("created_at").limit(1).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const firstError = [menuResult.error, tableResult.error, waiterResult.error, shiftResult.error, orderResult.error, historyResult.error, ownerMemberResult.error].find(Boolean);
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
    if (uniqueProofOrders.length) {
      const paths = [...new Set(uniqueProofOrders.map((order) => order.payment_proof_url as string))];
      const { data: proofs } = await admin.storage.from("bukti-transfer").createSignedUrls(paths, 10 * 60);
      const urlsByPath = new Map((proofs || []).map((proof) => [proof.path, proof.signedUrl]));
      for (const order of uniqueProofOrders) {
        const url = urlsByPath.get(order.payment_proof_url!);
        if (url) signedProofs.set(order.id, url);
      }
    }

    return Response.json({
      serverTime: new Date().toISOString(),
      metadataVersion: currentMetaVersion,
      metadataModified: !isMetadataUnchanged,
      device: { id: device.id, name: device.device_name, type: deviceType, expiresAt: device.expires_at },
      profile: profileResult.data,
      menus: isMetadataUnchanged ? null : (menuResult.data || []),
      tables: isMetadataUnchanged ? null : (tableResult.data || []),
      waiters: isMetadataUnchanged ? null : (waiterResult.data || []),
      shift: shiftResult.data || null,
      orders: (orderResult.data || []).map((order) => ({
        ...order,
        payment_proof_url: signedProofs.get(order.id) || null,
        items: itemsByOrder.get(order.id) || [],
      })),
      ...(includeHistory ? { historyOrders: (historyResult.data || []).map((order) => ({
        ...order,
        payment_proof_url: signedProofs.get(order.id) || null,
        items: itemsByOrder.get(order.id) || [],
      })) } : {}),
      hasAuditPin,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return deviceErrorResponse(error);
  }
}
