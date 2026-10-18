"use client";
import { useEffect, useState } from "react";
import type { DeviceOrder } from "@/lib/use-device-app";
import type { Pagination } from "@/lib/reporting";

type Summary = { total: number; transactionCount: number; cash: number; qris: number };
type History = { orders: DeviceOrder[]; pagination: Pagination };

// Abort obsolete reads so changing filters cannot overwrite a newer page.
export function useOrderHistory(enabled: boolean, params: string, periodParams: string, pin: string, externalRevision = 0) {
  const [page, setPage] = useState<{ key: string; value: History } | null>(null);
  const [summary, setSummary] = useState<{ key: string; value: Summary } | null>(null);
  const [pageError, setPageError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (navigator.onLine && document.visibilityState === "visible") setRevision((n) => n + 1); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("online", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setPageError("");
      try {
        if (!navigator.onLine) throw new Error("Histori lengkap memerlukan internet. Data yang sudah tampil belum diperbarui.");
        const response = await fetch(`/api/device/history?${params}`, { cache: "no-store", signal: controller.signal, headers: { "X-Device-Type": "POS", "X-Audit-Pin": pin } });
        const value = await response.json();
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) { setPage(null); setSummary(null); }
          throw new Error(value.error || "Histori gagal dimuat.");
        }
        if (!controller.signal.aborted) setPage({ key: params, value });
      } catch (error) {
        if (!controller.signal.aborted) setPageError(error instanceof Error ? error.message : "Histori gagal dimuat.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [enabled, params, pin, revision, externalRevision]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSummaryError("");
      try {
        if (!navigator.onLine) throw new Error("Ringkasan periode belum diperbarui karena perangkat offline.");
        const response = await fetch(`/api/device/history/summary?${periodParams}`, { cache: "no-store", signal: controller.signal, headers: { "X-Device-Type": "POS", "X-Audit-Pin": pin } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Ringkasan periode gagal dimuat.");
        if (!controller.signal.aborted) setSummary({ key: periodParams, value: result.data });
      } catch (error) { if (!controller.signal.aborted) setSummaryError(error instanceof Error ? error.message : "Ringkasan gagal dimuat."); }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [enabled, periodParams, pin, revision, externalRevision]);
  return { data: page?.key === params ? page.value : null, summary: summary?.key === periodParams ? summary.value : null,
    loading: loading || (enabled && page?.key !== params && !pageError), error: pageError || summaryError, refresh: () => setRevision((n) => n + 1) };
}
