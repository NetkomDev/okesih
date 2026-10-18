"use client";
import type { Dispatch,SetStateAction } from "react";
import { createContext,useContext } from "react";
import type { AnalyticsData,AnalyticsPeriod,ConfirmModalData } from "./types";
export type Tab = "overview" | "tenants" | "marketing" | "qris_billing" | "platform_config";
type DashboardContext = {
  isDark: boolean;
  showToast: (title: string, message: string, type?: "success" | "error" | "info") => void;
  setConfirmModal: Dispatch<SetStateAction<ConfirmModalData>>;
  openDashboardView: (tab: Tab) => void;
  activeTab: Tab;
  analytics: AnalyticsData | null;
  analyticsPeriod: AnalyticsPeriod;
  setAnalyticsPeriod: Dispatch<SetStateAction<AnalyticsPeriod>>;
  analyticsLoading: boolean;
  totalTenants: number;
  setTotalTenants: (count: number) => void;
  createIntent: "tenant" | "marketing" | null;
  setCreateIntent: Dispatch<SetStateAction<"tenant" | "marketing" | null>>;
  refreshSummary: () => void;
};
export const SuperadminContext = createContext<DashboardContext | null>(null);
export function useSuperadmin() {
  const context = useContext(SuperadminContext);
  if (!context) throw new Error("SuperadminContext diperlukan.");
  return context;
}
