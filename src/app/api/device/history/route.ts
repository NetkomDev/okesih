import type { NextRequest } from "next/server";
import { deviceErrorResponse } from "@/lib/device-auth";
import { requireDeviceHistory } from "@/lib/device-history";
import type { DeviceOrder } from "@/lib/use-device-app";

export async function GET(request: NextRequest) {
  try {
    const { admin, warkopId, query, range } = await requireDeviceHistory(request);
    const { data, error } = await admin.rpc("report_device_history", {
      p_warkop_id: warkopId, p_start: range.start, p_end: range.end, p_status: query.status,
      p_payment: query.payment, p_search: query.search, p_page: query.page, p_page_size: query.pageSize,
    });
    if (error) throw error;
    const orders = data.orders as DeviceOrder[];
    const paths = [...new Set(orders.flatMap((order) => order.payment_proof_url ? [order.payment_proof_url] : []))];
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: proofs, error: proofError } = await admin.storage.from("bukti-transfer").createSignedUrls(paths, 600);
      if (proofError) throw proofError;
      for (const proof of proofs || []) if (proof.path && proof.signedUrl) urls.set(proof.path, proof.signedUrl);
    }
    return Response.json({ ...data, orders: orders.map((order) => ({ ...order, payment_proof_url: urls.get(order.payment_proof_url || "") || null })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return deviceErrorResponse(error); }
}
