"use client";

import type { CommissionEntry, MembershipLevel } from "@/lib/affiliate";
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
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
    photoUrl?: string | null;
    membershipLevel: MembershipLevel;
    coordinatorCommissionRate: number;
    name: string;
    phone: string;
    username?: string;
    referralCode: string;
    area: string;
    commissionRate: number;
    commissionPaid: number;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    status?: string;
    isSuspended?: boolean;
    saldoDisembunyikan?: boolean;
  };
  commissionEntries: CommissionEntry[];
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
    saldoDisembunyikan?: boolean;
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

  const refreshInFlight = useRef<Promise<void> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSyncTime = useRef<number>(0);

  const refresh = useCallback(async (): Promise<void> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    setRefreshing(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const promise = (async () => {
      try {
        const response = await fetch("/api/marketing/dashboard", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Gagal memuat data marketing.");
        }
        setData(payload.data);
        setError("");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Terjadi kesalahan sinkronisasi data.");
      } finally {
        setDataLoading(false);
        setRefreshing(false);
        refreshInFlight.current = null;
      }
    })();

    refreshInFlight.current = promise;
    return promise;
  }, []);

  // Batalkan request in-flight saat otorisasi dicabut (misal logout atau ganti akun)
  useEffect(() => {
    if (!isAuthorized) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      refreshInFlight.current = null;
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    queueMicrotask(() => void refresh());

    // Auto-sync data saat PWA dibuka kembali atau kembali aktif dengan deduplikasi & throttle
    const handleForegroundEvent = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastSyncTime.current < 2000) return;
      lastSyncTime.current = now;
      void refresh();
    };

    const syncTimer = window.setInterval(handleForegroundEvent, 30000);
    window.addEventListener("online", handleForegroundEvent);
    window.addEventListener("visibilitychange", handleForegroundEvent);
    window.addEventListener("focus", handleForegroundEvent);

    return () => {
      window.clearInterval(syncTimer);
      window.removeEventListener("online", handleForegroundEvent);
      window.removeEventListener("visibilitychange", handleForegroundEvent);
      window.removeEventListener("focus", handleForegroundEvent);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
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

  const activeData = isAuthorized ? data : null;

  return (
    <MarketingContext.Provider
      value={{
        data: activeData,
        loading: authLoading || (dataLoading && !activeData),
        refreshing,
        error: isAuthorized ? error : "",
        refresh,
        isAuthorized,
      }}
    >
      <PwaRoleInstallModal
        pwaKind="marketing"
        title="Pasang Aplikasi Mitra Okesih"
        subtitle="Tambahkan aplikasi Mitra Okesih langsung ke layar utama HP Anda agar akses lebih cepat dan mudah tanpa membuka browser lagi."
        enabled={isAuthorized}
      />
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
