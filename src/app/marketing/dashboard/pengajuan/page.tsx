"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuthGuard } from "@/lib/auth-helpers";
import "../marketing-dashboard.css";

type Application = {
  id: string;
  business_name: string;
  owner_name: string;
  owner_phone?: string;
  province: string;
  city_regency: string;
  status: "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED";
  review_notes?: string;
  created_at: string;
};

type Dashboard = {
  profile: {
    name: string;
    area: string;
  };
  applications: Application[];
  totals: {
    pending: number;
  };
};

const labels = {
  PENDING: "Menunggu review",
  PROCESSING: "Sedang diproses",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export default function MarketingPengajuanPage() {
  const { isAuthorized, loading } = useAuthGuard(["MARKETING"]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  const load = useCallback(async () => {
    const res = await fetch("/api/marketing/dashboard", { cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Gagal memuat status pengajuan.");
    setData(payload.data);
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    load().catch((err) => setError(err.message));
  }, [isAuthorized, load]);

  if (loading || !isAuthorized || !data) {
    return (
      <main className="mkt-loading">
        <span className="mkt-splash-text">{error || "Dashboard Marketing"}</span>
      </main>
    );
  }

  const applications = data.applications || [];
  const pendingCount = applications.filter((a) => a.status === "PENDING" || a.status === "PROCESSING").length;
  const approvedCount = applications.filter((a) => a.status === "APPROVED").length;
  const rejectedCount = applications.filter((a) => a.status === "REJECTED").length;

  const filtered = applications.filter((item) => {
    if (filter === "PENDING") return item.status === "PENDING" || item.status === "PROCESSING";
    if (filter === "APPROVED") return item.status === "APPROVED";
    if (filter === "REJECTED") return item.status === "REJECTED";
    return true;
  });

  return (
    <main className="mkt-shell">
      <div className="mkt-container">
        {/* Top Header */}
        <div className="mkt-subpage-header">
          <Link href="/marketing/dashboard" className="mkt-back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Kembali ke Dashboard</span>
          </Link>
          <div className="mkt-subpage-title-box">
            <h1>Status Pengajuan Tenant Baru</h1>
            <p>Pantau proses verifikasi dan riwayat persetujuan akun tenant baru yang Anda ajukan ke Super Admin.</p>
          </div>
        </div>

        {error && <div className="mkt-alert error">{error}</div>}

        {/* Ringkasan Metric */}
        <section className="mkt-tenant-summary-grid">
          <div className="mkt-tenant-metric-card total">
            <small>Total Pengajuan</small>
            <strong>{applications.length}</strong>
            <span>Diajukan ke Super Admin</span>
          </div>
          <div className="mkt-tenant-metric-card unpaid warning">
            <small>Menunggu Review</small>
            <strong>{pendingCount}</strong>
            <span>Sedang diverifikasi pusat</span>
          </div>
          <div className="mkt-tenant-metric-card paid">
            <small>Telah Disetujui</small>
            <strong>{approvedCount}</strong>
            <span>Akun owner telah diterbitkan</span>
          </div>
        </section>

        {/* Filter Tabs & Tombol Daftarkan Baru */}
        <div className="mkt-filter-bar">
          <div className="mkt-filter-tabs">
            <button
              type="button"
              className={filter === "ALL" ? "active" : ""}
              onClick={() => setFilter("ALL")}
            >
              Semua ({applications.length})
            </button>
            <button
              type="button"
              className={filter === "PENDING" ? "active" : ""}
              onClick={() => setFilter("PENDING")}
            >
              Diproses ({pendingCount})
            </button>
            <button
              type="button"
              className={filter === "APPROVED" ? "active" : ""}
              onClick={() => setFilter("APPROVED")}
            >
              Disetujui ({approvedCount})
            </button>
            <button
              type="button"
              className={filter === "REJECTED" ? "active" : ""}
              onClick={() => setFilter("REJECTED")}
            >
              Ditolak ({rejectedCount})
            </button>
          </div>

          <Link href="/marketing/dashboard#form-tenant" className="mkt-btn-add-tenant">
            ＋ Daftarkan Tenant Baru
          </Link>
        </div>

        {/* Daftar Status Pengajuan */}
        <section className="mkt-panel">
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon">📋</div>
            <div>
              <h2>Riwayat Pengajuan Tenant</h2>
              <p>Status diperbarui otomatis setelah Super Admin memeriksa kredensial dan menerbitkan akun.</p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="mkt-empty">Belum ada pengajuan pada kategori ini.</div>
          ) : (
            <div className="mkt-list">
              {filtered.map((item) => (
                <article key={item.id} className="mkt-list-item-detailed">
                  <div className="mkt-list-main">
                    <div className="mkt-list-header-row">
                      <h3>{item.business_name}</h3>
                      <span className={`mkt-status ${item.status.toLowerCase()}`}>
                        {labels[item.status]}
                      </span>
                    </div>

                    <div className="mkt-list-meta-grid">
                      <div>
                        <small>Nama Owner:</small>
                        <span>{item.owner_name}</span>
                      </div>
                      <div>
                        <small>WhatsApp:</small>
                        <span>{item.owner_phone ? `+${item.owner_phone}` : "-"}</span>
                      </div>
                      <div>
                        <small>Wilayah Usaha:</small>
                        <span>{item.city_regency}, {item.province}</span>
                      </div>
                      <div>
                        <small>Tanggal Diajukan:</small>
                        <span>
                          {new Date(item.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    {item.review_notes && (
                      <div className="mkt-review-notes">
                        <b>Catatan Super Admin:</b> {item.review_notes}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer>© {new Date().getFullYear()} OKESIH.COM · Portal Mitra Marketing</footer>
      </div>
    </main>
  );
}
