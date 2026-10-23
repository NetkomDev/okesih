"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { INDONESIA_PROVINCES } from "@/lib/indonesia-regions";
import { logoutUser } from "@/lib/auth-helpers";
import { useMarketingData } from "./MarketingContext";
import MarketingLoading from "./MarketingLoading";
import "./marketing-dashboard.css";

const money = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function MarketingDashboardPage() {
  const { data, loading, error: contextError, isAuthorized } = useMarketingData();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    phone: "",
    address: "",
    province: "",
    cityRegency: "",
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    setWhatsappUrl("");
    try {
      const response = await fetch("/api/marketing/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pengajuan tenant gagal dikirim.");
      if (!payload.data?.whatsappUrl) throw new Error("Tautan WhatsApp Admin gagal disiapkan.");
      setForm({ name: "", ownerName: "", phone: "", address: "", province: "", cityRegency: "" });
      setWhatsappUrl(payload.data.whatsappUrl);
      setNotice(
        "Pengajuan tersimpan. Kirim pesan yang sudah disiapkan melalui WhatsApp Anda."
      );
      window.location.assign(payload.data.whatsappUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthorized || (!data && loading)) {
    return <MarketingLoading />;
  }
  if (!data) return null;

  const isSuspended = Boolean(data.profile.isSuspended || data.totals.saldoDisembunyikan);
  const unpaidCount = data.totals.unpaidTenants ?? data.tenants.filter((t) => t.paymentStatus === "UNPAID").length;

  return (
    <main className="mkt-shell mkt-home-shell">
      <div className="mkt-container">
        {/* Latar Header Orange Full Bleed Melengkung di Belakang Card Header */}
        <div className="mkt-home-header-bg" aria-hidden="true" />

        {/* Header Dashboard Marketing bertema Hijau Tosca & Orange Elegan */}
        <header className="mkt-header">
          <div className="mkt-brand">
            <Image
              className="mkt-logo"
              src="/logo.svg"
              alt="Logo OKESIH"
              width={54}
              height={54}
              priority
            />
            <div>
              <div className="mkt-eyebrow">OKESIH.COM</div>
              <div className="mkt-title">
                {data.profile.membershipLevel === "COORDINATOR" ? "Koordinator Mitra" : "Marketing Partner"}
              </div>
            </div>
          </div>

          <div className="mkt-welcome">
            <div>
              <span>Dashboard kemitraan</span>
              <h1>Selamat datang, {data.profile.name}</h1>
              <p>Pantau pengajuan tenant, status tagihan binaan, dan perkembangan komisi secara transparan.</p>
            </div>
          </div>
        </header>

        {isSuspended && (
          <div
            role="alert"
            className="mkt-alert error"
            style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid #EF4444",
              color: "#DC2626",
              fontWeight: 700,
              padding: "0.85rem 1rem",
              borderRadius: "8px",
              marginBottom: "1rem",
            }}
          >
            ⚠️ <strong>Akun Kemitraan Dinonaktifkan:</strong> Status kemitraan Anda saat ini dinonaktifkan/ditangguhkan.
            Saldo komisi disembunyikan dan pencairan dibekukan. Silakan hubungi Super Admin untuk aktivasi kembali.
          </div>
        )}

        {(error || contextError) && <div className="mkt-alert error">{error || contextError}</div>}
        {notice && (
          <div className="mkt-alert success">
            ✓ {notice}
            {whatsappUrl && <a href={whatsappUrl}>Buka WhatsApp</a>}
          </div>
        )}

        {/* 4 Cards Statistik Interaktif: Klik untuk menuju halaman detail tanpa reload */}
        <section className="mkt-stats">
          {/* Card 1: Tenant Aktif -> Menuju Halaman Tenant Binaan */}
          <Link href="/marketing/dashboard/tenant-binaan" className="mkt-stat-card-link" title="Buka Daftar Tenant Binaan & Status Pembayaran">
            <article className="mkt-clickable-card">
              <i className="green" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </i>
              <div>
                <small>Tenant aktif</small>
                <strong>{data.totals.tenants}</strong>
                <p>
                  {unpaidCount > 0 ? (
                    <span style={{ color: "#dc2626", fontWeight: 700 }}>{unpaidCount} belum bayar ↗</span>
                  ) : (
                    "Usaha binaan ↗"
                  )}
                </p>
              </div>
            </article>
          </Link>

          {/* Card 2: Menunggu Review -> Menuju Halaman Status Pengajuan */}
          <Link href="/marketing/dashboard/pengajuan" className="mkt-stat-card-link" title="Buka Halaman Status Pengajuan Tenant">
            <article className="mkt-clickable-card">
              <i className="amber" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </i>
              <div>
                <small>Menunggu review</small>
                <strong>{data.totals.pending}</strong>
                <p>Lihat pengajuan ↗</p>
              </div>
            </article>
          </Link>

          {/* Card 3: Total Struk */}
          <article>
            <i className="orange" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </i>
            <div>
              <small>Total struk</small>
              <strong>{data.totals.receipts.toLocaleString("id-ID")}</strong>
              <p>Dari seluruh tenant</p>
            </div>
          </article>

          {/* Card 4: Komisi Berjalan -> Menuju Halaman Komisi */}
          <Link href="/marketing/dashboard/komisi" className="mkt-stat-card-link" title="Buka Rincian & Pencairan Komisi">
            <article className="mkt-clickable-card">
              <i className="blue" aria-hidden="true">
                <span className="mkt-rp-icon">Rp</span>
              </i>
              <div>
                <small>Komisi berjalan</small>
                <strong>{isSuspended ? "Akun Dinonaktifkan" : money(data.totals.commission)}</strong>
                <p>{isSuspended ? "Pencairan dibekukan" : "Rincian komisi ↗"}</p>
              </div>
            </article>
          </Link>
        </section>

        {/* Content Layout Responsif: Di mobile 1 kolom penuh tanpa overflow */}
        <section className="mkt-content-grid">
          {/* Form Daftarkan Tenant Baru */}
          <form id="form-tenant" onSubmit={submit} className="mkt-panel mkt-form">
            <PanelHead
              icon="＋"
              title="Daftarkan Tenant Baru"
              text="Akun owner segera diterbitkan setelah diverifikasi oleh Admin"
            />
            <label>
              Nama usaha
              <input
                required
                placeholder="Contoh: Warkop Nusantara"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Nama pemilik / owner
              <input
                required
                placeholder="Nama lengkap owner"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              />
            </label>
            <label>
              WhatsApp owner
              <input
                required
                inputMode="tel"
                placeholder="08xxxxxxxxxx"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Alamat lengkap usaha
              <textarea
                required
                rows={3}
                placeholder="Nama jalan, nomor, kelurahan/kecamatan"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <div className="mkt-form-row">
              <label>
                Provinsi
                <select
                  required
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                >
                  <option value="">Pilih provinsi</option>
                  {INDONESIA_PROVINCES.map((province) => (
                    <option key={province}>{province}</option>
                  ))}
                </select>
              </label>
              <label>
                Kota / Kabupaten
                <input
                  required
                  placeholder="Nama kota/kabupaten"
                  value={form.cityRegency}
                  onChange={(e) => setForm({ ...form, cityRegency: e.target.value })}
                />
              </label>
            </div>
            <div className="mkt-flow-note">
              <b>WhatsApp marketing: {data.profile.phone}</b>
              <span>Pastikan akun WhatsApp aktif di HP ini adalah nomor tersebut. Setelah data tersimpan, WhatsApp dibuka untuk mengirim pengajuan ke Admin.</span>
            </div>
            <button className="mkt-primary" disabled={saving}>
              {saving ? "Mengirim pengajuan..." : "Daftarkan & Kirim WhatsApp"}
            </button>
          </form>

          {/* Kolom Tips Lapangan */}
          <aside className="mkt-side-nav-column">
            <div className="mkt-tips-card">
              <span className="mkt-tips-badge">Tips Lapangan</span>
              <h4 className="mkt-tips-title" style={{ color: "#ffffff" }}>Tindak Lanjut Tenant Menunggak</h4>
              <p>
                Buka menu <b className="mkt-highlight-text">Tenant Binaan</b> untuk melihat tenant yang berstatus belum bayar. Anda dapat langsung menekan tombol WhatsApp atau mendatangi outlet mereka untuk memastikan sistem kasir tetap berjalan lancar.
              </p>
            </div>
          </aside>
        </section>

        {/* Profil Akun Mitra & Tombol Keluar yang Elegan di Bagian Bawah */}
        <section className="mkt-account-bar">
          <div className="mkt-account-info">
            <span className="mkt-account-avatar">
              {data.profile.name.trim().charAt(0).toUpperCase()}
            </span>
            <div>
              <strong>{data.profile.name}</strong>
              <p>Mitra Pemasaran {data.profile.area ? `· Wilayah ${data.profile.area}` : ""}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <Link
              href="/marketing/dashboard/profil"
              title="Ubah Profil, Username & Password"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "10px",
                background: "rgba(13, 148, 136, 0.12)",
                color: "#0f766e",
                border: "1px solid rgba(13, 148, 136, 0.25)",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
                transition: "all 0.2s ease",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Ubah Profil &amp; Akun</span>
            </Link>
            <button
              type="button"
              className="mkt-logout-btn"
              onClick={() => void logoutUser()}
              title="Keluar dari akun marketing"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Keluar Akun</span>
            </button>
          </div>
        </section>

        <footer>© {new Date().getFullYear()} OKESIH.COM · Portal Mitra Marketing</footer>
      </div>

      <a
        className="mkt-whatsapp-group-fab"
        href="https://chat.whatsapp.com/BVU0la0yq284Ux3YeQQV4a?s=cl&p=a&mlu=4&ilr=4"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Gabung grup WhatsApp Mitra OKESIH"
        title="Gabung grup WhatsApp Mitra OKESIH"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.88 11.88 0 0 0 12.05 0C5.46 0 .1 5.36.1 11.95c0 2.1.55 4.15 1.59 5.96L0 24l6.25-1.64a11.94 11.94 0 0 0 5.8 1.48h.01c6.58 0 11.94-5.36 11.94-11.95a11.87 11.87 0 0 0-3.48-8.41ZM12.05 21.82a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.71.97.99-3.62-.24-.37a9.89 9.89 0 0 1-1.52-5.26c0-5.49 4.46-9.95 9.95-9.95a9.87 9.87 0 0 1 7.04 2.92 9.88 9.88 0 0 1 2.91 7.04c0 5.48-4.47 9.86-10.01 9.86Zm5.46-7.42c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.77-1.65-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
        </svg>
        <span className="mkt-whatsapp-group-badge" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2" />
          </svg>
        </span>
      </a>
    </main>
  );
}

function PanelHead({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="mkt-panel-head">
      <div className="mkt-panel-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}
