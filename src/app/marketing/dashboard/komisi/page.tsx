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

  const isSuspended = Boolean(data.profile.isSuspended || data.totals.saldoDisembunyikan);
  const sisaKomisi = isSuspended ? 0 : data.totals.availableCommission;

  const requestWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSuspended) {
      setSubmitError("Akun kemitraan Anda dinonaktifkan. Pencairan tidak dapat dilakukan.");
      return;
    }
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

        {/* Peringatan Akun Nonaktif / Ditangguhkan */}
        {isSuspended && (
          <div
            role="alert"
            className="mkt-alert error"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid #EF4444",
              color: "#DC2626",
              fontWeight: 700,
              padding: "1rem",
              borderRadius: "8px",
              marginBottom: "1.2rem",
            }}
          >
            ⚠️ <strong>Akun Kemitraan Dinonaktifkan:</strong> Status kemitraan Anda saat ini sedang dinonaktifkan atau ditangguhkan.
            Sesuai kebijakan sistem, Anda tidak dapat melihat nominal saldo/pendapatan dan tidak dapat melakukan pencairan komisi.
            Silakan hubungi Super Admin untuk aktivasi kembali.
          </div>
        )}

        {(error || submitError) && <div className="mkt-alert error">{submitError || error}</div>}
        {notice && <div className="mkt-alert success">✓ {notice}</div>}

        {/* Ringkasan Saldo Komisi */}
        <section className="mkt-komisi-summary-grid">
          <div className="mkt-komisi-card highlight">
            <small>Sisa Saldo Komisi</small>
            <strong>{isSuspended ? "Akun Dinonaktifkan" : money(sisaKomisi)}</strong>
            <span>{isSuspended ? "Pencairan dibekukan" : "Siap ditransfer Admin"}</span>
          </div>
          <div className="mkt-komisi-card">
            <small>Total Komisi Berjalan</small>
            <strong>{isSuspended ? "••••••••" : money(data.totals.commission)}</strong>
            <span>
              {isSuspended
                ? "Saldo disembunyikan"
                : `Akumulasi dari ${data.totals.receipts.toLocaleString("id-ID")} struk`}
            </span>
          </div>
          <div className="mkt-komisi-card">
            <small>Komisi Telah Dicairkan</small>
            <strong>{isSuspended ? "••••••••" : money(data.profile.commissionPaid)}</strong>
            <span>{isSuspended ? "Riwayat dibekukan" : "Sudah ditransfer ke rekening Anda"}</span>
          </div>
        </section>

        {/* Panel Form Pencairan Komisi */}
        <section className="mkt-panel mkt-withdrawal-panel">
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon">⇩</div>
            <div>
              <h2>Cairkan Komisi</h2>
              <p>Pengajuan akan dikirim ke Super Admin dan ditransfer ke rekening terdaftar.</p>
            </div>
          </div>
          {isSuspended ? (
            <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.08)", borderRadius: "8px", color: "#DC2626", fontWeight: 700, fontSize: "0.85rem" }}>
              ✕ Formulir pencairan dinonaktifkan karena akun kemitraan Anda sedang tidak aktif.
            </div>
          ) : (
            <form onSubmit={requestWithdrawal} className="mkt-withdrawal-form">
              <label>
                Nominal pencairan
                <div className="mkt-money-input">
                  <span>Rp</span>
                  <input
                    required
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    max={sisaKomisi}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Masukkan nominal"
                  />
                </div>
              </label>
              <div className="mkt-withdrawal-account">
                <small>Rekening tujuan</small>
                <strong>{data.profile.bankName} · {data.profile.bankAccountNumber}</strong>
                <span>{data.profile.bankAccountName}</span>
              </div>
              <button
                className="mkt-primary"
                disabled={submitting || sisaKomisi <= 0 || !amount || Number(amount) > sisaKomisi}
              >
                {submitting ? "Menyimpan..." : "Cairkan & Kirim WhatsApp"}
              </button>
            </form>
          )}
          {!isSuspended && data.totals.pendingWithdrawal > 0 && (
            <div className="mkt-withdrawal-pending">
              Sedang diproses Admin: <strong>{money(data.totals.pendingWithdrawal)}</strong>
            </div>
          )}
          <p className="mkt-withdrawal-note">
            WhatsApp aktif di HP ini akan dibuka dengan pesan untuk Admin. Saldo yang diajukan langsung masuk dalam antrian pencairan paling lama 1 x 24 jam.
          </p>
        </section>

        {/* Riwayat Pencairan */}
        {!isSuspended && data.withdrawals.length > 0 && (
          <section className="mkt-panel mkt-withdrawal-history">
            <div className="mkt-panel-head">
              <div className="mkt-panel-icon">≡</div>
              <div>
                <h2>Riwayat Pencairan</h2>
                <p>Status pengajuan pencairan komisi Anda.</p>
              </div>
            </div>
            <div className="mkt-withdrawal-list">
              {data.withdrawals.map((item) => (
                <div key={item.id}>
                  <div>
                    <strong>{money(Number(item.amount))}</strong>
                    <span>{new Date(item.created_at).toLocaleString("id-ID")}</span>
                  </div>
                  <b className={`status-${item.status.toLowerCase()}`}>
                    {item.status === "PENDING" ? "Menunggu Admin" : item.status === "PAID" ? "Sudah Ditransfer" : "Ditolak"}
                  </b>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mutasi Komisi Berjalan (Langsung & Bonus Jaringan) */}
        {!isSuspended && (
          <section className="mkt-panel" style={{ marginTop: "20px" }}>
            <div className="mkt-panel-head">
              <div className="mkt-panel-icon">📋</div>
              <div>
                <h2>Mutasi Komisi Berjalan</h2>
                <p>Catatan transparan pembagian komisi langsung (akuisisi) dan bonus jaringan koordinator.</p>
              </div>
            </div>

            {(!data.commissionEntries || data.commissionEntries.length === 0) ? (
              <div className="mkt-empty">
                Belum ada mutasi komisi berjalan dari pelunasan tagihan struk. Komisi tercatat otomatis saat tenant melunasi tagihan sewa.
              </div>
            ) : (
              <div className="mkt-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Jenis Komisi</th>
                      <th>Asal Tenant</th>
                      <th>Mitra Downline</th>
                      <th>Struk & Tarif</th>
                      <th>Nominal Komisi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.commissionEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <div style={{ fontSize: "12px", color: "#64748B" }}>
                            {new Date(entry.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94A3B8" }}>
                            {new Date(entry.createdAt).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td>
                          {entry.kind === "NETWORK" ? (
                            <span
                              style={{
                                background: "rgba(99, 102, 241, 0.15)",
                                border: "1px solid #6366F1",
                                color: "#6366F1",
                                padding: "3px 7px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 800,
                              }}
                            >
                              Bonus Jaringan
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "rgba(16, 185, 129, 0.15)",
                                border: "1px solid #10B981",
                                color: "#059669",
                                padding: "3px 7px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 800,
                              }}
                            >
                              Komisi Langsung
                            </span>
                          )}
                        </td>
                        <td>
                          <strong>{entry.tenantName || "Tenant OKESIH"}</strong>
                        </td>
                        <td>
                          {entry.sourcePartnerName ? (
                            <span style={{ color: "#0284C7", fontWeight: 600, fontSize: "13px" }}>
                              👤 {entry.sourcePartnerName}
                            </span>
                          ) : (
                            <span style={{ color: "#94A3B8", fontSize: "12px" }}>-</span>
                          )}
                        </td>
                        <td>
                          <b>{entry.receipts.toLocaleString("id-ID")}</b> struk @ Rp {entry.rate.toLocaleString("id-ID")}
                        </td>
                        <td>
                          <strong style={{ color: "#059669", fontSize: "14px" }}>
                            + {money(entry.amount)}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Rincian Komisi per Tenant Binaan */}
        <section className="mkt-panel" style={{ marginTop: "20px" }}>
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon">Rp</div>
            <div>
              <h2>Komisi per Tenant Binaan</h2>
              <p>Perolehan komisi berdasarkan jumlah struk transaksi yang berhasil tercatat di setiap tenant.</p>
            </div>
          </div>

          {data.tenants.length === 0 ? (
            <div className="mkt-empty">Belum ada tenant. Daftarkan tenant baru untuk mulai menghasilkan komisi transaksi.</div>
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
                        {isSuspended ? "••••" : `${money(tenant.commissionPerReceipt || data?.profile?.commissionRate || 0)} / struk`}
                      </td>
                      <td>
                        <strong style={{ color: "#047857", fontSize: "14px" }}>
                          {isSuspended ? "••••••••" : money(tenant.commission)}
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
            <strong>Mekanisme Komisi Multi-Tier OKESIH:</strong>
            <p>
              Besaran komisi dikendalikan terpusat melalui Parameter Master Global. Saat tenant melunasi tagihan sewa struk, komisi langsung diteruskan ke saldo Mitra Marketing dan bonus jaringan diberikan kepada Koordinator Mitra pembina.
            </p>
          </div>
        </section>

        <footer>© {new Date().getFullYear()} OKESIH.COM · Portal Mitra Marketing</footer>
      </div>
    </main>
  );
}
