export type PaymentOrder = { payment_method: "CASH" | "QRIS"; payment_status?: string; order_source?: string };
export function orderPaymentLabel(order: PaymentOrder) {
  if (order.payment_status === "PAID") return order.payment_method === "CASH" ? "TUNAI · LUNAS" : "QRIS · DIKONFIRMASI";
  if (order.payment_status === "PENDING") return order.payment_method === "CASH" ? "TUNAI · BELUM DIBAYAR" : "QRIS · VERIFIKASI BUKTI";
  return `${order.payment_method === "CASH" ? "TUNAI" : "QRIS"} · PERIKSA PEMBAYARAN LAMA`;
}
