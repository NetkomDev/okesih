"use client";
import Link from "next/link";
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
        <div className="owner-onboarding-backdrop">
          <section className="owner-onboarding-card">
            <img src="/logo.svg?v=2" alt="OKESIH" />
            <small>SELAMAT DATANG DI OKESIH</small>
            <h2>Siapkan akun Owner Anda</h2>
            {!onboarding.password_changed_at ? (
              <>
                <p>
                  Demi keamanan, ganti password awal yang diberikan Super Admin
                  sebelum menggunakan dashboard.
                </p>
                <label>
                  Password baru
                  <input
                    type="password"
                    minLength={8}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Minimal 8 karakter"
                  />
                </label>
                <button
                  className="btn-primary"
                  disabled={busy || newPassword.length < 8}
                  onClick={() =>
                    void onboardingAction({
                      action: "change_password",
                      password: newPassword,
                    })
                  }
                >
                  {busy ? "Menyimpan..." : "Ganti Password & Lanjut"}
                </button>
              </>
            ) : (
              <>
                <p>
                  Pasang Dashboard Owner agar OKESIH dapat dibuka langsung dari
                  layar utama. Browser tetap akan meminta persetujuan Anda.
                </p>
                <PwaInstallButton
                  label="Install OKESIH Owner"
                  onInstalled={() =>
                    void onboardingAction({ action: "pwa_installed" })
                  }
                />
                <button
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => void onboardingAction({ action: "complete" })}
                >
                  Lanjut ke Dashboard
                </button>
              </>
            )}
            {error && <div className="owner-error">{error}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
