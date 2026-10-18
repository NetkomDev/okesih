import "server-only";
import type { NextRequest } from "next/server";
import { DeviceApiError, requireDevice } from "@/lib/device-auth";
import { historyQuerySchema } from "@/lib/reporting";
import { witaRange } from "@/lib/reporting-dates";

export async function requireDeviceHistory(request: NextRequest) {
  const context = await requireDevice(request, ["POS"]);
  const { data: owner, error } = await context.admin.from("warkop_members")
    .select("display_name").eq("warkop_id", context.warkopId).eq("role", "OWNER").order("created_at").limit(1).maybeSingle();
  if (error) throw error;
  if (owner?.display_name?.startsWith("AUDIT_PIN:") && owner.display_name.slice(10).trim() !== request.headers.get("X-Audit-Pin")?.trim()) {
    throw new DeviceApiError("Masukkan PIN owner untuk membuka histori pesanan.", 403);
  }
  const query = historyQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) throw new DeviceApiError("Filter atau rentang tanggal histori tidak valid.", 400);
  return { ...context, query: query.data, range: witaRange(query.data) };
}
