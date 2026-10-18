const offset = 8 * 60 * 60 * 1000;
export function witaRange(query: { period: "today" | "this_week" | "this_month" | "this_year" | "custom" | "all"; start?: string; end?: string }, now = new Date()) {
  if (query.period === "all") return { start: null, end: null };
  const local = new Date(now.getTime() + offset);
  const y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
  let start = Date.UTC(y, m, d), end = start + 86_400_000;
  if (query.period === "this_week") { start -= ((local.getUTCDay() + 6) % 7) * 86_400_000; end = start + 7 * 86_400_000; }
  if (query.period === "this_month") { start = Date.UTC(y, m, 1); end = Date.UTC(y, m + 1, 1); }
  if (query.period === "this_year") { start = Date.UTC(y, 0, 1); end = Date.UTC(y + 1, 0, 1); }
  if (query.period === "custom") { start = Date.parse(`${query.start}T00:00:00Z`); end = Date.parse(`${query.end}T00:00:00Z`) + 86_400_000; }
  return { start: new Date(start - offset).toISOString(), end: new Date(end - offset).toISOString() };
}
