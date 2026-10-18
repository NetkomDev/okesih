"use client";
import { useSuperadmin } from "./context";

type AnalyticsPeriod = "today" | "week" | "month" | "year";
export default function OverviewFeature() {
const { isDark, openDashboardView, activeTab, analytics, analyticsPeriod, setAnalyticsPeriod, analyticsLoading, totalTenants } = useSuperadmin();

const totalActiveTenants = analytics?.activeTenants ?? 0;
const totalAllTransactions = analytics?.receipts ?? 0;
const totalGrossSaasBilling = analytics?.grossBilling ?? 0;
const totalMarketingCommission = analytics?.marketingCommission ?? 0;
const netPlatformRevenue = analytics?.netRevenue ?? totalGrossSaasBilling - totalMarketingCommission;
const periodLabel = { today: "Hari ini", week: "Minggu ini", month: "Bulan ini", year: "Tahun ini" }[analyticsPeriod];
return (<>{activeTab === "overview" && (
            <section className="superadmin-overview" style={{ marginBottom: "2rem" }}>
          <div className="superadmin-page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1rem" }}>
            <div>
              <h1
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: isDark ? "#FFFFFF" : "#0F172A",
                }}
              >
                Resume Ekosistem Platform SaaS OKESIH
              </h1>
              <p style={{ fontSize: "0.85rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                Monitoring performa seluruh tenant warkop, bagi hasil komisi marketing lapangan, dan net revenue platform.
              </p>
            </div>
            <div className="superadmin-period-filter" aria-label="Filter periode analytics">
              {([
                ["today", "Hari ini"], ["week", "Minggu"], ["month", "Bulan"], ["year", "Tahun"],
              ] as Array<[AnalyticsPeriod, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={analyticsPeriod === value ? "is-active" : ""}
                  onClick={() => setAnalyticsPeriod(value)}
                  disabled={analyticsLoading}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="superadmin-kpi-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Card 1: Total Tenant Aktif */}
            <div
              className="glass-panel superadmin-kpi-card"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(14, 165, 233, 0.25)" : "1px solid rgba(14, 165, 233, 0.2)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark ? "none" : "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.35rem" }}>
                TENANT AKTIF
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: isDark ? "#38BDF8" : "#0284C7" }}>
                {totalActiveTenants} <span style={{ fontSize: "0.95rem", color: isDark ? "#64748B" : "#94A3B8" }}>/ {totalTenants} Warkop</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#34D399" : "#059669", marginTop: "0.4rem", fontWeight: 600 }}>
                + {analytics?.newTenants ?? 0} tenant baru • {periodLabel}
              </div>
            </div>

            {/* Card 2: Total Struk Ekosistem */}
            <div
              className="glass-panel superadmin-kpi-card"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(16, 185, 129, 0.2)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark ? "none" : "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.35rem" }}>
                TOTAL STRUK • {periodLabel.toUpperCase()}
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: isDark ? "#10B981" : "#059669" }}>
                {totalAllTransactions.toLocaleString("id-ID")}{" "}
                <span style={{ fontSize: "0.95rem", color: isDark ? "#64748B" : "#94A3B8" }}>Struk</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.4rem" }}>
                Dari seluruh pesanan meja &amp; kasir
              </div>
            </div>

            {/* Card 3: Gross Billing Platform */}
            <div
              className="glass-panel superadmin-kpi-card"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(245, 158, 11, 0.2)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark ? "none" : "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.35rem" }}>
                GROSS BILLING • {periodLabel.toUpperCase()}
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: isDark ? "#FBBF24" : "#D97706" }}>
                Rp {totalGrossSaasBilling.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#FCD34D" : "#B45309", marginTop: "0.4rem", fontWeight: 600 }}>
                Total tagihan sewa harian platform
              </div>
            </div>

            {/* Card 4: Bagi Hasil Komisi Marketing */}
            <div
              className="glass-panel superadmin-kpi-card"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(168, 85, 247, 0.25)" : "1px solid rgba(168, 85, 247, 0.2)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark ? "none" : "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.35rem" }}>
                BAGI HASIL MARKETING • {periodLabel.toUpperCase()}
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: isDark ? "#C084FC" : "#7C3AED" }}>
                Rp {totalMarketingCommission.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#E9D5FF" : "#6D28D9", marginTop: "0.4rem" }}>
                Komisi dari {analytics?.totalMarketing ?? 0} mitra sales lapangan
              </div>
            </div>

            {/* Card 5: Net Revenue Platform (DENGAN KONTRAST KONSISTEN) */}
            <div
              className="glass-panel superadmin-kpi-card superadmin-kpi-card--net-revenue"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(14, 165, 233, 0.4)" : "1px solid rgba(14, 165, 233, 0.35)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(6, 9, 14, 0.7) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark
                  ? "0 4px 20px rgba(14, 165, 233, 0.15)"
                  : "0 6px 24px rgba(14, 165, 233, 0.08)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#38BDF8" : "#0284C7", fontWeight: 800, marginBottom: "0.35rem" }}>
                NET PENDAPATAN OKESIH HQ
              </div>
              <div
                style={{
                  fontSize: "2.1rem",
                  fontWeight: 900,
                  color: isDark ? "#38BDF8" : "#0284C7",
                }}
              >
                Rp {netPlatformRevenue.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#7DD3FC" : "#0369A1", marginTop: "0.4rem", fontWeight: 700 }}>
                Gross dikurangi komisi marketing
              </div>
            </div>
          </div>

          <div className="superadmin-insights-grid">
            <div className="superadmin-insight-card">
              <div className="superadmin-insight-heading">
                <div>
                  <strong>Riwayat Pencapaian</strong>
                  <span>Rincian harian untuk {periodLabel.toLowerCase()}</span>
                </div>
                {analyticsLoading && <span className="superadmin-loading-label">Memuat…</span>}
              </div>
              <div className="superadmin-history-list">
                {(analytics?.series || []).slice(-8).reverse().map((item) => (
                  <div className="superadmin-history-row" key={item.day}>
                    <time>{new Date(`${item.day}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</time>
                    <span><strong>{Number(item.receipts).toLocaleString("id-ID")}</strong> struk</span>
                    <span>Gross <strong>Rp {Number(item.gross).toLocaleString("id-ID")}</strong></span>
                    <span>Komisi <strong>Rp {Number(item.commission).toLocaleString("id-ID")}</strong></span>
                  </div>
                ))}
                {!analyticsLoading && !(analytics?.series || []).length && (
                  <div className="superadmin-empty-state">Belum ada transaksi pada periode ini.</div>
                )}
              </div>
            </div>

            <div className="superadmin-insight-card">
              <div className="superadmin-insight-heading">
                <div>
                  <strong>Sebaran Tenant per Wilayah</strong>
                  <span>Total tenant berdasarkan provinsi</span>
                </div>
              </div>
              <div className="superadmin-region-list">
                {(analytics?.regions || []).map((region) => {
                  const max = Math.max(...(analytics?.regions || []).map((item) => Number(item.total)), 1);
                  return (
                    <div className="superadmin-region-row" key={region.province}>
                      <div><strong>{region.province}</strong><span>{region.active} aktif</span></div>
                      <div className="superadmin-region-track"><i style={{ width: `${(Number(region.total) / max) * 100}%` }} /></div>
                      <b>{region.total}</b>
                    </div>
                  );
                })}
                {!analyticsLoading && !(analytics?.regions || []).length && (
                  <div className="superadmin-empty-state">Wilayah tenant belum tersedia.</div>
                )}
              </div>
            </div>
          </div>

              {/* Quick Action Shortcuts inside Overview */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "1rem",
                  marginTop: "1.25rem",
                }}
              >
                <div
                  onClick={() => openDashboardView("tenants")}
                  className="glass-panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "14px",
                    border: isDark ? "1px solid rgba(14, 165, 233, 0.25)" : "1px solid rgba(14, 165, 233, 0.2)",
                    background: isDark
                      ? "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                      : "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "transform 0.18s ease, border-color 0.18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: isDark ? "#FFFFFF" : "#0F172A" }}>
                      🏢 Kelola Tenant Warkop
                    </div>
                    <div style={{ fontSize: "0.78rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.2rem" }}>
                      {totalTenants} warkop terdaftar • Alokasi kode unik POS
                    </div>
                  </div>
                  <span style={{ fontSize: "1.2rem", color: "#0284C7" }}>→</span>
                </div>

                <div
                  onClick={() => openDashboardView("marketing")}
                  className="glass-panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "14px",
                    border: isDark ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(16, 185, 129, 0.2)",
                    background: isDark
                      ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                      : "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "transform 0.18s ease, border-color 0.18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: isDark ? "#FFFFFF" : "#0F172A" }}>
                      🤝 Mitra Marketing Lapangan
                    </div>
                    <div style={{ fontSize: "0.78rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.2rem" }}>
                      {analytics?.totalMarketing ?? 0} mitra agen • Komisi &amp; Pencairan
                    </div>
                  </div>
                  <span style={{ fontSize: "1.2rem", color: "#10B981" }}>→</span>
                </div>

                <div
                  onClick={() => openDashboardView("qris_billing")}
                  className="glass-panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "14px",
                    border: isDark ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(245, 158, 11, 0.2)",
                    background: isDark
                      ? "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                      : "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "transform 0.18s ease, border-color 0.18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: isDark ? "#FFFFFF" : "#0F172A" }}>
                      💳 QRIS &amp; Billing SaaS Platform
                    </div>
                    <div style={{ fontSize: "0.78rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.2rem" }}>
                      Biaya SaaS flat per struk • Verifikasi mutasi
                    </div>
                  </div>
                  <span style={{ fontSize: "1.2rem", color: "#D97706" }}>→</span>
                </div>
              </div>
            </section>
          )}</>);
}
