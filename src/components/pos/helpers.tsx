import type { DeviceOrder } from "@/lib/use-device-app";
export function Icon({ name }: { name: "orders" | "cart" | "history" | "search" | "refresh" | "bell" | "install" | "plus" | "minus" | "close" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    orders: <><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    cart: <><path d="M3 4h2l2.2 10h9.8l2-7H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></>,
    history: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    install: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, minus: <path d="M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
export function getOrderCashier(order: DeviceOrder, currentShiftCashier?: string): string {
  if (order.cashier_name) return order.cashier_name;
  if (order.waiter_name) {
    return order.waiter_name.replace(/^Kasir:\s*/i, "").trim();
  }
  if (order.table_number === "Kasir" && currentShiftCashier) {
    return currentShiftCashier;
  }
  return "Kasir";
}
export function getCashierInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "K";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}