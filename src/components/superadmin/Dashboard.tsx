"use client";
import ModalFrame from "./ModalFrame";
import MobileNav from "./MobileNav";
import PwaInstallButton from "@/components/PwaInstallButton";
import PwaRoleInstallModal from "@/components/PwaRoleInstallModal";
import PwaRoleMismatchModal from "@/components/PwaRoleMismatchModal";
import ThemeToggle from "@/components/ThemeToggle";
import { logoutUser,useAuthGuard } from "@/lib/auth-helpers";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback,useEffect,useState,useRef } from "react";
import { SuperadminContext } from "./context";
const Overview=dynamic(() => import("./Overview"), { loading: () => <p role="status">Memuat fitur...</p> });
const Tenants=dynamic(() => import("./Tenants"), { loading: () => <p role="status">Memuat fitur...</p> });
const Marketing=dynamic(() => import("./Marketing"), { loading: () => <p role="status">Memuat fitur...</p> });
const Billing=dynamic(() => import("./Billing"), { loading: () => <p role="status">Memuat fitur...</p> });
const Settings=dynamic(() => import("./Settings"), { loading: () => <p role="status">Memuat fitur...</p> });
interface ToastNotification {
  title: string;
  message: string;
  type: "success" | "error" | "info";
}
interface ConfirmModalData {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: "danger" | "primary" | "success";
  onConfirm: () => void;
}
type AnalyticsPeriod = "today" | "week" | "month" | "year";
interface AnalyticsData {
  totalTenants: number;
  totalMarketing: number;
  activeTenants: number;
  newTenants: number;
  receipts: number;
  grossBilling: number;
  marketingCommission: number;
  netRevenue: number;
  startAt: string;
  endAt: string;
  regions: Array<{ province: string; total: number; active: number }>;
  series: Array<{ day: string; receipts: number; gross: number; commission: number }>;
}
export default function SuperAdminDashboardPage() {
  const [summaryRevision, setSummaryRevision] = useState(0);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>("today");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const refreshSummary = () => setSummaryRevision(value => value + 1);
  const setTotalTenants = useCallback((value: number) => setAnalytics(previous => previous ? { ...previous, totalTenants: value } : previous), []);

const [createIntent, setCreateIntent] = useState<"tenant" | "marketing" | null>(null);
const { isAuthorized, loading, roleMismatch } = useAuthGuard(["SUPERADMIN"]);
const [theme, setTheme] = useState<"dark" | "light">("dark");
useEffect(() => {
    if (typeof window !== "undefined") {
      const initialTimer = window.setTimeout(() => {
        const active = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
        setTheme(active);
      }, 0);

      const handleThemeChange = () => {
        const t = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
        setTheme(t);
      };

      window.addEventListener("theme-change", handleThemeChange);
      window.addEventListener("storage", handleThemeChange);
      return () => {
        window.clearTimeout(initialTimer);
        window.removeEventListener("theme-change", handleThemeChange);
        window.removeEventListener("storage", handleThemeChange);
      };
    }
  }, []);
const isDark = theme === "dark";
const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "marketing" | "qris_billing" | "platform_config">("overview");
const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
const sidebarRef = useRef<HTMLElement>(null);
const menuButtonRef = useRef<HTMLButtonElement>(null);
const [compactScreen, setCompactScreen] = useState(false);
const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
useEffect(() => {
  const query = window.matchMedia("(max-width: 1024px)");
  const sync = () => { setCompactScreen(query.matches); if (!query.matches) setMobileSidebarOpen(false); };
  sync(); query.addEventListener("change", sync);
  return () => query.removeEventListener("change", sync);
}, []);
useEffect(() => {
  if (!mobileSidebarOpen || !compactScreen) return;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  const sidebar = sidebarRef.current!;
  const menuButton = menuButtonRef.current;
  sidebar.querySelector<HTMLButtonElement>(".sa-mobile-close")?.focus();
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setMobileSidebarOpen(false);
    if (event.key !== "Tab") return;
    const buttons = [...sidebar.querySelectorAll<HTMLElement>('button, a[href]')].filter(node => node.getClientRects().length && !node.hasAttribute("disabled"));
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  sidebar.addEventListener("keydown", keydown);
  return () => { document.body.style.overflow = previousOverflow; sidebar.removeEventListener("keydown", keydown); menuButton?.focus(); };
}, [mobileSidebarOpen, compactScreen]);
const [autoHideEnabled, setAutoHideEnabled] = useState<boolean>(false);
const [isHovered, setIsHovered] = useState<boolean>(false);
useEffect(() => {
    if (typeof window !== "undefined") {
      const timer = window.setTimeout(() => {
        const saved = window.localStorage.getItem("okesih-superadmin-sidebar");
        if (saved === "collapsed") setSidebarCollapsed(true);
        const savedAutoHide = window.localStorage.getItem("okesih-superadmin-autohide");
        if (savedAutoHide === "1") setAutoHideEnabled(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);
const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("okesih-superadmin-sidebar", next ? "collapsed" : "expanded");
      }
      return next;
    });
  };
const toggleAutoHide = () => {
    setAutoHideEnabled((cur) => {
      const next = !cur;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("okesih-superadmin-autohide", next ? "1" : "0");
      }
      return next;
    });
  };
const openDashboardView = (view: typeof activeTab) => {
    setActiveTab(view);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
const [toast, setToast] = useState<ToastNotification | null>(null);
const showToast = useCallback((title: string, message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ title, message, type });
  }, []);
useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
const [confirmModal, setConfirmModal] = useState<ConfirmModalData>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
useEffect(() => {
    if (!isAuthorized) return;
    let active = true;
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const response = await fetch(`/api/superadmin/analytics?period=${analyticsPeriod}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Gagal memuat riwayat pencapaian.");
        if (active) setAnalytics(payload.data);
      } catch (error) {
        if (active) showToast("Analytics Tidak Tersedia", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
      } finally {
        if (active) setAnalyticsLoading(false);
      }
    };
    loadAnalytics();
    return () => { active = false; };
  }, [analyticsPeriod, isAuthorized, showToast, summaryRevision]);

if (roleMismatch) {
    return (
      <PwaRoleMismatchModal
        isOpen={true}
        pwaKind={roleMismatch.pwaKind}
      />
    );
  }
if (loading || !isAuthorized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "#06090E" : "#F8FAFC",
          color: isDark ? "#F0F6FC" : "#0F172A",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "2.5rem" }}>🛡️</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0284C7" }}>
          Memverifikasi Otoritas Super Admin Pusat...
        </div>
        <div style={{ fontSize: "0.85rem", color: isDark ? "#64748B" : "#94A3B8" }}>
          Pemeriksaan token peran &amp; hak akses ekosistem OKESIH
        </div>
      </div>
    );
  }
return (<SuperadminContext.Provider value={{ isDark, showToast, setConfirmModal, openDashboardView, activeTab, analytics, analyticsPeriod, setAnalyticsPeriod, analyticsLoading, totalTenants: analytics?.totalTenants ?? 0, setTotalTenants, createIntent, setCreateIntent, refreshSummary }}><div
      className={`superadmin-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}
      style={{
        minHeight: "100vh",
        backgroundColor: isDark ? "#06090E" : "#F8FAFC",
        color: isDark ? "#F0F6FC" : "#0F172A",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      {/* Popup Install Otomatis Pasca Login Khusus Super Admin */}
      <PwaRoleInstallModal pwaKind="superadmin" />

      {/* Toast Notification Floating Container */}

      {toast && (
        <div className="sa-toast" role="status"
          style={{
            position: "fixed",
            top: "1.5rem",
            right: "1.5rem",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            padding: "0.85rem 1.25rem",
            borderRadius: "12px",
            background: isDark ? "#0F172A" : "#FFFFFF",
            color: isDark ? "#FFFFFF" : "#0F172A",
            border:
              toast.type === "success"
                ? "1px solid #10B981"
                : toast.type === "error"
                ? "1px solid #EF4444"
                : "1px solid #0EA5E9",
            boxShadow: isDark
              ? "0 10px 30px rgba(0, 0, 0, 0.6)"
              : "0 10px 30px rgba(0, 0, 0, 0.12)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>
            {toast.type === "success" ? "✅" : toast.type === "error" ? "⚠️" : "ℹ️"}
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.875rem" }}>{toast.title}</div>
            <div style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B" }}>
              {toast.message}
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: isDark ? "#94A3B8" : "#64748B",
              cursor: "pointer",
              fontSize: "1rem",
              marginLeft: "0.5rem",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Super Admin Backdrop for Mobile */}
      <div
        className={`superadmin-sidebar-backdrop ${mobileSidebarOpen ? "is-visible" : ""}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* Collapsible & Auto-Hide Sidebar */}
      <aside ref={sidebarRef} id="sa-sidebar" inert={compactScreen && !mobileSidebarOpen} aria-label="Menu Super Admin"
        className={`superadmin-sidebar ${sidebarCollapsed ? "is-collapsed" : "is-expanded"} ${mobileSidebarOpen ? "is-mobile-open" : ""} ${autoHideEnabled ? "is-autohide" : ""} ${isHovered && sidebarCollapsed ? "is-peek" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button type="button" className="sa-mobile-close" onClick={() => setMobileSidebarOpen(false)} aria-label="Tutup menu">✕</button>
        {/* Sidebar Header */}
        <div className="superadmin-sidebar-header">
          <div
            className="superadmin-sidebar-brand"
            onClick={() => sidebarCollapsed && toggleSidebar()}
            style={{ cursor: sidebarCollapsed ? "pointer" : "default" }}
            title={sidebarCollapsed ? "Klik untuk memperluas sidebar" : undefined}
          >
            <Image src="/logo.svg?v=2" width={42} height={42} alt="OKESIH Logo" />
            <div className="superadmin-sidebar-brand-text" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "-0.02em", color: isDark ? "#FFFFFF" : "#0F172A", lineHeight: 1.1 }}>
                OKESIH<span style={{ color: "#0284C7" }}> HQ</span>
              </div>
              <div style={{ fontSize: "0.68rem", color: isDark ? "#7DD3FC" : "#0284C7", fontWeight: 800, letterSpacing: "0.04em" }}>
                COMMAND CENTER
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className="superadmin-sidebar-toggle-btn"
            title={sidebarCollapsed ? "Perluas Sidebar" : "Lipat Sidebar (Collapse)"}
            aria-label="Buka atau tutup menu"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: sidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s ease",
              }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="superadmin-sidebar-content">
          <div className="superadmin-sidebar-section-title">PLATFORM SAAS &amp; OPERASIONAL</div>

          <nav className="superadmin-sidebar-menu">
            {/* 1. Overview */}
            <button
              type="button"
              onClick={() => openDashboardView("overview")}
              className={`superadmin-sidebar-item ${activeTab === "overview" ? "is-active" : ""}`}
              title="Overview & Finansial"
            >
              <div className="superadmin-sidebar-item-icon">
                📊
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Overview &amp; Finansial</strong>
                <span>Metrik Global &amp; Wilayah</span>
              </div>
            </button>

            {/* 2. Tenant Warkop */}
            <button
              type="button"
              onClick={() => openDashboardView("tenants")}
              className={`superadmin-sidebar-item ${activeTab === "tenants" ? "is-active" : ""}`}
              title="Daftar Tenant Warkop"
            >
              <div className="superadmin-sidebar-item-icon">
                🏢
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Daftar Tenant Warkop</strong>
                <span>Rentang Kode Unik &amp; Akun</span>
              </div>
              <span className="superadmin-sidebar-item-badge">{analytics?.totalTenants ?? 0}</span>
            </button>

            {/* 3. Marketing */}
            <button
              type="button"
              onClick={() => openDashboardView("marketing")}
              className={`superadmin-sidebar-item ${activeTab === "marketing" ? "is-active" : ""}`}
              title="Marketing Lapangan"
            >
              <div className="superadmin-sidebar-item-icon">
                🤝
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Mitra Marketing</strong>
                <span>Referral &amp; Bagi Hasil</span>
              </div>
              <span className="superadmin-sidebar-item-badge" style={{ background: "rgba(16, 185, 129, 0.14)", color: "#10B981" }}>
                {analytics?.totalMarketing ?? 0}
              </span>
            </button>

            {/* 4. QRIS Billing */}
            <button
              type="button"
              onClick={() => openDashboardView("qris_billing")}
              className={`superadmin-sidebar-item ${activeTab === "qris_billing" ? "is-active" : ""}`}
              title="Billing QRIS SaaS"
            >
              <div className="superadmin-sidebar-item-icon">
                💳
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Billing &amp; QRIS SaaS</strong>
                <span>Rekening Pusat &amp; Biaya</span>
              </div>
            </button>

            {/* 5. Parameter Master */}
            <button
              type="button"
              onClick={() => openDashboardView("platform_config")}
              className={`superadmin-sidebar-item ${activeTab === "platform_config" ? "is-active" : ""}`}
              title="Parameter Master Global"
            >
              <div className="superadmin-sidebar-item-icon">
                ⚙️
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Parameter Master</strong>
                <span>Tarif SaaS &amp; Kuota</span>
              </div>
            </button>
          </nav>

          {/* Quick Actions in Sidebar */}
          <div className="superadmin-sidebar-quick-actions" style={{ marginTop: "0.5rem" }}>
            <div className="superadmin-sidebar-section-title" style={{ marginBottom: "0.5rem" }}>TINDAKAN CEPAT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={() => { openDashboardView("tenants"); setCreateIntent("tenant"); }}
                className="btn-primary"
                style={{
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                }}
              >
                <span>+</span> Daftarkan Warkop
              </button>
              <button
                type="button"
                onClick={() => { openDashboardView("marketing"); setCreateIntent("marketing"); }}
                className="btn-primary"
                style={{
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                }}
              >
                <span>+</span> Daftarkan Marketing
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="superadmin-sidebar-footer">
          {/* Expanded Footer Details */}
          <div className="superadmin-sidebar-expanded-footer">
            {/* Auto-Hide Toggle Switch */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.35rem 0.5rem",
                borderRadius: "8px",
                background: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(0, 0, 0, 0.04)",
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
              onClick={toggleAutoHide}
              title="Bila aktif, sidebar otomatis melipat dan melayang saat mouse mendekat"
            >
              <span style={{ color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700 }}>Auto-Hide (Hover Peek)</span>
              <span style={{ fontWeight: 800, color: autoHideEnabled ? "#10B981" : isDark ? "#64748B" : "#94A3B8" }}>
                {autoHideEnabled ? "ON" : "OFF"}
              </span>
            </div>

            {/* Admin User Card */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.75rem" }}>
                  HQ
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: isDark ? "#fff" : "#0F172A", lineHeight: 1.1 }}>Super Admin</div>
                  <div style={{ fontSize: "0.68rem", color: "#10B981", fontWeight: 700 }}>🟢 Online</div>
                </div>
              </div>
              <button
                onClick={logoutUser}
                className="btn-secondary"
                style={{ padding: "0.35rem 0.65rem", fontSize: "0.72rem", color: "#EF4444", borderColor: "rgba(239, 68, 68, 0.4)", borderRadius: "6px" }}
                title="Keluar dari sesi Super Admin"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mini Collapsed Footer Controls */}
          <div className="superadmin-sidebar-collapsed-footer">
            <button
              type="button"
              onClick={toggleSidebar}
              style={{
                background: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(0, 0, 0, 0.06)",
                border: isDark ? "1px solid rgba(148, 163, 184, 0.2)" : "1px solid rgba(0, 0, 0, 0.12)",
                borderRadius: "8px",
                color: isDark ? "#F8FAFC" : "#0F172A",
                width: "36px",
                height: "36px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.18s ease",
              }}
              title="Perluas Sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <polyline points="14 9 17 12 14 15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={logoutUser}
              style={{
                background: "transparent",
                border: "none",
                color: "#EF4444",
                fontSize: "1.15rem",
                padding: "0.25rem",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
              }}
              title="Logout"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="superadmin-workspace">
        {/* Topbar */}
        <header className="superadmin-topbar">
          <div className="sa-topbar-title" style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            {/* Toggle Button (Desktop & Mobile) */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth <= 1024) {
                  setMobileSidebarOpen((prev) => !prev);
                } else {
                  toggleSidebar();
                }
              }}
              className="superadmin-topbar-toggle" ref={menuButtonRef} aria-controls="sa-sidebar" aria-expanded={compactScreen ? mobileSidebarOpen : !sidebarCollapsed}
              style={{ display: "inline-flex" }}
              title={sidebarCollapsed ? "Perluas Sidebar" : "Lipat Sidebar"}
              aria-label="Buka atau tutup menu"
            >
              ☰
            </button>

            {/* Breadcrumb */}
            <div className="superadmin-breadcrumb">
              <span style={{ color: isDark ? "#64748B" : "#94A3B8", fontWeight: 700 }}>OKESIH HQ</span>
              <span style={{ color: isDark ? "#475569" : "#CBD5E1" }}>/</span>
              <span style={{ color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 800 }}>
                {activeTab === "overview" && "Overview & Finansial"}
                {activeTab === "tenants" && "Daftar Tenant Warkop"}
                {activeTab === "marketing" && "Mitra Marketing Lapangan"}
                {activeTab === "qris_billing" && "Billing & QRIS SaaS"}
                {activeTab === "platform_config" && "Parameter Master Global"}
              </span>
            </div>

            <div className="sa-server-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
                background: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                fontSize: "0.7rem",
                fontWeight: 800,
                color: "#10B981",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", display: "inline-block", boxShadow: "0 0 8px #10B981" }} />
              HQ Server Online
            </div>
          </div>

          <div className="superadmin-actions" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <ThemeToggle />
            <PwaInstallButton label="Install HQ" compact />

            <button
              onClick={() => { openDashboardView("tenants"); setCreateIntent("tenant"); }}
              className="btn-primary sa-header-create"
              style={{
                background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                padding: "0.45rem 0.95rem",
                fontSize: "0.8rem",
                fontWeight: 800,
                borderRadius: "8px",
              }}
            >
              + Tenant
            </button>

            <button
              onClick={() => { openDashboardView("marketing"); setCreateIntent("marketing"); }}
              className="btn-primary sa-header-create"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
                padding: "0.45rem 0.95rem",
                fontSize: "0.8rem",
                fontWeight: 800,
                borderRadius: "8px",
              }}
            >
              + Marketing
            </button>
          </div>
        </header>

        {/* Main Container */}
        <main className="superadmin-main" id="sa-main">
          {/* RESUME FINANSIAL & EKOSISTEM SAAS GLOBAL */}
          {activeTab === "overview" && <Overview />}

        {/* TAB CONTENT 1: DAFTAR TENANT WARKOP & ALOKASI KODE UNIK */}
        {activeTab === "tenants" && <Tenants />}

        {/* TAB CONTENT 2: MARKETING LAPANGAN & BAGI HASIL KOMISI */}
        {activeTab === "marketing" && <Marketing />}

        {/* TAB CONTENT 3: QRIS PEMBAYARAN SAAS PLATFORM & LOG SETORAN SEWA (OCR AI) */}
        {activeTab === "qris_billing" && <Billing />}

        {/* MODAL DETAIL BUKTI TRANSFER & HASIL OCR AI */}
        

        {/* TAB CONTENT 4: PARAMETER MASTER GLOBAL */}
        {activeTab === "platform_config" && <Settings />}
      </main>
      <MobileNav activeTab={activeTab} onNavigate={openDashboardView} />
    </div>

    {/* MODAL 1: DAFTARKAN TENANT WARKOP BARU */}
      

      {/* MODAL 2: DAFTARKAN MARKETING LAPANGAN BARU */}
      

      {/* MODAL 3: KREDENSIAL OWNER INSTAN (SETELAH TENANT DIDAFTARKAN) */}
      

      {/* MODAL 4: KONFIRMASI MODERN (PENGGANTI WINDOW.CONFIRM) */}
      {confirmModal.isOpen && (
        <ModalFrame label="Konfirmasi tindakan" onClose={() => setConfirmModal(c => ({ ...c, isOpen: false }))}>
          <div
            className="glass-panel"
            style={{
              maxWidth: "460px",
              width: "100%",
              padding: "1.75rem",
              background: isDark ? "#090E17" : "#FFFFFF",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(0, 0, 0, 0.12)",
              borderRadius: "16px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
            }}
          >
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 900,
                color: isDark ? "#FFF" : "#0F172A",
                marginBottom: "0.5rem",
              }}
            >
              {confirmModal.title}
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: isDark ? "#94A3B8" : "#64748B",
                lineHeight: 1.5,
                marginBottom: "1.5rem",
              }}
            >
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirmModal((c) => ({ ...c, isOpen: false }))}
                className="btn-secondary"
                style={{ padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700 }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="btn-primary"
                style={{
                  padding: "0.55rem 1.15rem",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  background:
                    confirmModal.confirmVariant === "danger"
                      ? "linear-gradient(135deg, #EF4444, #DC2626)"
                      : "linear-gradient(135deg, #10B981, #059669)",
                }}
              >
                {confirmModal.confirmText || "Konfirmasi"}
              </button>
            </div>
          </div>
        </ModalFrame>
      )}
    </div></SuperadminContext.Provider>);
}
