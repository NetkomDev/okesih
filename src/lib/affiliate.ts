import { z } from "zod";

const rupiah = z.number().int().min(0).max(100000);
export const affiliateRatesSchema = z.object({
  saasFeePerReceipt: rupiah,
  defaultMarketingCommission: rupiah,
  coordinatorCommissionPerReceipt: rupiah,
}).refine(value => value.defaultMarketingCommission + value.coordinatorCommissionPerReceipt <= value.saasFeePerReceipt, {
  message: "Jumlah komisi marketing dan koordinator tidak boleh melebihi biaya per struk.",
});
export type MembershipLevel = "MARKETING" | "COORDINATOR";

export function isCoordinatorLevel(level: string | null | undefined): boolean {
  if (!level) return false;
  const upper = String(level).trim().toUpperCase();
  return upper === "COORDINATOR" || upper === "KOORDINATOR";
}

export function toMembershipLevel(level: string | null | undefined): MembershipLevel {
  return isCoordinatorLevel(level) ? "COORDINATOR" : "MARKETING";
}

export function membershipLevelLabel(level: string | null | undefined): "Koordinator Mitra" | "Mitra Marketing" {
  return isCoordinatorLevel(level) ? "Koordinator Mitra" : "Mitra Marketing";
}

export type CommissionEntry = {
  id: string;
  kind: "DIRECT" | "NETWORK" | "OPENING";
  amount: number;
  receipts: number;
  rate: number;
  tenantName: string | null;
  sourcePartnerName: string | null;
  billingId: string | null;
  createdAt: string;
};

