"use client";

import Link from "next/link";
import { useState } from "react";
import { useMarketingData } from "../MarketingContext";
import "../marketing-dashboard.css";

const money = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function MarketingTenantBinaanPage() {
  const { data, loading, error, isAuthorized } = useMarketingData();
  const [filter, setFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [search, setSearch] = useState("");

  if (loading || !isAuthorized || !data) {
    return (
      <main className="mkt-loading">
        <span className="mkt-splash-text">{error || "Dashboard marketing"}</span>
      </main>
    );
  }

  const filteredTenants = data.tenants.filter((tenant) => {
    if (filter === "UNPAID" && tenant.paymentStatus !== "UNPAID") return false;
    if (filter === "PAID" && tenant.paymentStatus !== "PAID") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        tenant.name.toLowerCase().includes(q) ||
        tenant.ownerName.toLowerCase().includes(q) ||
        tenant.cityRegency.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unpaidCount = data.totals.unpaidTenants ?? data.tenants.filter((t) => t.paymentStatus === "UNPAID").length;
  const paidCount = data.totals.paidTenants ?? data.tenants.filter((t) => t.paymentStatus === "PAID").length;

  return (
    <main className="mkt-shell">
      <div className="mkt-container">
        {/* Top Header */}
        <div className="mkt-subpage-header">
          <Link href="/marketing/dashboard" className="mkt-back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Kembali ke Dashboard</span>
          </Link>
          <div className="mkt-subpage-title-box">
            <h1>Tenant Binaan Aktif</h1>
            <p>Pantau performa operasional dan status pembayaran tagihan harian tenant binaan Anda untuk tindak lanjut cepat.</p>
          </div>
        </div>

        {error && <div className="mkt-alert error">{error}</div>}

        {/* Highlight Tagihan & Statistik */}
        <section className="mkt-tenant-summary-grid">
          <div className="mkt-tenant-metric-card total">
            <small>Total Tenant Binaan</small>
            <strong>{data.tenants.length}</strong>
            <span>Usaha aktif di wilayah binaan</span>
          </div>
          <div className={`mkt-tenant-metric-card unpaid ${unpaidCount > 0 ? "warning" : ""}`}>
            <small>Belum Bayar Tagihan</small>
            <strong>{unpaidCount}</strong>
            <span>{unpaidCount > 0 ? "Perlu ditindaklanjuti / dikunjungi" : "Semua tagihan tertib"}</span>
          </div>
          <div className="mkt-tenant-metric-card paid">
            <small>Sudah Bayar / Tertib</small>
            <strong>{paidCount}</strong>
            <span>Tagihan sistem lunas</span>
          </div>
        </section>

        {/* Filter Bar */}
        <div className="mkt-filter-bar">
          <div className="mkt-filter-tabs">
            <button
              type="button"
              className={filter === "ALL" ? "active" : ""}
              onClick={() => setFilter("ALL")}
            >
              Semua ({data.tenants.length})
            </button>
            <button
              type="button"
              className={filter === "UNPAID" ? "active unpaid" : "unpaid"}
              onClick={() => setFilter("UNPAID")}
            >
              Belum Bayar ({unpaidCount})
            </button>
            <button
              type="button"
              className={filter === "PAID" ? "active" : ""}
              onClick={() => setFilter("PAID")}
            >
              Sudah Bayar ({paidCount})
            </button>
          </div>
          <div className="mkt-search-box">
            <input
              type="text"
              placeholder="Cari tenant / owner / kota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tabel / Card Daftar Tenant Binaan */}
        <section className="mkt-panel">
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon">🏪</div>
            <div>
              <h2>Daftar Tenant &amp; Status Pembayaran</h2>
              <p>Gunakan tombol WhatsApp atau kunjungi tenant yang berstatus belum bayar untuk koordinasi.</p>
            </div>
          </div>

          {filteredTenants.length === 0 ? (
            <div className="mkt-empty">
              {search ? "Tidak ada tenant yang cocok dengan kata kunci pencarian." : "Belum ada data tenant pada kategori ini."}
            </div>
          ) : (
            <div className="mkt-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usaha &amp; Owner</th>
                    <th>Wilayah</th>
                    <th>Status Pembayaran</th>
                    <th>Total Struk</th>
                    <th>Tindakan / Kontak</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((tenant) => {
                    const isUnpaid = tenant.paymentStatus === "UNPAID";
                    const cleanPhone = (tenant.phone || "").replace(/\D/g, "");
                    const waText = encodeURIComponent(
                      `Halo Kak ${tenant.ownerName} dari ${tenant.name}, saya ${data.profile.name} mitra marketing OKESIH. Saya ingin menanyakan perihal operasional kasir dan konfirmasi tagihan sistem OKESIH Anda. Apakah ada kendala yang bisa saya bantu?`
                    );
                    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waText}` : null;

                    return (
                      <tr key={tenant.id} className={isUnpaid ? "mkt-row-unpaid" : ""}>
                        <td>
                          <strong>{tenant.name}</strong>
                          <span style={{ color: "#475569" }}>Owner: {tenant.ownerName}</span>
                          <small style={{ color: "#94a3b8" }}>Bergabung: {new Date(tenant.joinedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</small>
                        </td>
                        <td>
                          <strong>{tenant.cityRegency}</strong>
                          <span style={{ color: "#64748b" }}>{tenant.province}</span>
                        </td>
                        <td>
                          {isUnpaid ? (
                            <div className="mkt-badge-unpaid-box">
                              <span className="mkt-badge-unpaid">
                                ● Belum Bayar
                              </span>
                              {tenant.unpaidAmount > 0 && (
                                <small className="mkt-unpaid-amount">
                                  {money(tenant.unpaidAmount)}
                                </small>
                              )}
                            </div>
                          ) : (
                            <span className="mkt-badge-paid">
                              ✓ Sudah Bayar
                            </span>
                          )}
                        </td>
                        <td>
                          <b>{tenant.receipts.toLocaleString("id-ID")}</b> struk
                        </td>
                        <td>
                          <div className="mkt-tenant-actions">
                            {waUrl ? (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`mkt-wa-btn ${isUnpaid ? "urgent" : ""}`}
                                title="Kirim pesan WhatsApp untuk follow up"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                                </svg>
                                <span>{isUnpaid ? "Tindak Lanjuti WA" : "Chat Owner"}</span>
                              </a>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: "11px" }}>No WA tidak ada</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer>© {new Date().getFullYear()} OKESIH.COM · Portal Mitra Marketing</footer>
      </div>
    </main>
  );
}
