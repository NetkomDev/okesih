"use client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { INDONESIA_PROVINCES } from "@/lib/indonesia-regions";
import { logoutUser, useAuthGuard } from "@/lib/auth-helpers";
import "./marketing-dashboard.css";

type Tenant = {
  id: string;
  name: string;
  ownerName: string;
  province: string;
  cityRegency: string;
  receipts: number;
  commission: number;
};

type Application = {
  id: string;
  business_name: string;
  owner_name: string;
  province: string;
  city_regency: string;
  status: "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED";
  review_notes?: string;
  created_at: string;
};

type Dashboard = {
  profile: {
    name: string;
    referralCode: string;
    area: string;
    commissionPaid: number;
  };
  applications: Application[];
  tenants: Tenant[];
  totals: {
    tenants: number;
    pending: number;
    receipts: number;
    commission: number;
  };
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

const money = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;
const labels = {
  PENDING: "Menunggu review",
  PROCESSING: "Sedang diproses",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
};

export default function MarketingDashboardPage() {
  const { isAuthorized, loading } = useAuthGuard(["MARKETING"]);
  const [data, setData] = useState<Dashboard | null>(null);
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

  // State untuk popup install PWA
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelperText, setInstallHelperText] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/marketing/dashboard", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Dashboard gagal dimuat.");
    setData(payload.data);
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const timer = window.setTimeout(
      () => void load().catch((cause) => setError(cause.message)),
      0
    );
    return () => window.clearTimeout(timer);
  }, [isAuthorized, load]);

  // Cek dan tangani PWA prompt untuk popup install setelah login
  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    // Jika belum standalone dan belum pernah ditutup pada sesi ini
    const dismissed = sessionStorage.getItem("mkt_pwa_dismissed") === "1";
    if (!isStandalone && !dismissed) {
      // Beri sedikit jeda agar dashboard selesai render dan transisi mulus
      const popupTimer = window.setTimeout(() => {
        setShowInstallModal(true);
      }, 700);

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setInstallPrompt(e as InstallPromptEvent);
      };

      const handleInstallReady = () => {
        if (window.__okesihInstallPrompt) {
          setInstallPrompt(window.__okesihInstallPrompt as InstallPromptEvent);
        }
      };

      if (window.__okesihInstallPrompt) {
        setInstallPrompt(window.__okesihInstallPrompt as InstallPromptEvent);
      }

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("okesih-install-ready", handleInstallReady);

      return () => {
        window.clearTimeout(popupTimer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("okesih-install-ready", handleInstallReady);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      const result = await installPrompt.prompt();
      if (result.outcome === "accepted") {
        setShowInstallModal(false);
        try {
          sessionStorage.setItem("mkt_pwa_dismissed", "1");
        } catch {}
      }
      setInstallPrompt(null);
    } else {
      setInstallHelperText(
        "Buka menu peramban/browser Anda (ikon titik tiga ⋮ atau tombol Share ⎋ di Safari), lalu pilih 'Tambahkan ke Layar Utama' atau 'Instal Aplikasi'."
      );
    }
  };

  const dismissInstallModal = () => {
    setShowInstallModal(false);
    try {
      sessionStorage.setItem("mkt_pwa_dismissed", "1");
    } catch {}
  };

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
        "Pengajuan berhasil dikirim ke WhatsApp Super Admin. Kredensial owner baru dikirim setelah disetujui."
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !isAuthorized || !data) {
    return (
      <main className="mkt-loading">
        <Image
          src="/okesih-logo-animated.svg"
          alt="OKESIH.COM"
          width={110}
          height={110}
          priority
          unoptimized
        />
        <span>{error || "Menyiapkan dashboard marketing..."}</span>
      </main>
    );
  }

  return (
    <main className="mkt-shell">
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
              <p>Pantau pengajuan tenant dan perkembangan komisi secara transparan.</p>
            </div>
          </div>
        </header>

        {error && <div className="mkt-alert error">{error}</div>}
        {notice && <div className="mkt-alert success">✓ {notice}</div>}

        {/* 4 Cards Statistik dengan icon besar hampir memenuhi latar */}
        <section className="mkt-stats">
          <article>
            <i className="green" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </i>
            <div>
              <small>Tenant aktif</small>
              <strong>{data.totals.tenants}</strong>
              <p>Usaha terverifikasi</p>
            </div>
          </article>

          <article>
            <i className="amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </i>
            <div>
              <small>Menunggu review</small>
              <strong>{data.totals.pending}</strong>
              <p>Pengajuan diproses</p>
            </div>
          </article>

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

          <article>
            <i className="blue" aria-hidden="true">
              <span className="mkt-rp-icon">Rp</span>
            </i>
            <div>
              <small>Komisi berjalan</small>
              <strong>{money(data.totals.commission)}</strong>
              <p>{money(data.profile.commissionPaid)} dicairkan</p>
            </div>
          </article>
        </section>

        {/* Content Grid: Form Pendaftaran Tenant & Data Review */}
        <section className="mkt-content-grid">
          <form onSubmit={submit} className="mkt-panel mkt-form">
            <PanelHead
              icon="＋"
              title="Daftarkan Tenant Baru"
              text="Diverifikasi Super Admin sebelum akun owner diterbitkan."
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
              <b>Alur verifikasi</b>
              <span>Pengajuan → WA Super Admin → Review → Kredensial dikirim ke owner</span>
            </div>
            <button className="mkt-primary" disabled={saving}>
              {saving ? "Mengirim pengajuan..." : "Daftarkan & Kirim WhatsApp"}
            </button>
          </form>

          <div className="mkt-right-column">
            <section className="mkt-panel">
              <PanelHead icon="✓" title="Status Pengajuan" text="Riwayat review tenant terbaru Anda." />
              {data.applications.length === 0 ? (
                <Empty text="Belum ada pengajuan tenant." />
              ) : (
                <div className="mkt-list">
                  {data.applications.map((item) => (
                    <article key={item.id} className="mkt-list-item">
                      <div>
                        <strong>{item.business_name}</strong>
                        <span>
                          {item.owner_name} · {item.city_regency}, {item.province}
                        </span>
                        <small>
                          {new Date(item.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </small>
                      </div>
                      <div className={`mkt-status ${item.status.toLowerCase()}`}>
                        {labels[item.status]}
                      </div>
                      {item.review_notes && <p>Catatan: {item.review_notes}</p>}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="mkt-panel">
              <PanelHead icon="▦" title="Tenant Binaan Aktif" text="Performa usaha yang sudah diverifikasi." />
              {data.tenants.length === 0 ? (
                <Empty text="Tenant aktif akan tampil setelah disetujui Super Admin." />
              ) : (
                <div className="mkt-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Usaha</th>
                        <th>Wilayah</th>
                        <th>Struk</th>
                        <th>Komisi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tenants.map((tenant) => (
                        <tr key={tenant.id}>
                          <td>
                            <strong>{tenant.name}</strong>
                            <span>{tenant.ownerName}</span>
                          </td>
                          <td>
                            {tenant.cityRegency}, {tenant.province}
                          </td>
                          <td>{tenant.receipts}</td>
                          <td>
                            <strong>{money(tenant.commission)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
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

      {/* Modal Popup PWA Install setelah login */}
      {showInstallModal && (
        <div className="mkt-modal-backdrop" role="dialog" aria-modal="true">
          <div className="mkt-modal-card">
            <button
              type="button"
              className="mkt-modal-close"
              onClick={dismissInstallModal}
              aria-label="Tutup popup"
            >
              ✕
            </button>
            <div className="mkt-modal-icon-wrap">
              <Image
                src="/icons/icon-192.png"
                alt="Logo OKESIH"
                width={72}
                height={72}
                priority
              />
            </div>
            <h3>Pasang Aplikasi OKESIH Marketing</h3>
            <p>
              Tambahkan aplikasi langsung ke layar utama HP Anda agar lebih cepat dibuka dan bekerja lebih maksimal tanpa perlu membuka browser lagi.
            </p>

            {installHelperText && (
              <div className="mkt-modal-helper">
                ℹ {installHelperText}
              </div>
            )}

            <div className="mkt-modal-actions">
              <button
                type="button"
                className="mkt-modal-btn-primary"
                onClick={handleInstallClick}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Pasang Sekarang</span>
              </button>
              <button
                type="button"
                className="mkt-modal-btn-secondary"
                onClick={dismissInstallModal}
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}
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

function Empty({ text }: { text: string }) {
  return <div className="mkt-empty">{text}</div>;
}
