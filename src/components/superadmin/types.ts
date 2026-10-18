export interface SaasBillingItem {
  id: string;
  warkopId: string;
  warkopName: string;
  warkopSlug: string;
  warkopLogo: string | null;
  phone?: string | null;
  tanggal: string;
  totalTransactions: number;
  tagihanPokok: number;
  kodeUnik: number;
  totalTagihan: number;
  statusBayar: "UNPAID" | "PAID" | "PENDING_REVIEW";
  statusBadge: "PAID" | "GRACE_PERIOD" | "PENDING_REVIEW" | "OVERDUE" | "UNPAID";
  buktiTransferUrl: string | null;
  ocrRawText: string | null;
  ocrBank: string;
  ocrConfidence: number;
  ocrNotes: string | null;
  graceUntil: string | null;
  createdAt: string;
}
export interface BillingSummary {
  totalBills: number;
  paidCount: number;
  totalPaidAmount: number;
  pendingCount: number;
}
export interface MarketingAgent {
  id: string;
  name: string;
  phone: string;
  email?: string;
  area: string;
  referralCode: string;
  commissionPerReceipt: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  totalTenantsAcquired: number;
  totalReceiptsGenerated: number;
  totalCommissionEarned: number;
  commissionPaid: number;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  experienceNotes?: string;
}
export interface MarketingWithdrawal {
  id: string;
  amount: number;
  status: "PENDING" | "PAID" | "REJECTED";
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  marketing_partners: { full_name: string; phone: string; referral_code: string } | null;
}
export interface TenantWarkop {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  phone: string;
  address: string;
  province: string;
  cityRegency: string;
  uniqueCodeRange: string;
  marketingAgentId?: string;
  marketingAgentName?: string;
  commissionPerReceipt: number;
  todayTransactions: number;
  totalSaasBilling: number;
  paymentStatus: "PAID" | "UNPAID" | "GRACE_PERIOD";
  status: "ACTIVE" | "SUSPENDED";
  joinedDate: string;
}
export interface TenantApplication {
  id: string;
  business_name: string;
  owner_name: string;
  owner_phone: string;
  address: string;
  province: string;
  city_regency: string;
  status: "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED";
  review_notes?: string;
  created_at: string;
  marketing_partners: { full_name: string; phone: string; city_area: string; referral_code: string; commission_rate: number } | null;
}
export interface ToastNotification {
  title: string;
  message: string;
  type: "success" | "error" | "info";
}
export interface ConfirmModalData {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: "danger" | "primary" | "success";
  onConfirm: () => void;
}
export interface NewTenantCredentials {
  name: string;
  slug: string;
  uniqueCodeRange: string;
  marketingAgentName: string;
  commissionPerReceipt: number;
  username: string;
  password: string;
  whatsappUrl: string;
}
export type AnalyticsPeriod = "today" | "week" | "month" | "year";
export type MarketingFilterStatus = "ALL" | "PENDING" | "ACTIVE" | "INACTIVE";
export interface AnalyticsData {
  totalTenants: number;
  totalMarketing: number;
  activeTenants: number;
  newTenants: number;
  receipts: number;
  grossBilling: number;
  marketingCommission: number;
  netRevenue: number;
  startAt: string;
  endAt: string;
  regions: Array<{ province: string; total: number; active: number }>;
  series: Array<{ day: string; receipts: number; gross: number; commission: number }>;
}