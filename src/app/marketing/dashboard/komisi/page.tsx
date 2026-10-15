"use client";

import { useState } from "react";
import { useMarketingData } from "../MarketingContext";
import MarketingLoading from "../MarketingLoading";
import "../marketing-dashboard.css";

const money = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function MarketingKomisiPage() {
  const { data, loading, error, refresh, isAuthorized } = useMarketingData();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");

  if (!isAuthorized || (!data && loading)) {
    return <MarketingLoading />;
  }
  if (!data) return null;

  const sisaKomisi = data.totals.availableCommission;

  const requestWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    setNotice("");
    try {
      const nominal = Number(amount);
      const response = await fetch("/api/marketing/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: nominal }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pengajuan pencairan gagal disimpan.");
      setAmount("");
      setNotice("Pengajuan tersimpan. Menghubungkan ke WhatsApp Super Admin...");
      await refresh();
      if (payload.data?.whatsappUrl) {
        window.location.assign(payload.data.whatsappUrl);
      }
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Pengajuan pencairan gagal diproses.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mkt-shell">
      <div className="mkt-container">
        {/* Top Navigation */}
        <div className="mkt-subpage-header">
          <div className="mkt-subpage-title-box">
            <h1>Rincian Komisi Marketing</h1>
            <p>Perhitungan komisi transparan berdasarkan transaksi struk dari seluruh tenant binaan Anda.</p>
          </div>
        </div>

        {(error || submitError) && <div className="mkt-alert error">{submitError || error}</div>}
        {notice && <div className="mkt-alert success">✓ {notice}</div>}

        {/* Ringkasan Saldo Komisi */}
        <section className="mkt-komisi-summary-grid">
          <div className="mkt-komisi-card highlight">
            <small>Sisa Saldo Komisi</small>
            <strong>{money(sisaKomisi)}</strong>
            <span>Siap ditransfer Admin</span>
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

        <section className="mkt-panel mkt-withdrawal-panel">
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon">⇩</div>
            <div>
              <h2>Cairkan Komisi</h2>
              <p>Pengajuan akan dikirim ke Super Admin dan ditransfer ke rekening terdaftar.</p>
            </div>
          </div>
          <form onSubmit={requestWithdrawal} className="mkt-withdrawal-form">
            <label>
              Nominal pencairan
              <div className="mkt-money-input"><span>Rp</span><input required type="number" inputMode="numeric" min="1" step="1" max={sisaKomisi} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Masukkan nominal" /></div>
            </label>
            <div className="mkt-withdrawal-account"><small>Rekening tujuan</small><strong>{data.profile.bankName} · {data.profile.bankAccountNumber}</strong><span>{data.profile.bankAccountName}</span></div>
            <button className="mkt-primary" disabled={submitting || sisaKomisi <= 0 || !amount || Number(amount) > sisaKomisi}>{submitting ? "Menyimpan..." : "Cairkan & Kirim WhatsApp"}</button>
          </form>
          {data.totals.pendingWithdrawal > 0 && <div className="mkt-withdrawal-pending">Sedang diproses Admin: <strong>{money(data.totals.pendingWithdrawal)}</strong></div>}
          <p className="mkt-withdrawal-note">WhatsApp aktif di HP ini akan dibuka dengan pesan untuk Admin. Saldo yang diajukan langsung masuk dalam antrian pencairan paling lama 1 x 24 jam.</p>
        </section>

        {data.withdrawals.length > 0 && <section className="mkt-panel mkt-withdrawal-history">
          <div className="mkt-panel-head"><div className="mkt-panel-icon">≡</div><div><h2>Riwayat Pencairan</h2><p>Status pengajuan pencairan komisi Anda.</p></div></div>
          <div className="mkt-withdrawal-list">{data.withdrawals.map((item) => <div key={item.id}><div><strong>{money(Number(item.amount))}</strong><span>{new Date(item.created_at).toLocaleString("id-ID")}</span></div><b className={`status-${item.status.toLowerCase()}`}>{item.status === "PENDING" ? "Menunggu Admin" : item.status === "PAID" ? "Sudah Ditransfer" : "Ditolak"}</b></div>)}</div>
        </section>}

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
              Komisi dihitung otomatis dari setiap struk transaksi yang sah. Nominal yang diajukan ditahan dari saldo tersedia, lalu dicatat sebagai komisi dicairkan setelah Super Admin mengonfirmasi transfer.
            </p>
          </div>
        </section>

        <footer>© {new Date().getFullYear()} OKESIH.COM · Portal Mitra Marketing</footer>
      </div>
    </main>
  );
}
