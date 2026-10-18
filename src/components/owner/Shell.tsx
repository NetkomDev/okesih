"use client";
import PwaInstallButton from "@/components/PwaInstallButton";
import PwaRoleInstallModal from "@/components/PwaRoleInstallModal";
import ThemeToggle from "@/components/ThemeToggle";
import { appUrl } from "@/lib/app-origins";
import { logoutUser } from "@/lib/auth-helpers";
import Link from "next/link";
import { usePathname,useRouter } from "next/navigation";
import { useEffect,useState } from "react";
import { useOwnerSession } from "./provider";

export default function OwnerShell({ children }: { children: React.ReactNode }) {
const { profile, onboarding, onboardingReady, onboardingAction, error, busy, newPassword, setNewPassword } = useOwnerSession();
const pathname = usePathname();
const router = useRouter();
const [sidebarExpanded, setSidebarExpanded] = useState(false);
const [autoHide, setAutoHide] = useState(true);
useEffect(() => {
    if (pathname !== "/owner") return;
    const legacyRoutes: Record<string, string> = { "#menu": "/owner/menu", "#staf": "/owner/staff", "#waiter": "/owner/waiters", "#qris": "/owner/qris-tables" };
    const destination = legacyRoutes[window.location.hash];
    if (destination) router.replace(destination);
  }, [pathname, router]);
const view = pathname.endsWith("/menu") ? "menu" : pathname.endsWith("/staff") ? "staff" : pathname.endsWith("/waiters") ? "waiters" : pathname.endsWith("/qris-tables") ? "qris-tables" : pathname.endsWith("/devices") ? "devices" : pathname.endsWith("/pin") ? "pin" : "overview";
function renderNavIcon(itemView: string) {
  switch (itemView) {
    case "overview":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-6v6H4.5A1.5 1.5 0 0 1 3 20V9.5z" />
        </svg>
      );
    case "staff":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "waiters":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 17h20" />
          <path d="M4 17a8 8 0 0 1 16 0" />
          <circle cx="12" cy="7" r="1.5" />
        </svg>
      );
    case "menu":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </svg>
      );
    case "devices":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="3" />
          <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
        </svg>
      );
    case "qris-tables":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="6" height="6" rx="1.5" />
          <rect x="15" y="3" width="6" height="6" rx="1.5" />
          <rect x="3" y="15" width="6" height="6" rx="1.5" />
          <path d="M15 15h2v2h-2z" />
          <path d="M19 19h2v2h-2z" />
          <path d="M15 19h2v2h-2z" />
          <path d="M19 15h2v2h-2z" />
        </svg>
      );
    case "pin":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    default:
      return null;
  }
}

const navItems = [
    { label: "Home", mobileLabel: "Home", href: "/owner", itemView: "overview" },
    { label: "Akun Staf", mobileLabel: "Staf", href: "/owner/staff", itemView: "staff" },
    { label: "Waiter", mobileLabel: "Waiter", href: "/owner/waiters", itemView: "waiters" },
    { label: "Katalog Menu", mobileLabel: "Menu", href: "/owner/menu", itemView: "menu" },
    { label: "Perangkat", mobileLabel: "Device", href: "/owner/devices", itemView: "devices" },
    { label: "QRIS & Meja", mobileLabel: "QRIS", href: "/owner/qris-tables", itemView: "qris-tables" },
    { label: "PIN Keamanan", mobileLabel: "PIN", href: "/owner/pin", itemView: "pin" },
  ];
return (<div className={`owner-shell ${sidebarExpanded ? "sidebar-open" : "sidebar-closed"}`}>
      {/* Popup Install Otomatis Pasca Login Khusus Owner */}
      <PwaRoleInstallModal
        pwaKind="owner"
        enabled={onboardingReady && Boolean(onboarding?.completed_at)}
      />

      <aside className="owner-sidebar" onMouseEnter={() => autoHide && setSidebarExpanded(true)} onMouseLeave={() => autoHide && setSidebarExpanded(false)}>

        <div className="owner-sidebar-head"><span className="owner-sidebar-mark">O</span><b>OWNER SPACE</b><button className="owner-sidebar-toggle" onClick={() => setSidebarExpanded((value) => !value)} aria-label="Buka atau ciutkan sidebar">☰</button></div>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              title={item.label}
              className={view === item.itemView ? "active" : ""}
              aria-current={view === item.itemView ? "page" : undefined}
            >
              <span className="owner-nav-icon">{renderNavIcon(item.itemView)}</span>
              <b className="owner-nav-desktop-label">{item.label}</b>
              <b className="owner-nav-mobile-label">{item.mobileLabel}</b>
            </Link>
          ))}
        </nav>
        <div className="owner-sidebar-footer">
          <button type="button" className="owner-sidebar-logout" onClick={logoutUser} title="Keluar dari Akun Owner" aria-label="Keluar dari akun owner">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Keluar</span>
          </button>
          <label className="owner-autohide"><input type="checkbox" checked={autoHide} onChange={(event) => setAutoHide(event.target.checked)} /><span>Auto-hide</span></label>
        </div>
      </aside>

      <div className="owner-content">
        <header className={`owner-topbar ${view === "overview" ? "is-home" : "is-subpage"}`}>
          {view === "overview" ? (
            <>
              <div className="owner-brand">
                <img src={profile.logo_url || "/logo.svg?v=2"} alt={profile.logo_url ? `Logo ${profile.nama}` : "OKESIH"}/>
                <div>
                  <strong>{profile.nama}</strong>
                  <small>PORTAL OWNER BISNIS</small>
                </div>
                <span className="owner-status">● {profile.is_active ? "Buka & Beroperasi" : "Tidak Aktif"}</span>
              </div>
              <div className="owner-home-divider" aria-hidden="true" />
            </>
          ) : (
            <div className="owner-subpage-title">
              <h1>
                {view === "menu"
                  ? "Katalog Menu"
                  : view === "staff"
                  ? "Akun Staf"
                  : view === "waiters"
                  ? "Daftar Waiter"
                  : view === "qris-tables"
                  ? "QRIS & Meja"
                  : view === "devices"
                  ? "Perangkat & PWA"
                  : "Portal Owner"}
              </h1>
              <p>
                {view === "menu"
                  ? "Kelola menu, varian, harga jual, dan ketersediaan stok"
                  : view === "staff"
                  ? "Kelola akun login staf kasir dan barista/dapur"
                  : view === "waiters"
                  ? "Kelola daftar pelayan aktif usaha Anda"
                  : view === "qris-tables"
                  ? "Identitas toko, QRIS statis, dan cetak stiker meja"
                  : view === "devices"
                  ? "Pairing perangkat POS tablet kasir dan layar KDS dapur"
                  : ""}
              </p>
            </div>
          )}
          <div className="owner-actions">{view !== "overview" && <ThemeToggle/>}<PwaInstallButton label="Install Owner" compact onInstalled={() => void onboardingAction({ action: "pwa_installed" })}/><a href={appUrl("POS", "/pos")} target="_blank" rel="noopener noreferrer" className="btn-secondary">Layar Kasir</a><a href={appUrl("KDS", "/kds")} target="_blank" rel="noopener noreferrer" className="btn-secondary">Layar Dapur</a></div>
        </header>

        <main className="owner-main">{children}</main>
      </div>

      {onboardingReady && onboarding && !onboarding.completed_at && <div className="owner-onboarding-backdrop"><section className="owner-onboarding-card"><img src="/logo.svg?v=2" alt="OKESIH"/><small>SELAMAT DATANG DI OKESIH</small><h2>Siapkan akun Owner Anda</h2>{!onboarding.password_changed_at ? <><p>Demi keamanan, ganti password awal yang diberikan Super Admin sebelum menggunakan dashboard.</p><label>Password baru<input type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Minimal 8 karakter"/></label><button className="btn-primary" disabled={busy || newPassword.length < 8} onClick={() => void onboardingAction({ action: "change_password", password: newPassword })}>{busy ? "Menyimpan..." : "Ganti Password & Lanjut"}</button></> : <><p>Pasang Dashboard Owner agar OKESIH dapat dibuka langsung dari layar utama. Browser tetap akan meminta persetujuan Anda.</p><PwaInstallButton label="Install OKESIH Owner" onInstalled={() => void onboardingAction({ action: "pwa_installed" })}/><button className="btn-secondary" disabled={busy} onClick={() => void onboardingAction({ action: "complete" })}>Lanjut ke Dashboard</button></>}{error && <div className="owner-error">{error}</div>}</section></div>}

      
      
      
      
      

      
    </div>);
}
