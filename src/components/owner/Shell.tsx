"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PwaRoleInstallModal from "@/components/PwaRoleInstallModal";
import PwaInstallButton from "@/components/PwaInstallButton";
import { logoutUser } from "@/lib/auth-helpers";
import OwnerIcon, { type OwnerIconName } from "./Icon";
import { useOwnerSession } from "./provider";

const navigation: { label: string; href: string; icon: OwnerIconName }[] = [
  { label: "Home", href: "/owner", icon: "home" },
  { label: "Menu", href: "/owner/menu", icon: "menu" },
  { label: "Tim", href: "/owner/team", icon: "team" },
  { label: "QRIS", href: "/owner/qris-tables", icon: "qr" },
  { label: "Lainnya", href: "/owner/more", icon: "more" },
];
const titles: Record<string, [string, string]> = {
  "/owner/menu": ["Katalog menu", "Menu, harga, dan ketersediaan."],
  "/owner/team": ["Tim usaha", "Kelola staf dan waiter di satu tempat."],
  "/owner/staff": ["Tim usaha", "Kelola staf dan waiter di satu tempat."],
  "/owner/waiters": ["Tim usaha", "Kelola staf dan waiter di satu tempat."],
  "/owner/qris-tables": [
    "QRIS & meja",
    "Pembayaran dan pemesanan lebih praktis.",
  ],
  "/owner/devices": ["Perangkat", "Hubungkan kasir dan layar dapur."],
  "/owner/pin": ["Keamanan PIN", "Anda yang mengatur akses laporan."],
  "/owner/more": ["Ruang owner", "Pengaturan dan akses aplikasi Anda."],
};
export default function OwnerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    profile,
    onboarding,
    onboardingReady,
    onboardingAction,
    error,
    busy,
    newPassword,
    setNewPassword,
  } = useOwnerSession();
  const [showPassword, setShowPassword] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const home = pathname === "/owner";
  const active = ["/owner/staff", "/owner/waiters"].includes(pathname)
    ? "/owner/team"
    : ["/owner/pin", "/owner/devices"].includes(pathname)
      ? "/owner/more"
      : pathname;
  const title = titles[pathname] || ["Ruang owner", "Kelola usaha Anda."];
  useEffect(() => {
    if (pathname !== "/owner") return;
    const routes: Record<string, string> = {
      "#menu": "/owner/menu",
      "#staf": "/owner/team",
      "#waiter": "/owner/waiters",
      "#qris": "/owner/qris-tables",
    };
    const destination = routes[window.location.hash];
    if (destination) router.replace(destination);
  }, [pathname, router]);
  return (
    <div
      className={`owner-shell owner-v2 ${sidebarExpanded ? "sidebar-open" : "sidebar-closed"}`}
    >
      <PwaRoleInstallModal
        pwaKind="owner"
        enabled={onboardingReady && Boolean(onboarding?.completed_at)}
      />
      <aside className="owner-sidebar">
        <div className="owner-sidebar-head">
          <span className="owner-sidebar-mark">O</span>
          <b>OWNER SPACE</b>
          <button
            onClick={() => setSidebarExpanded((value) => !value)}
            aria-label="Buka atau ciutkan sidebar"
          >
            ☰
          </button>
        </div>
        <nav aria-label="Navigasi owner desktop">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              title={item.label}
              className={active === item.href ? "active" : ""}
              aria-current={active === item.href ? "page" : undefined}
            >
              <span className="owner-nav-icon">
                <OwnerIcon name={item.icon} />
              </span>
              <b className="owner-nav-desktop-label">{item.label}</b>
            </Link>
          ))}
        </nav>
        <div className="owner-sidebar-footer">
          <button
            className="owner-sidebar-logout"
            onClick={logoutUser}
            title="Keluar"
          >
            <OwnerIcon name="logout" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
      <div className="owner-content">
        <header
          className={`owner-app-header ${home ? "owner-app-header--home" : ""}`}
        >
          {home ? (
            <div className="owner-business">
              <img
                src={profile.logo_url || "/logo.svg?v=2"}
                width={48}
                height={48}
                alt="Logo usaha"
              />
              <div>
                <span>OWNER SPACE</span>
                <h1>{profile.nama}</h1>
                <small>
                  <i className={profile.is_active ? "is-active" : ""} />
                  {profile.is_active ? "Usaha aktif" : "Usaha nonaktif"}
                </small>
              </div>
            </div>
          ) : (
            <div className="owner-page-title">
              <span>OWNER SPACE</span>
              <h1>{title[0]}</h1>
              <p>{title[1]}</p>
            </div>
          )}
          <Link
            href="/owner/more"
            prefetch={false}
            className="owner-header-more"
            aria-label="Buka pengaturan owner"
          >
            <OwnerIcon name="more" />
          </Link>
        </header>
        <main className="owner-main">{children}</main>
      </div>
      <nav className="owner-bottom-nav" aria-label="Navigasi utama owner">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={active === item.href ? "is-active" : ""}
            aria-current={active === item.href ? "page" : undefined}
          >
            <span>
              <OwnerIcon name={item.icon} />
            </span>
            <b>{item.label}</b>
          </Link>
        ))}
      </nav>
      {onboardingReady && onboarding && !onboarding.completed_at && (
        <div
          className="owner-onboarding-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-onboarding-title"
        >
          <section className="owner-onboarding-card">
            <div className="owner-onboarding-icon-box">
              <Image
                src="/logo.svg?v=2"
                alt="OKESIH Logo"
                width={48}
                height={48}
                priority
                style={{ width: "48px", height: "48px", objectFit: "contain" }}
              />
            </div>
            <small className="owner-onboarding-badge">SELAMAT DATANG DI OKESIH</small>
            <h2 id="owner-onboarding-title">
              {!onboarding.password_changed_at
                ? "Ganti Password Akun Owner"
                : "Pasang Aplikasi Owner"}
            </h2>
            {!onboarding.password_changed_at ? (
              <>
                <p>
                  Demi keamanan akun usaha Anda, ganti password awal yang dibuatkan Super Admin sebelum masuk ke dashboard.
                </p>
                <label className="owner-onboarding-label">
                  <span>Password Baru</span>
                  <div className="owner-onboarding-input-wrap">
                    <input
                      type={showPassword ? "text" : "password"}
                      minLength={8}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Minimal 8 karakter"
                      autoComplete="new-password"
                      className="owner-onboarding-input"
                    />
                    <button
                      type="button"
                      className="owner-onboarding-toggle-pwd"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? (
                        <>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                          <span>Tutup</span>
                        </>
                      ) : (
                        <>
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          <span>Lihat</span>
                        </>
                      )}
                    </button>
                  </div>
                </label>
                <button
                  type="button"
                  className="btn-primary owner-onboarding-btn"
                  disabled={busy || newPassword.length < 8}
                  onClick={() =>
                    void onboardingAction({
                      action: "change_password",
                      password: newPassword,
                    })
                  }
                >
                  {busy ? "Menyimpan..." : "Simpan Password & Lanjut"}
                </button>
              </>
            ) : (
              <>
                <p>
                  Pasang Dashboard Owner ke layar utama perangkat agar dapat dibuka cepat layaknya aplikasi native.
                </p>
                <div style={{ display: "grid", gap: "10px", width: "100%" }}>
                  <PwaInstallButton
                    label="Install OKESIH Owner"
                    onInstalled={() =>
                      void onboardingAction({ action: "pwa_installed" })
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary owner-onboarding-btn"
                    disabled={busy}
                    onClick={() => void onboardingAction({ action: "complete" })}
                  >
                    {busy ? "Memproses..." : "Lanjut ke Dashboard"}
                  </button>
                </div>
              </>
            )}
            {error && (
              <div className="owner-error" role="alert">
                <p style={{ margin: 0 }}>{error}</p>
                {error.toLowerCase().includes("sesi login") && (
                  <p style={{ margin: "6px 0 0", fontSize: "0.82rem", opacity: 0.9 }}>
                    Sesi perlu diperbarui setelah ganti password. Silakan masuk kembali dengan password baru Anda.
                  </p>
                )}
              </div>
            )}
            <div className="owner-onboarding-footer">
              <button
                type="button"
                className="owner-onboarding-logout-btn"
                onClick={logoutUser}
              >
                {error.toLowerCase().includes("sesi login")
                  ? "Masuk Kembali dengan Password Baru"
                  : "Keluar / Ganti Akun"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
