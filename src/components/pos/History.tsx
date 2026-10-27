"use client";
import { orderPaymentLabel } from "@/lib/order-payment";
import { useCashierShift } from "@/components/CashierShiftGate";
import Pagination from "@/components/Pagination";
import { Icon,getCashierInitials,getOrderCashier } from "@/components/pos/helpers";
import { witaRange } from "@/lib/reporting-dates";
import { useOrderHistory } from "@/lib/use-order-history";
import { memo,useMemo,useState } from "react";
import type { HistoryProps } from "./types";
type DateFilterMode = "today" | "this_week" | "this_month" | "this_year" | "custom" | "all";
type DateFilterState = {
  mode: DateFilterMode;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
};
function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function getDateRangeForMode(mode: DateFilterMode, customStart?: string, customEnd?: string): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();
  if (mode === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end, label: "HARI INI" };
  }
  if (mode === "this_week") {
    // Senin sebagai awal minggu (Indonesia / ISO)
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Senin, 6 = Minggu
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59, 999);
    return { start, end, label: "MINGGU INI" };
  }
  if (mode === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, label: "BULAN INI" };
  }
  if (mode === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end, label: "TAHUN INI" };
  }
  if (mode === "custom" && (customStart || customEnd)) {
    const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(2000, 0, 1);
    const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : new Date(2099, 11, 31);
    const label = customStart && customEnd && customStart === customEnd
      ? new Date(`${customStart}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
      : `${customStart ? new Date(`${customStart}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "..."} - ${customEnd ? new Date(`${customEnd}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "..."}`;
    return { start, end, label: label.toUpperCase() };
  }
  return { start: null, end: null, label: "SEMUA WAKTU" };
}

function History({ data, online, historyPin, lockHistory, setSelected, revision }: HistoryProps) {
const app = { data, online };
const view = "history";
const historyUnlocked = true;
const shift = useCashierShift();
const [historySearch, setHistorySearch] = useState("");
const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");
const [historyPaymentFilter, setHistoryPaymentFilter] = useState("ALL");
const [historyDateFilter, setHistoryDateFilter] = useState<DateFilterState>({ mode: "today" });
const [dateModalOpen, setDateModalOpen] = useState(false);
const [tempCustomStart, setTempCustomStart] = useState("");
const [tempCustomEnd, setTempCustomEnd] = useState("");
const [historyPage, setHistoryPage] = useState(1);
const activeDateRange = useMemo(() => getDateRangeForMode(historyDateFilter.mode, historyDateFilter.startDate, historyDateFilter.endDate), [historyDateFilter]);
const periodParams = new URLSearchParams({ period: historyDateFilter.mode });
if (historyDateFilter.startDate) periodParams.set("start", historyDateFilter.startDate);
if (historyDateFilter.endDate) periodParams.set("end", historyDateFilter.endDate);
const historyParams = new URLSearchParams(periodParams);
historyParams.set("page", String(historyPage)); historyParams.set("pageSize", "25");
historyParams.set("status", historyStatusFilter); historyParams.set("payment", historyPaymentFilter); historyParams.set("search", historySearch);
const history = useOrderHistory(view === "history" && !!app.data && (historyUnlocked || !app.data.hasAuditPin), historyParams.toString(), periodParams.toString(), historyPin, revision);
const cachedHistory = useMemo(() => {
    if (app.online) return [];
    const range = witaRange({ period: historyDateFilter.mode, start: historyDateFilter.startDate, end: historyDateFilter.endDate });
    const orders = new Map((app.data?.historyOrders || []).map((order) => [order.id, order]));
    for (const order of app.data?.orders || []) orders.set(order.id, order);
    return [...orders.values()].filter((order) => (!range.start || Date.parse(order.created_at) >= Date.parse(range.start)) && (!range.end || Date.parse(order.created_at) < Date.parse(range.end))
      && (historyStatusFilter === "ALL" || order.status_pesanan === historyStatusFilter) && (historyPaymentFilter === "ALL" || order.payment_method === historyPaymentFilter)
      && `${getOrderCashier(order)} ${order.table_number} ${order.nomor_antrean} ${order.items.map((item) => item.nama_menu).join(" ")}`.toLowerCase().includes(historySearch.trim().toLowerCase()))
      .sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  }, [app.online, app.data, historyDateFilter, historyStatusFilter, historyPaymentFilter, historySearch]);
const filteredHistoryOrders = app.online ? history.data?.orders || [] : cachedHistory.slice((historyPage-1)*25, historyPage*25);
const historyPagination = app.online ? history.data?.pagination || { page: historyPage, pageSize: 25, total: 0, totalPages: 1 }
    : { page: historyPage, pageSize: 25, total: cachedHistory.length, totalPages: Math.max(1, Math.ceil(cachedHistory.length/25)) };
const auditStats = app.online && history.summary ? { totalOmzet: history.summary.total, totalCount: history.summary.transactionCount, cashTotal: history.summary.cash, qrisTotal: history.summary.qris } : null;
const openDateFilterModal = () => {
    const todayStr = formatIsoDate(new Date());
    setTempCustomStart(historyDateFilter.startDate || todayStr);
    setTempCustomEnd(historyDateFilter.endDate || todayStr);
    setDateModalOpen(true);
  };
const applyCustomDateRange = () => {
    if (!tempCustomStart && !tempCustomEnd) {
      setHistoryPage(1); setHistoryDateFilter({ mode: "today" });
    } else {
      setHistoryPage(1); setHistoryDateFilter({
        mode: "custom",
        startDate: tempCustomStart || tempCustomEnd,
        endDate: tempCustomEnd || tempCustomStart,
      });
    }
    setDateModalOpen(false);
  };
return (<><main className="pos-history-page">
      <section className="pos-hero-row">
        <div className="pos-history-intro">
          <small>REKAP TRANSAKSI</small>
          <h1>Histori Pesanan &amp; Audit Kasir</h1>
          <p>Periode mengikuti konfirmasi kasir (WITA); transaksi lama tanpa konfirmasi dan pesanan pending mengikuti waktu pemesanan. Omzet tunai berbeda dari kas yang sudah diterima.</p>
        </div>
        <div className="pos-history-actions">
          {app.data?.hasAuditPin && (
            <button
              type="button"
              className="pos-history-lock-button"
              onClick={lockHistory}
              title="Kunci kembali akses audit"
            >
              <span aria-hidden="true">🔒</span> Kunci Audit
            </button>
          )}
          <button className="pos-history-sync-button" type="button" onClick={history.refresh} disabled={history.loading || !app.online}><Icon name="refresh"/> Sinkronkan</button>
        </div>
      </section>

      {/* KPI Audit Card */}
      <section className="pos-audit-stats">
        <button
          type="button"
          className="pos-audit-card omzet pos-card-clickable"
          onClick={openDateFilterModal}
          title="Klik untuk memilih rentang waktu filter audit"
        >
          <div className="pos-audit-icon">💰</div>
          <div>
            <small>
              <span>OMZET</span>
              <span className="pos-audit-period-tag">{activeDateRange.label}</span>
            </small>
            <strong>Rp {auditStats ? auditStats.totalOmzet.toLocaleString("id-ID") : "—"}</strong>
            <p>{auditStats ? auditStats.totalCount : "—"} transaksi · Klik untuk ubah filter</p>
          </div>
          <div className="pos-audit-card-action-hint" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </button>
        <article className="pos-audit-card orders">
          <div className="pos-audit-icon">🧾</div>
          <div>
            <small>TOTAL STRUK</small>
            <strong>{auditStats ? auditStats.totalCount : "—"} Struk</strong>
            <p>Seluruh status pesanan</p>
          </div>
        </article>
        <article className="pos-audit-card cash">
          <div className="pos-audit-icon">💵</div>
          <div>
            <small>TOTAL KAS TUNAI</small>
            <strong>Rp {auditStats ? auditStats.cashTotal.toLocaleString("id-ID") : "—"}</strong>
            <p>Uang fisik di laci kasir</p>
          </div>
        </article>
        <article className="pos-audit-card qris">
          <div className="pos-audit-icon">📱</div>
          <div>
            <small>TOTAL NON-TUNAI (QRIS)</small>
            <strong>Rp {auditStats ? auditStats.qrisTotal.toLocaleString("id-ID") : "—"}</strong>
            <p>Masuk rekening usaha</p>
          </div>
        </article>
      </section>

      {!app.online && <p role="status">Mode offline: hanya snapshot pesanan terakhir yang tersedia, bukan seluruh histori. Ringkasan periode memerlukan internet.</p>}
      {history.error && <p role="alert">{history.error}</p>}
      {history.loading && <p role="status">Memuat histori...</p>}
      <Pagination pagination={historyPagination} onPage={setHistoryPage} loading={history.loading} />
      {/* Toolbar Filter & Pencarian */}
      <section className="pos-audit-toolbar">
        <div className="pos-audit-toolbar-heading">
          <div>
            <strong>Temukan transaksi</strong>
            <small>{filteredHistoryOrders.length} transaksi ditampilkan</small>
          </div>
          <span>{activeDateRange.label}</span>
        </div>
        <label className="pos-audit-search">
          <Icon name="search"/>
          <input
            type="text"
            value={historySearch}
            onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
            placeholder="Cari kasir, meja, antrean, atau menu..."
          />
        </label>

        <div className="pos-audit-filters">
          <div className="pos-audit-filter-block">
            <span>Periode</span>
            <div className="pos-audit-pill-group">
              <button
                className={historyDateFilter.mode === "today" ? "active" : ""}
                onClick={() => { setHistoryPage(1); setHistoryDateFilter({ mode: "today" }); }}
              >
                Hari Ini
              </button>
              <button
                className={historyDateFilter.mode === "this_week" ? "active" : ""}
                onClick={() => { setHistoryPage(1); setHistoryDateFilter({ mode: "this_week" }); }}
              >
                Minggu Ini
              </button>
              <button
                className={historyDateFilter.mode === "this_month" ? "active" : ""}
                onClick={() => { setHistoryPage(1); setHistoryDateFilter({ mode: "this_month" }); }}
              >
                Bulan Ini
              </button>
              <button
                className={historyDateFilter.mode === "this_year" ? "active" : ""}
                onClick={() => { setHistoryPage(1); setHistoryDateFilter({ mode: "this_year" }); }}
              >
                Tahun Ini
              </button>
              <button
                className={historyDateFilter.mode === "custom" || historyDateFilter.mode === "all" ? "active" : ""}
                onClick={openDateFilterModal}
              >
                {historyDateFilter.mode === "custom" ? "Custom 📅" : "Lainnya ▾"}
              </button>
            </div>
          </div>

          <div className="pos-audit-filter-block">
            <span>Pembayaran</span>
            <div className="pos-audit-pill-group">
              <button
                className={historyPaymentFilter === "ALL" ? "active" : ""}
                onClick={() => { setHistoryPaymentFilter("ALL"); setHistoryPage(1); }}
              >
                Semua
              </button>
              <button
                className={historyPaymentFilter === "CASH" ? "active" : ""}
                onClick={() => { setHistoryPaymentFilter("CASH"); setHistoryPage(1); }}
              >
                Tunai
              </button>
              <button
                className={historyPaymentFilter === "QRIS" ? "active" : ""}
                onClick={() => { setHistoryPaymentFilter("QRIS"); setHistoryPage(1); }}
              >
                QRIS
              </button>
            </div>
          </div>

          <div className="pos-audit-filter-block">
            <span>Status</span>
            <div className="pos-audit-pill-group">
              <button
                className={historyStatusFilter === "ALL" ? "active" : ""}
                onClick={() => { setHistoryStatusFilter("ALL"); setHistoryPage(1); }}
              >
                Semua
              </button>
              <button
                className={historyStatusFilter === "DONE" ? "active" : ""}
                onClick={() => { setHistoryStatusFilter("DONE"); setHistoryPage(1); }}
              >
                Selesai
              </button>
              <button
                className={historyStatusFilter === "COOKING" ? "active" : ""}
                onClick={() => { setHistoryStatusFilter("COOKING"); setHistoryPage(1); }}
              >
                Dapur
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tabel Histori & Audit Desktop / Tablet */}
      <div className="pos-history-table-wrapper">
        <table className="pos-history-table">
          <colgroup>
            <col className="pos-history-col-order" />
            <col className="pos-history-col-cashier" />
            <col className="pos-history-col-items" />
            <col className="pos-history-col-payment" />
            <col className="pos-history-col-status" />
            <col className="pos-history-col-total" />
            <col className="pos-history-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>Pesanan</th>
              <th>Kasir Penanggung Jawab</th>
              <th>Ringkasan Menu</th>
              <th>Pembayaran</th>
              <th>Status</th>
              <th>Total Transaksi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistoryOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px" }}>
                  <div style={{ color: "#64748b", fontWeight: 750, fontSize: "14px" }}>
                    Tidak ada transaksi histori yang cocok dengan filter.
                  </div>
                </td>
              </tr>
            ) : (
              filteredHistoryOrders.map((order) => {
                const cashier = getOrderCashier(order, shift?.cashierName);
                const orderTime = new Date(order.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const orderDate = new Date(order.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                });
                const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
                const itemsSummary = order.items.map((i) => `${i.qty}× ${i.nama_menu}`).join(", ");

                return (
                  <tr key={order.id}>
                    <td>
                      <div className="pos-history-order-cell">
                        <div className="pos-audit-queue">
                          <strong>#{String(order.nomor_antrean).padStart(3, "0")}</strong>
                          <small>{orderDate} · {orderTime}</small>
                        </div>
                        <span className="pos-audit-table-tag">
                          {order.table_number === "Kasir" ? "Kasir / Take away" : `Meja ${order.table_number}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="pos-audit-cashier-badge" title={`Kasir penanggung jawab: ${cashier}`}>
                        <span className="pos-cashier-avatar">{getCashierInitials(cashier)}</span>
                        <span className="pos-cashier-text">{cashier}</span>
                      </div>
                    </td>
                    <td>
                      <div className="pos-audit-items-desc" title={itemsSummary}>
                        <b>{itemsSummary || "Pesanan"}</b>
                        <small>{itemCount} total item dipesan</small>
                      </div>
                    </td>
                    <td>
                      <span className={`pos-audit-pay-pill ${order.payment_method.toLowerCase()}`}>
                        {orderPaymentLabel(order)}
                      </span>
                    </td>
                    <td>
                      <span className={`pos-audit-status-pill ${order.status_pesanan.toLowerCase()}`}>
                        {order.status_pesanan === "DONE"
                          ? "Selesai"
                          : order.status_pesanan === "READY"
                          ? "Siap Diantar"
                          : order.status_pesanan === "COOKING"
                          ? "Disiapkan"
                          : order.status_pesanan === "AWAITING_CONFIRMATION"
                          ? "Menunggu"
                          : order.status_pesanan === "REJECTED"
                          ? "Ditolak"
                          : order.status_pesanan}
                      </span>
                    </td>
                    <td className="pos-audit-total-cell">
                      Rp {Number(order.total_harga).toLocaleString("id-ID")}
                    </td>
                    <td>
                      <button
                        className="pos-audit-action-btn"
                        onClick={() => setSelected(order)}
                        title="Lihat detail pesanan dan audit"
                      >
                        Detail Struk
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Tampilan Mobile: Kartu Transaksi Adaptif Tanpa Scroll Horizontal */}
      <div className="pos-history-mobile-list" aria-label="Daftar transaksi histori mobile">
        <div className="pos-history-list-heading">
          <div>
            <strong>Daftar transaksi</strong>
            <small>Ketuk kartu untuk melihat detail struk</small>
          </div>
          <span>{filteredHistoryOrders.length}</span>
        </div>
        {filteredHistoryOrders.length === 0 ? (
          <div className="pos-history-mobile-empty">
            <span className="pos-hme-icon">🔍</span>
            <strong>Tidak ada transaksi</strong>
            <p>Tidak ada riwayat transaksi yang cocok dengan filter atau kata kunci pencarian.</p>
          </div>
        ) : (
          filteredHistoryOrders.map((order) => {
            const cashier = getOrderCashier(order, shift?.cashierName);
            const orderTime = new Date(order.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const orderDate = new Date(order.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            });
            const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
            const itemsSummary = order.items.map((i) => `${i.qty}× ${i.nama_menu}`).join(", ");
            const statusLabel =
              order.status_pesanan === "DONE"
                ? "Selesai"
                : order.status_pesanan === "READY"
                ? "Siap Diantar"
                : order.status_pesanan === "COOKING"
                ? "Disiapkan"
                : order.status_pesanan === "AWAITING_CONFIRMATION"
                ? "Menunggu"
                : order.status_pesanan === "REJECTED"
                ? "Ditolak"
                : order.status_pesanan;

            return (
              <article
                key={`mobile-${order.id}`}
                className="pos-history-mobile-card"
                onClick={() => setSelected(order)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(order);
                  }
                }}
              >
                <header className="pos-hm-header">
                  <div className="pos-hm-queue-wrap">
                    <strong className="pos-hm-queue-num">#{String(order.nomor_antrean).padStart(3, "0")}</strong>
                    <span className="pos-hm-table-tag">
                      {order.table_number === "Kasir" ? "Take away / Kasir" : `Meja ${order.table_number}`}
                    </span>
                  </div>
                  <span className={`pos-audit-status-pill ${order.status_pesanan.toLowerCase()}`}>
                    {statusLabel}
                  </span>
                </header>

                <div className="pos-hm-items-wrap">
                  <p className="pos-hm-items-text">{itemsSummary || "Pesanan"}</p>
                  <small className="pos-hm-items-count">{itemCount} total item dipesan</small>
                </div>

                <div className="pos-hm-meta-row">
                  <div className="pos-hm-cashier-badge">
                    <span className="pos-cashier-avatar">{getCashierInitials(cashier)}</span>
                    <span className="pos-hm-cashier-name">{cashier}</span>
                  </div>
                  <span className="pos-hm-time">{orderDate} · {orderTime}</span>
                </div>

                <footer className="pos-hm-footer">
                  <span className={`pos-audit-pay-pill ${order.payment_method.toLowerCase()}`}>
                    {orderPaymentLabel(order)}
                  </span>
                  <div className="pos-hm-amount-action">
                    <strong className="pos-hm-amount">
                      Rp {Number(order.total_harga).toLocaleString("id-ID")}
                    </strong>
                    <span className="pos-hm-detail-link">
                      Detail <span>→</span>
                    </span>
                  </div>
                </footer>
              </article>
            );
          })
        )}
      </div>
    </main>{dateModalOpen && (
      <div className="ops-modal-backdrop" onClick={() => setDateModalOpen(false)}>
        <section className="pos-filter-modal" onClick={(e) => e.stopPropagation()}>
          <button className="ops-modal-close" onClick={() => setDateModalOpen(false)} aria-label="Tutup">
            ×
          </button>
          <div className="pos-filter-modal-header">
            <small>FILTER AUDIT OMZET</small>
            <h2>Pilih Periode Waktu</h2>
            <p>Filter ringkasan omzet dan daftar transaksi berdasarkan kurun waktu tertentu.</p>
          </div>

          <div className="pos-filter-preset-grid">
            <button
              type="button"
              className={`pos-preset-option ${historyDateFilter.mode === "today" ? "active" : ""}`}
              onClick={() => {
                setHistoryPage(1); setHistoryDateFilter({ mode: "today" });
                setDateModalOpen(false);
              }}
            >
              <b>Hari Ini</b>
              <span>Transaksi hari ini</span>
            </button>

            <button
              type="button"
              className={`pos-preset-option ${historyDateFilter.mode === "this_week" ? "active" : ""}`}
              onClick={() => {
                setHistoryPage(1); setHistoryDateFilter({ mode: "this_week" });
                setDateModalOpen(false);
              }}
            >
              <b>Minggu Ini</b>
              <span>Senin s/d Minggu ini</span>
            </button>

            <button
              type="button"
              className={`pos-preset-option ${historyDateFilter.mode === "this_month" ? "active" : ""}`}
              onClick={() => {
                setHistoryPage(1); setHistoryDateFilter({ mode: "this_month" });
                setDateModalOpen(false);
              }}
            >
              <b>Bulan Ini</b>
              <span>Bulan berjalan saat ini</span>
            </button>

            <button
              type="button"
              className={`pos-preset-option ${historyDateFilter.mode === "this_year" ? "active" : ""}`}
              onClick={() => {
                setHistoryPage(1); setHistoryDateFilter({ mode: "this_year" });
                setDateModalOpen(false);
              }}
            >
              <b>Tahun Ini</b>
              <span>Tahun {new Date().getFullYear()}</span>
            </button>
          </div>

          <div className={`pos-custom-range-card ${historyDateFilter.mode === "custom" ? "active" : ""}`}>
            <h3>
              <span>📅</span>
              <span>Filter Custom Berdasarkan Tanggal</span>
            </h3>
            <div className="pos-custom-date-grid">
              <div className="pos-date-field">
                <label>Dari Tanggal</label>
                <input
                  type="date"
                  value={tempCustomStart}
                  onChange={(e) => setTempCustomStart(e.target.value)}
                />
              </div>
              <div className="pos-date-field">
                <label>Sampai Tanggal</label>
                <input
                  type="date"
                  value={tempCustomEnd}
                  onChange={(e) => setTempCustomEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="pos-filter-modal-actions">
            <button
              type="button"
              className="pos-filter-btn-cancel"
              onClick={() => {
                setHistoryPage(1); setHistoryDateFilter({ mode: "all" });
                setDateModalOpen(false);
              }}
            >
              Reset (Semua Waktu)
            </button>
            <button
              type="button"
              className="pos-filter-btn-apply"
              onClick={applyCustomDateRange}
            >
              Terapkan Tanggal
            </button>
          </div>
        </section>
      </div>
    )}</>);
}

export default memo(History);
