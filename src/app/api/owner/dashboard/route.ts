import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

export async function GET(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const start = new Date(`${today}T00:00:00+08:00`).toISOString();
    const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();

    const [transactions, billing, activeShift] = await Promise.all([
      admin.rpc("report_transaction_summary", { p_warkop_id: warkopId, p_start: start, p_end: end }),
      admin.rpc("report_daily_billing", { p_warkop_id: warkopId, p_date: today }),
      admin.from("shifts").select("id,opened_by,device_id,opened_at,last_activity_at").eq("warkop_id", warkopId).eq("status", "OPEN").order("opened_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    for (const result of [transactions, billing, activeShift]) {
      if (result.error) throw result.error;
    }

    const { data: activeMember, error: memberError } = activeShift.data
      ? await admin.from("warkop_members").select("display_name,username").eq("warkop_id", warkopId).eq("id", activeShift.data.opened_by).maybeSingle()
      : { data: null, error: null };
    if (memberError) throw memberError;
    const { data: activeDevice, error: activeDeviceError } = activeShift.data?.device_id
      ? await admin.from("device_installations").select("id,device_name").eq("id", activeShift.data.device_id).maybeSingle()
      : { data: null, error: null };
    if (activeDeviceError) throw activeDeviceError;


    return Response.json({
      data: {
        metrics: { receiptCount: transactions.data.receiptCount, cash: transactions.data.cash, qris: transactions.data.qris, total: transactions.data.total, billing: billing.data },
        activeCashier: activeShift.data ? {
          shiftId: activeShift.data.id,
          memberId: activeShift.data.opened_by,
          name: activeMember?.display_name || activeMember?.username || "Kasir",
          deviceName: activeDevice?.device_name || "Perangkat Kasir",
          openedAt: activeShift.data.opened_at,
          lastActivityAt: activeShift.data.last_activity_at,
        } : null,
      },
    });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}
