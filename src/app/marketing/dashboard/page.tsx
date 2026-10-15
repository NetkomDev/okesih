"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { INDONESIA_PROVINCES } from "@/lib/indonesia-regions";
import { logoutUser } from "@/lib/auth-helpers";
import PwaRoleInstallModal from "@/components/PwaRoleInstallModal";
import { useMarketingData } from "./MarketingContext";
import MarketingLoading from "./MarketingLoading";
import "./marketing-dashboard.css";

const money = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function MarketingDashboardPage() {
  const { data, loading, error: contextError, isAuthorized } = useMarketingData();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    phone: "",
    province: "",
    cityRegency: "",
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/marketing/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pengajuan tenant gagal dikirim.");
      setForm({ name: "", ownerName: "", phone: "", province: "", cityRegency: "" });
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

  const unpaidCount = data.totals.unpaidTenants ?? data.tenants.filter((t) => t.paymentStatus === "UNPAID").length;

  return (
    <main className="mkt-shell">
      <PwaRoleInstallModal pwaKind="marketing" />
      <div className="mkt-container">
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
              <div className="mkt-title">Marketing Partner</div>
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

        {(error || contextError) && <div className="mkt-alert error">{error || contextError}</div>}
        {notice && <div className="mkt-alert success">✓ {notice}</div>}

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
                <strong>{money(data.totals.commission)}</strong>
                <p>Rincian komisi ↗</p>
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
              <h4>Tindak Lanjut Tenant Menunggak</h4>
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
        </section>

        <footer>© {new Date().getFullYear()} OKESIH.COM · Portal Mitra Marketing</footer>
      </div>

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
