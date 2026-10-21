import { requireAuditAccess } from "@/lib/audit-access";
import "server-only";
import type { NextRequest } from "next/server";
import { DeviceApiError, requireDevice } from "@/lib/device-auth";
import { historyQuerySchema } from "@/lib/reporting";
import { witaRange } from "@/lib/reporting-dates";

export async function requireDeviceHistory(request: NextRequest) {
  const context = await requireDevice(request, ["POS"]);
  await requireAuditAccess(request, context.admin, context.warkopId, context.device.id);
  const query = historyQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) throw new DeviceApiError("Filter atau rentang tanggal histori tidak valid.", 400);
  return { ...context, query: query.data, range: witaRange(query.data) };
}
