import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

type Period = "day" | "week" | "month" | "year";
type RevenueRow = { created_at: string; total_harga: number | string };

const MAKASSAR_OFFSET_MS = 8 * 60 * 60 * 1000;

const makassarFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Makassar",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

function makassarParts(date: Date) {
  const parts = makassarFormatter.formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function makassarDate(year: number, month: number, day: number, hour = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour) - MAKASSAR_OFFSET_MS);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

export async function GET(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const requestedPeriod = new URL(request.url).searchParams.get("period");
    const period: Period = requestedPeriod === "week" || requestedPeriod === "month" || requestedPeriod === "year" ? requestedPeriod : "day";
    const now = new Date();
    const current = makassarParts(now);
    const year = Number(current.year);
    const month = Number(current.month);
    const day = Number(current.day);
    const todayStart = makassarDate(year, month, day);

    let start = todayStart;
    let end = addDays(todayStart, 1);
    let buckets: { key: string; label: string; value: number }[] = [];

    if (period === "day") {
      buckets = Array.from({ length: 8 }, (_, index) => {
        const hour = index * 3;
        return { key: String(hour).padStart(2, "0"), label: `${String(hour).padStart(2, "0")}.00`, value: 0 };
      });
    } else if (period === "week") {
      const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(current.weekday);
      const daysSinceMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
      start = addDays(todayStart, -daysSinceMonday);
      end = addDays(start, 7);
      buckets = Array.from({ length: 7 }, (_, index) => {
        const bucketDate = addDays(start, index);
        const parts = makassarParts(bucketDate);
        return { key: `${parts.year}-${parts.month}-${parts.day}`, label: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)], value: 0 };
      });
    } else if (period === "month") {
      start = makassarDate(year, month, 1);
      end = month === 12 ? makassarDate(year + 1, 1, 1) : makassarDate(year, month + 1, 1);
      const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86_400_000);
      buckets = Array.from({ length: daysInMonth }, (_, index) => {
        const dateNumber = index + 1;
        return { key: `${year}-${String(month).padStart(2, "0")}-${String(dateNumber).padStart(2, "0")}`, label: String(dateNumber), value: 0 };
      });
    } else {
      start = makassarDate(year, 1, 1);
      end = makassarDate(year + 1, 1, 1);
      const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      buckets = monthLabels.map((label, index) => ({ key: String(index + 1).padStart(2, "0"), label, value: 0 }));
    }

    const { data, error } = await admin
      .from("transactions")
      .select("created_at,total_harga")
      .eq("warkop_id", warkopId)
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString())
      .not("status_pesanan", "in", "(VOID,REJECTED)")
      .order("created_at");

    if (error) throw error;

    const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    for (const row of (data || []) as RevenueRow[]) {
      const parts = makassarParts(new Date(row.created_at));
      const key = period === "day"
        ? String(Math.floor(Number(parts.hour) / 3) * 3).padStart(2, "0")
        : period === "year"
          ? parts.month
          : `${parts.year}-${parts.month}-${parts.day}`;
      const bucket = bucketsByKey.get(key);
      if (bucket) bucket.value += Number(row.total_harga || 0);
    }

    const total = buckets.reduce((sum, item) => sum + item.value, 0);
    const activeValues = buckets.filter((item) => item.value > 0).map((item) => item.value);

    return Response.json({
      data: {
        period,
        series: buckets.map(({ label, value }) => ({ label, value })),
        total,
        average: activeValues.length ? Math.round(total / activeValues.length) : 0,
        transactionCount: (data || []).length,
      },
    });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}
