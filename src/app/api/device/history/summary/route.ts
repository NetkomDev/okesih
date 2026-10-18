import type { NextRequest } from "next/server";
import { deviceErrorResponse } from "@/lib/device-auth";
import { requireDeviceHistory } from "@/lib/device-history";

export async function GET(request: NextRequest) {
  try {
    const { admin, warkopId, range } = await requireDeviceHistory(request);
    const { data, error } = await admin.rpc("report_transaction_summary", { p_warkop_id: warkopId, p_start: range.start, p_end: range.end });
    if (error) throw error;
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return deviceErrorResponse(error); }
}
