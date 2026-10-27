export type CustomerOrderSession = {
  order: { id: string; queueNumber: number; total: number };
  token: string;
  tableId: string;
  tableNumber: string;
  paymentMethod: "QRIS" | "CASH";
  savedAt: number;
};
type SessionStore = Pick<Storage, "getItem" | "setItem">;
const retentionMs = 24 * 60 * 60 * 1000;

export function customerSessionStorage(): SessionStore | null {
  try { return window.sessionStorage; } catch { return null; }
}

export function readCustomerOrders(storage: SessionStore | null, slug: string, now = Date.now()): CustomerOrderSession[] {
  try {
    const rows: unknown = JSON.parse(storage?.getItem(`okesih-orders:${slug}`) || "[]");
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is CustomerOrderSession =>
      row && typeof row.token === "string" && row.token.length >= 30 &&
      typeof row.order?.id === "string" && Number.isFinite(row.order?.total) && Number.isFinite(row.order?.queueNumber) &&
      typeof row.tableId === "string" && typeof row.tableNumber === "string" &&
      ["CASH", "QRIS"].includes(row.paymentMethod) && Number.isFinite(row.savedAt) &&
      row.savedAt <= now && now - row.savedAt < retentionMs
    ).slice(0, 10);
  } catch { return []; }
}

export function rememberCustomerOrder(storage: SessionStore | null, slug: string, order: CustomerOrderSession) {
  const rows = [order, ...readCustomerOrders(storage, slug).filter(row => row.order.id !== order.order.id)].slice(0, 10);
  try { storage?.setItem(`okesih-orders:${slug}`, JSON.stringify(rows)); } catch { /* A successful server order must remain visible when browser storage is full. */ }
  return rows;
}

export function resolveCustomerTable(
  tables: { id: string; label: string }[],
  params: { id: string; label: string; explicit: boolean },
  cached?: { id?: string; label?: string } | null,
) {
  if (params.explicit) {
    // An explicit identity must never fall back to a different table.
    return params.id ? tables.find(table => table.id === params.id) :
      tables.find(table => table.label.trim().toLowerCase() === params.label.trim().toLowerCase());
  }
  return cached?.id ? tables.find(table => table.id === cached.id) :
    tables.find(table => table.label === cached?.label);
}
