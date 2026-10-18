import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

export async function GET(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const requested = new URL(request.url).searchParams.get("period");
    const period = requested && ["day", "week", "month", "year"].includes(requested) ? requested : "day";
    const { data, error } = await admin.rpc("report_owner_revenue", { p_warkop_id: warkopId, p_period: period });
    if (error) throw error;
    return Response.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}
