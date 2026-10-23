"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ownerFetch, money } from "./helpers";
import { useOwnerData } from "./provider";
import WhatsAppAdminButton from "./WhatsAppAdminButton";
import OwnerIcon from "./Icon";
import OwnerSkeleton from "./OwnerSkeleton";
const BillingModal = dynamic(() => import("./BillingModal"));
const RevenueChart = dynamic(() => import("./RevenueChart"), {
  loading: () => (
    <div className="owner-chart-placeholder" role="status">
      Menyiapkan grafik...
    </div>
  ),
});
function DeferredRevenue() {
  const target = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!target.current) return;
    if (!("IntersectionObserver" in window)) {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(target.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={target} className="owner-deferred-chart">
      {visible ? (
        <RevenueChart />
      ) : (
        <div className="owner-chart-placeholder" aria-hidden="true">
          <span className="owner-skeleton-box" />
        </div>
      )}
    </div>
  );
}
export default function OverviewFeature() {
  const {
    ready,
    refreshing,
    data,
    error,
    setError,
    notice,
    setNotice,
    busy,
    setBusy,
    loadDashboard,
  } = useOwnerData("overview");
  const [billingOpen, setBillingOpen] = useState(false);
  const { metrics, activeCashier } = data;
  const handleRetry = async () => {
    setError("");
    try {
      await loadDashboard();
    } catch {
      // Error is captured and set in useOwnerData
    }
  };
  const closeShift = async () => {
    if (!activeCashier) return;
    const amount = window.prompt(
      `Kas fisik yang diserahkan oleh ${activeCashier.name} (Rp)`,
      "0",
    );
    if (amount === null) return;
    const actualCash = Number(amount.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(actualCash) || actualCash < 0)
      return setError("Nominal kas tidak valid.");
    setBusy(true);
    setError("");
    try {
      await ownerFetch("/api/owner/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: activeCashier.shiftId,
          actualCash,
          notes: "Ditutup oleh Owner dari Dashboard Owner.",
        }),
      });
      setNotice("Shift kasir berhasil diakhiri.");
      await loadDashboard();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Shift gagal diakhiri.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!ready)
    return error ? (
      <div className="owner-home" style={{ paddingBottom: 64 }}>
        <div className="owner-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="owner-error-retry-btn"
            disabled={refreshing}
            onClick={() => void handleRetry()}
          >
            {refreshing ? (
              <>
                <span className="owner-spin-icon" aria-hidden="true">🔄</span>
                <span>Memuat...</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">🔄</span>
                <span>Coba lagi</span>
              </>
            )}
          </button>
        </div>
        <OwnerSkeleton variant="overview" />
      </div>
    ) : (
      <OwnerSkeleton variant="overview" />
    );
  const billingStatus = metrics.billing?.status_bayar;
  return (
    <div className="owner-home" style={{ paddingBottom: 64 }}>
      {error && (
        <div className="owner-error" role="alert">
          <span>{error}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="owner-error-retry-btn"
              disabled={refreshing}
              onClick={() => void handleRetry()}
            >
              {refreshing ? (
                <>
                  <span className="owner-spin-icon" aria-hidden="true">🔄</span>
                  <span>Memuat...</span>
                </>
              ) : (
                <>
                  <span aria-hidden="true">🔄</span>
                  <span>Coba lagi</span>
                </>
              )}
            </button>
            <button type="button" onClick={() => setError("")} aria-label="Tutup notifikasi">×</button>
          </div>
        </div>
      )}
      {notice && (
        <div className="owner-success" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <div className="owner-home-heading">
        <div>
          <span>RINGKASAN HARI INI</span>
          <h2>Bisnis Anda, dalam angka.</h2>
        </div>
        <span className="owner-today-badge">
          <i />
          Hari ini
        </span>
      </div>
      <section
        className="owner-sales-card"
        aria-label="Ringkasan penjualan hari ini"
      >
        <div className="owner-sales-top">
          <span>Total penjualan</span>
          <OwnerIcon name="trend" />
        </div>
        <strong className="owner-sales-total">{money(metrics.total)}</strong>
        <span className="owner-sales-count">
          <OwnerIcon name="receipt" />
          {metrics.receiptCount.toLocaleString("id-ID")} transaksi hari ini
        </span>
        <div className="owner-sales-breakdown">
          <div>
            <span>
              <OwnerIcon name="cash" />
              Tunai
            </span>
            <b>{money(metrics.cash)}</b>
          </div>
          <div>
            <span>
              <OwnerIcon name="qr" />
              QRIS
            </span>
            <b>{money(metrics.qris)}</b>
          </div>
        </div>
      </section>
      <div className="owner-home-tiles">
        <article className="owner-home-tile">
          <span className="owner-tile-icon is-green">
            <OwnerIcon name="cash" />
          </span>
          <span>Penjualan tunai</span>
          <strong>{money(metrics.cash)}</strong>
          <small>Dari transaksi hari ini</small>
        </article>
        <button
          className="owner-home-tile owner-rent-tile"
          onClick={() => setBillingOpen(true)}
          aria-label="Lihat tagihan sewa OKESIH"
        >
          <span className="owner-tile-icon">
            <OwnerIcon name="receipt" />
          </span>
          <span>Sewa OKESIH</span>
          <strong>{money(Number(metrics.billing?.total_tagihan || 0))}</strong>
          <small>
            {billingStatus === "PAID"
              ? "Sudah lunas"
              : billingStatus === "PENDING_REVIEW"
                ? "Menunggu verifikasi"
                : billingStatus === "UNPAID"
                  ? "Lihat tagihan"
                  : "Belum ditagihkan"}
            <OwnerIcon name="arrow" width={13} height={13} />
          </small>
        </button>
      </div>
      <section
        className={`owner-shift-card ${activeCashier ? "is-active" : ""}`}
        aria-label="Status kasir"
      >
        <span className="owner-shift-icon">
          <OwnerIcon name="team" />
        </span>
        <div>
          <small>KASIR SAAT INI</small>
          <b>{activeCashier?.name || "Belum ada shift aktif"}</b>
          <p>
            {activeCashier
              ? `${activeCashier.deviceName} · mulai ${new Date(activeCashier.openedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
              : "Kasir siap masuk dari perangkat POS."}
          </p>
        </div>
        {activeCashier && (
          <button disabled={busy} onClick={() => void closeShift()}>
            {busy ? "Memproses..." : "Akhiri shift"}
          </button>
        )}
      </section>
      <DeferredRevenue />
      <WhatsAppAdminButton businessName={data.profile.nama} />
      {billingOpen && (
        <BillingModal
          onClose={() => setBillingOpen(false)}
          onPaid={loadDashboard}
          setNotice={setNotice}
        />
      )}
    </div>
  );
}
