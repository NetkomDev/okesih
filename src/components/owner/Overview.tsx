"use client";
import { logoutUser } from "@/lib/auth-helpers";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect,useState } from "react";
import { ownerFetch } from "./helpers";
import { useOwnerData } from "./provider";
import OwnerSkeleton from "./OwnerSkeleton";
const BillingModal = dynamic(() => import("./BillingModal"));
type RevenuePeriod = "day" | "week" | "month" | "year";
type RevenueData = { period: RevenuePeriod; series: { label: string; value: number }[]; total: number; average: number; transactionCount: number };

function money(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}
export default function OverviewFeature() {
const { ready, data, error, setError, notice, setNotice, busy, setBusy, loadDashboard } = useOwnerData("overview");

const isAuthorized = true;
const pathname = "/owner";
const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("day");
const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
const [revenueLoading, setRevenueLoading] = useState(false);
const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);

const closeActiveCashierShift = async () => {
    if (!data?.activeCashier) return;
    const amount = window.prompt(`Masukkan kas fisik yang diserahkan oleh ${data.activeCashier.name} (Rp)`, "0");
    if (amount === null) return;
    const actualCash = Number(amount.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(actualCash) || actualCash < 0) return setError("Nominal kas fisik tidak valid.");
    setBusy(true); setError("");
    try {
      await ownerFetch("/api/owner/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: data.activeCashier.shiftId, actualCash, notes: "Ditutup oleh Owner dari Dashboard Owner." }),
      });
      setNotice("Shift kasir berhasil diakhiri.");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shift kasir gagal diakhiri.");
    } finally {
      setBusy(false);
    }
  };
useEffect(() => {
    if (!isAuthorized || pathname !== "/owner") return;
    let cancelled = false;
    const loadRevenue = async () => {
      setRevenueLoading(true);
      try {
        const payload = await ownerFetch(`/api/owner/revenue?period=${revenuePeriod}`, { cache: "no-store" });
        if (!cancelled) setRevenueData(payload.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Grafik omzet gagal dimuat.");
      } finally {
        if (!cancelled) setRevenueLoading(false);
      }
    };
    void loadRevenue();
    return () => { cancelled = true; };
  }, [isAuthorized, pathname, revenuePeriod, setError]);
const { metrics } = data;
const revenueSeries = revenueData?.series || [];
const revenueMaximum = Math.max(...revenueSeries.map((item) => item.value), 1);
const chartWidth = 900;
const chartHeight = 230;
const chartPadding = 18;
const revenuePoints = revenueSeries.map((item, index) => {
    const x = revenueSeries.length <= 1 ? chartWidth / 2 : chartPadding + (index / (revenueSeries.length - 1)) * (chartWidth - chartPadding * 2);
    const y = chartHeight - chartPadding - (item.value / revenueMaximum) * (chartHeight - chartPadding * 2);
    return { ...item, x, y };
  });
const linePath = revenuePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
const areaPath = revenuePoints.length ? `${linePath} L${revenuePoints.at(-1)?.x},${chartHeight - chartPadding} L${revenuePoints[0].x},${chartHeight - chartPadding} Z` : "";
if (!ready) {
  if (error) return <div className="owner-error" role="alert">{error}</div>;
  return <OwnerSkeleton variant="overview" />;
}
return (<>{error && <div className="owner-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}{true && <section id="ringkasan">
            <div className="owner-section-heading"><div><h1>Ringkasan Penjualan Hari Ini</h1><p>Pantau omzet tunai vs QRIS, kas di laci kasir, dan pembayaran sewa OKESIH.</p></div></div>
            <div className={`owner-cashier-status ${data.activeCashier ? "is-active" : ""}`}>
              <div><small>KASIR SAAT INI</small>{data.activeCashier ? <><b>● {data.activeCashier.name}</b><span>{data.activeCashier.deviceName} · mulai {new Date(data.activeCashier.openedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span></> : <><b>Belum ada shift aktif</b><span>Kasir perlu masuk pada perangkat POS yang sudah dipairing.</span></>}</div>
              {data.activeCashier && <button className="btn-secondary" disabled={busy} onClick={() => void closeActiveCashierShift()}>Akhiri Shift</button>}
            </div>
            <div className="owner-metrics">
              <article className="metric-revenue"><span className="metric-icon">↗</span><small>TOTAL OMZET PENJUALAN</small><strong>{money(metrics.total)}</strong><p>{metrics.receiptCount} transaksi hari ini</p></article>
              <article className="metric-payment"><span className="metric-icon">◈</span><small>RINCIAN PEMBAYARAN</small><b>Tunai <em>{money(metrics.cash)}</em></b><b>QRIS <em>{money(metrics.qris)}</em></b></article>
              <article className="metric-cash"><span className="metric-icon">▤</span><small>UANG FISIK DI LACI KASIR</small><strong className="green">{money(metrics.cash)}</strong><p>Nilai berdasarkan pembayaran tunai</p></article>
              <article
                className="metric-billing is-clickable"
                onClick={() => {
                  setIsBillingModalOpen(true);
                  
                }}
                title="Klik untuk rincian tagihan sewa SaaS & konfirmasi pembayaran"
                style={{ cursor: "pointer" }}
              >
                <span className="metric-icon">◎</span>
                <small>SEWA SAAS OKESIH</small>
                <strong className="yellow">{money(Number(metrics.billing?.total_tagihan || 0))}</strong>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <p style={{ margin: 0 }}>{metrics.billing?.status_bayar || "Belum ditagihkan"}</p>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", background: "rgba(245, 158, 11, 0.14)", padding: "2px 8px", borderRadius: "999px" }}>
                    Bayar Sewa →
                  </span>
                </div>
              </article>
            </div>
            <section className={`owner-revenue-chart ${revenueLoading ? "is-loading" : ""}`} aria-labelledby="owner-chart-title">
              <header>
                <div><span>ANALITIK PENJUALAN</span><h2 id="owner-chart-title">Grafik Omzet Penjualan</h2><p>Pergerakan omzet dari transaksi tunai dan QRIS yang sudah tercatat.</p></div>
                <div className="owner-chart-filters" aria-label="Filter periode grafik omzet">
                  {(["day", "week", "month", "year"] as RevenuePeriod[]).map((period) => <button key={period} className={revenuePeriod === period ? "active" : ""} onClick={() => setRevenuePeriod(period)}>{({ day: "Hari", week: "Minggu", month: "Bulan", year: "Tahun" })[period]}</button>)}
                </div>
              </header>
              <div className="owner-chart-stats">
                <div><small>Total periode</small><strong>{money(revenueData?.total || 0)}</strong></div>
                <div><small>Rata-rata</small><b>{money(revenueData?.average || 0)}</b></div>
                <div><small>Transaksi</small><b>{revenueData?.transactionCount || 0} struk</b></div>
              </div>
              <div className="owner-line-chart">
                <div className="owner-y-axis"><span>{money(revenueMaximum)}</span><span>{money(Math.round(revenueMaximum / 2))}</span><span>Rp 0</span></div>
                <div className="owner-plot">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label={`Grafik omzet periode ${revenuePeriod}`}>
                    <defs><linearGradient id="ownerRevenueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f4512c" stopOpacity="0.3"/><stop offset="100%" stopColor="#f4512c" stopOpacity="0.02"/></linearGradient></defs>
                    <line x1="0" y1="18" x2="900" y2="18" className="chart-grid-line"/><line x1="0" y1="115" x2="900" y2="115" className="chart-grid-line"/><line x1="0" y1="212" x2="900" y2="212" className="chart-grid-line"/>
                    {areaPath && <path d={areaPath} fill="url(#ownerRevenueArea)"/>}
                    {linePath && <path d={linePath} className="chart-revenue-line"/>}
                    {revenuePoints.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="5" className="chart-revenue-point"><title>{point.label}: {money(point.value)}</title></circle>)}
                  </svg>
                  <div className="owner-x-axis">{revenueSeries.map((item, index) => <span key={`${item.label}-${index}`}>{item.label}</span>)}</div>
                  {!revenueLoading && revenueData?.transactionCount === 0 && <div className="owner-chart-empty"><b>Belum ada transaksi</b><span>Grafik akan terisi otomatis ketika penjualan tercatat.</span></div>}
                </div>
              </div>
            </section>
            <div className="owner-quick-grid">
              {[
                { icon: "◫", label: "Katalog Menu", desc: "Kelola daftar menu, varian, dan harga jual warkop", href: "/owner/menu" },
                { icon: "♟", label: "Akun Staf", desc: "Kelola akun login kasir dan barista / dapur", href: "/owner/staff" },
                { icon: "♙", label: "Waiter", desc: "Kelola daftar pelayan sesuai kondisi nyata usaha", href: "/owner/waiters" },
                { icon: "▣", label: "QRIS & Meja", desc: "Atur QRIS statis dan cetak stiker QR meja", href: "/owner/qris-tables" },
                { icon: "⌁", label: "Perangkat & PWA", desc: "Pairing perangkat POS, KDS, dan status aplikasi", href: "/owner/devices" },
              ].map((item) => (
                <Link key={item.href} href={item.href} prefetch={false}>
                  <span>{item.icon}</span>
                  <div>
                    <b>{item.label}</b>
                    <small>{item.desc}</small>
                  </div>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="owner-quick-arrow" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                </Link>
              ))}
            </div>

            {/* Tombol Keluar Akun Owner di Bagian Bawah Halaman Home */}
            <div className="owner-home-logout-wrap">
              <button
                type="button"
                onClick={logoutUser}
                className="owner-home-logout-btn"
                title="Keluar dari Akun Owner"
                aria-label="Keluar dari akun owner"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Keluar dari Akun Owner</span>
              </button>
            </div>
          </section>}{isBillingModalOpen && <BillingModal onClose={() => setIsBillingModalOpen(false)} onPaid={loadDashboard} setNotice={setNotice} />}</>);
}
