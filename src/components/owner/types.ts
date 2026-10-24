export type MenuItem = { id: string; name: string; price: number; category: string; description: string; imageUrl: string | null; isAvailable: boolean };
export type Staff = { id: string; username: string; name: string; role: "KASIR" | "DAPUR"; status: "ACTIVE" | "INACTIVE"; onShift: boolean };
export type Waiter = { id: string; name: string; phone: string | null; is_active: boolean };
export type BusinessTable = { id: string; label: string; sort_order: number; is_active: boolean };
export type Profile = { id: string; nama: string; slug: string; address: string | null; is_active: boolean; logo_url: string | null; qris_image_url: string | null; qris_merchant_name: string | null };
export type Metrics = { receiptCount: number; cash: number; qris: number; total: number; billing: { tagihan_pokok: number; kode_unik: number; total_tagihan: number; status_bayar: string } | null };
export type RevenuePeriod = "day" | "week" | "month" | "year";
export type RevenueData = { period: RevenuePeriod; series: { label: string; value: number }[]; total: number; average: number; transactionCount: number };
export type ActiveCashier = { shiftId: string; memberId: string; name: string; deviceName: string; openedAt: string; lastActivityAt: string };
export type DashboardData = { profile: Profile; menus: MenuItem[]; staff: Staff[]; waiters: Waiter[]; tables: BusinessTable[]; metrics: Metrics; activeCashier: ActiveCashier | null };
export type DeviceInstallation = { id: string; device_type: "POS" | "KDS"; device_name: string; status: "ACTIVE" | "REVOKED" | "EXPIRED"; paired_at: string; last_seen_at: string; expires_at: string; revoked_at: string | null };
export type OwnerOnboarding = { password_changed_at: string | null; owner_pwa_installed_at: string | null; completed_at: string | null };
export type OwnerBillingData = {
  activeBilling: {
    id: string;
    tanggal: string;
    totalTransactions: number;
    tagihanPokok: number;
    kodeUnik: number;
    totalTagihan: number;
    statusBayar: "UNPAID" | "PAID" | "PENDING_REVIEW";
    buktiTransferUrl: string | null;
    graceUntil: string | null;
    createdAt: string;
  } | null;
  recentBillings: Array<{
    id: string;
    tanggal: string;
    totalTransactions: number;
    tagihanPokok: number;
    kodeUnik: number;
    totalTagihan: number;
    statusBayar: "UNPAID" | "PAID" | "PENDING_REVIEW";
    buktiTransferUrl: string | null;
  }>;
  centralPayment: {
    qrisImageUrl: string;
    qrisMerchantName: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    saasFeePerReceipt: number;
  };
  proofRetentionDays: number;
};