"use client";
import { useEffect, useState } from "react";
import { ownerFetch } from "./helpers";
type RevenuePeriod = "day" | "week" | "month" | "year";
type RevenueData = {
  period: RevenuePeriod;
  series: { label: string; value: number }[];
  total: number;
  average: number;
  transactionCount: number;
};

function money(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

export default function RevenueChart() {
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("day");
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRevenueLoading(true);
      setError("");
      void ownerFetch(`/api/owner/revenue?period=${revenuePeriod}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then((payload) => {
          if (!controller.signal.aborted) setRevenueData(payload.data);
        })
        .catch((reason) => {
          if (!controller.signal.aborted) setError(reason.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setRevenueLoading(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [revenuePeriod]);
  const revenueSeries = revenueData?.series || [];
  const revenueMaximum = Math.max(
    ...revenueSeries.map((item) => item.value),
    1,
  );
  const chartWidth = 900;
  const chartHeight = 230;
  const chartPadding = 18;
  const revenuePoints = revenueSeries.map((item, index) => {
    const x =
      revenueSeries.length <= 1
        ? chartWidth / 2
        : chartPadding +
          (index / (revenueSeries.length - 1)) *
            (chartWidth - chartPadding * 2);
    const y =
      chartHeight -
      chartPadding -
      (item.value / revenueMaximum) * (chartHeight - chartPadding * 2);
    return { ...item, x, y };
  });
  const linePath = revenuePoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const areaPath = revenuePoints.length
    ? `${linePath} L${revenuePoints.at(-1)?.x},${chartHeight - chartPadding} L${revenuePoints[0].x},${chartHeight - chartPadding} Z`
    : "";
  return (
    <>
      {error && (
        <p role="alert" className="owner-error">
          {error}
        </p>
      )}
      <section
        className={`owner-revenue-chart ${revenueLoading ? "is-loading" : ""}`}
        aria-labelledby="owner-chart-title"
      >
        <header>
          <div>
            <span>PERFORMA USAHA</span>
            <h2 id="owner-chart-title">Tren penjualan</h2>
            <p>Lihat perkembangan penjualan usaha Anda.</p>
          </div>
          <div
            className="owner-chart-filters"
            aria-label="Filter periode grafik omzet"
          >
            {(["day", "week", "month", "year"] as RevenuePeriod[]).map(
              (period) => (
                <button
                  key={period}
                  className={revenuePeriod === period ? "active" : ""}
                  onClick={() => setRevenuePeriod(period)}
                >
                  {
                    {
                      day: "Hari",
                      week: "Minggu",
                      month: "Bulan",
                      year: "Tahun",
                    }[period]
                  }
                </button>
              ),
            )}
          </div>
        </header>
        <div className="owner-chart-stats">
          <div>
            <small>Total periode</small>
            <strong>{money(revenueData?.total || 0)}</strong>
          </div>
          <div>
            <small>Rata-rata</small>
            <b>{money(revenueData?.average || 0)}</b>
          </div>
          <div>
            <small>Transaksi</small>
            <b>{revenueData?.transactionCount || 0} struk</b>
          </div>
        </div>
        <div className="owner-line-chart">
          <div className="owner-y-axis">
            <span>{money(revenueMaximum)}</span>
            <span>{money(Math.round(revenueMaximum / 2))}</span>
            <span>Rp 0</span>
          </div>
          <div className="owner-plot">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`Grafik omzet periode ${revenuePeriod}`}
            >
              <defs>
                <linearGradient
                  id="ownerRevenueArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#f4512c" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f4512c" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <line
                x1="0"
                y1="18"
                x2="900"
                y2="18"
                className="chart-grid-line"
              />
              <line
                x1="0"
                y1="115"
                x2="900"
                y2="115"
                className="chart-grid-line"
              />
              <line
                x1="0"
                y1="212"
                x2="900"
                y2="212"
                className="chart-grid-line"
              />
              {areaPath && <path d={areaPath} fill="url(#ownerRevenueArea)" />}
              {linePath && <path d={linePath} className="chart-revenue-line" />}
              {revenuePoints.map((point, index) => (
                <circle
                  key={`${point.label}-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="5"
                  className="chart-revenue-point"
                >
                  <title>
                    {point.label}: {money(point.value)}
                  </title>
                </circle>
              ))}
            </svg>
            <div className="owner-x-axis">
              {revenueSeries.map((item, index) => (
                <span key={`${item.label}-${index}`}>{item.label}</span>
              ))}
            </div>
            {!revenueLoading && revenueData?.transactionCount === 0 && (
              <div className="owner-chart-empty">
                <b>Belum ada transaksi</b>
                <span>
                  Grafik akan terisi otomatis ketika penjualan tercatat.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
