"use client";

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useAuthGuard } from "@/lib/auth-helpers";
import PwaRoleMismatchModal from "@/components/PwaRoleMismatchModal";
import PwaRoleInstallModal from "@/components/PwaRoleInstallModal";



export type Tenant = {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  phone?: string;
  address?: string;
  province: string;
  cityRegency: string;
  status: "ACTIVE" | "SUSPENDED";
  paymentStatus: "PAID" | "UNPAID";
  unpaidAmount: number;
  commissionPerReceipt: number;
  joinedAt: string;
  receipts: number;
  commission: number;
};

export type Application = {
  id: string;
  business_name: string;
  owner_name: string;
  owner_phone?: string;
  address?: string;
  province: string;
  city_regency: string;
  status: "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED";
  review_notes?: string;
  created_at: string;
};

export type CommissionWithdrawal = {
  id: string;
  amount: number;
  status: "PENDING" | "PAID" | "REJECTED";
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

export type DashboardData = {
  profile: {
    name: string;
    phone: string;
    referralCode: string;
    area: string;
    commissionRate: number;
    commissionPaid: number;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  };
  applications: Application[];
  withdrawals: CommissionWithdrawal[];
  tenants: Tenant[];
  totals: {
    tenants: number;
    pending: number;
    unpaidTenants: number;
    paidTenants: number;
    receipts: number;
    commission: number;
    pendingWithdrawal: number;
    availableCommission: number;
  };
};

type MarketingContextType = {
  data: DashboardData | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: () => Promise<void>;
  isAuthorized: boolean;
};

const MarketingContext = createContext<MarketingContextType | null>(null);

export function MarketingProvider({ children }: { children: React.ReactNode }) {
  const { isAuthorized, loading: authLoading, roleMismatch } = useAuthGuard(["MARKETING"]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/marketing/dashboard", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Gagal memuat data marketing.");
      }
      setData(payload.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sinkronisasi data.");
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    queueMicrotask(() => void refresh());

    // Auto-sync data saat PWA dibuka kembali atau kembali aktif
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const onFocus = () => {
      void refresh();
    };

    window.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [isAuthorized, refresh]);

  if (roleMismatch) {
    return (
      <PwaRoleMismatchModal
        isOpen={true}
        pwaKind={roleMismatch.pwaKind}
      />
    );
  }

  return (
    <MarketingContext.Provider
      value={{
        data,
        loading: authLoading || (dataLoading && !data),
        refreshing,
        error,
        refresh,
        isAuthorized,
      }}
    >
      <PwaRoleInstallModal pwaKind="marketing" enabled={isAuthorized} />
      {children}
    </MarketingContext.Provider>
  );
}

export function useMarketingData() {
  const ctx = useContext(MarketingContext);
  if (!ctx) {
    throw new Error("useMarketingData harus digunakan di dalam MarketingProvider");
  }
  return ctx;
}
