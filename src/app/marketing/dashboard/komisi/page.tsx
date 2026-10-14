"use client";

import Link from "next/link";
import { useMarketingData } from "../MarketingContext";
import "../marketing-dashboard.css";

const money = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function MarketingKomisiPage() {
  const { data, loading, error, isAuthorized } = useMarketingData();

  if (loading || !isAuthorized || !data) {
    return (
      <main className="mkt-loading">
        <span className="mkt-splash-text">{error || "Dashboard marketing"}</span>
      </main>
    );
  }

  const sisaKomisi = Math.max(0, data.totals.commission - data.profile.commissionPaid);

  return (
    <main className="mkt-shell">
      <div className="mkt-container">
        {/* Top Navigation */}
        <div className="mkt-subpage-header">
          <Link href="/marketing/dashboard" className="mkt-back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Kembali ke Dashboard</span>
          </Link>
          <div className="mkt-subpage-title-box">
            <h1>Rincian Komisi Marketing</h1>
            <p>Perhitungan komisi transparan berdasarkan transaksi struk dari seluruh tenant binaan Anda.</p>
          </div>
        </div>

        {error && <div className="mkt-alert error">{error}</div>}

        {/* Ringkasan Saldo Komisi */}
        <section className="mkt-komisi-summary-grid">
          <div className="mkt-komisi-card highlight">
            <small>Sisa Saldo Komisi</small>
            <strong>{money(sisaKomisi)}</strong>
            <span>Siap ditransfer Super Admin</span>
          </div>
          <div className="mkt-komisi-card">
            <small>Total Komisi Berjalan</small>
            <strong>{money(data.totals.commission)}</strong>
            <span>Akumulasi dari {data.totals.receipts.toLocaleString("id-ID")} struk</span>
          </div>
          <div className="mkt-komisi-card">
            <small>Komisi Telah Dicairkan</small>
            <strong>{money(data.profile.commissionPaid)}</strong>
            <span>Sudah ditransfer ke rekening Anda</span>
          </div>
        </section>

        {/* Rincian Komisi per Tenant */}
        <section className="mkt-panel" style={{ marginTop: "20px" }}>
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon">Rp</div>
            <div>
              <h2>Komisi per Tenant Binaan</h2>
              <p>Perolehan komisi berdasarkan jumlah struk transaksi yang berhasil tercatat di setiap tenant.</p>
            </div>
          </div>

          {data.tenants.length === 0 ? (
            <div className="mkt-empty">Belum ada komisi. Daftarkan tenant baru untuk mulai menghasilkan komisi transaksi.</div>
          ) : (
            <div className="mkt-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tenant Binaan</th>
                    <th>Wilayah</th>
                    <th>Total Struk</th>
                    <th>Tarif / Struk</th>
                    <th>Total Komisi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>
                        <strong>{tenant.name}</strong>
                        <span>Owner: {tenant.ownerName}</span>
                      </td>
                      <td>
                        {tenant.cityRegency}, {tenant.province}
                      </td>
                      <td>
                        <b>{tenant.receipts.toLocaleString("id-ID")}</b> struk
                      </td>
                      <td>
                        {tenant.commissionPerReceipt ? money(tenant.commissionPerReceipt) : "Rp 15"} / struk
                      </td>
                      <td>
                        <strong style={{ color: "#047857", fontSize: "14px" }}>
                          {money(tenant.commission)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Info Pencairan Komisi */}
        <section className="mkt-payout-info">
          <div className="mkt-payout-icon">ℹ</div>
          <div>
            <strong>Mekanisme Pencairan Komisi Mitra Marketing:</strong>
            <p>
              Komisi berjalan dihitung secara otomatis dari setiap struk transaksi tenant yang sah. Pencairan dana komisi ditransfer secara berkala oleh Super Admin ke rekening terdaftar Anda setelah verifikasi bulanan atau saat mencapai batas minimum penarikan.
            </p>
          </div>
        </section>

        <footer>© {new Date().getFullYear()} OKESIH.COM · Portal Mitra Marketing</footer>
      </div>
    </main>
  );
}
