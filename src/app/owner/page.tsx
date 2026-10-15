"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useAuthGuard, logoutUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";
import PwaInstallButton from "@/components/PwaInstallButton";
import PwaRoleInstallModal from "@/components/PwaRoleInstallModal";
import PwaRoleMismatchModal from "@/components/PwaRoleMismatchModal";


type MenuItem = { id: string; name: string; price: number; category: string; description: string; isAvailable: boolean };
type Staff = { id: string; username: string; name: string; role: "KASIR" | "DAPUR"; status: "ACTIVE" | "INACTIVE" };
type Waiter = { id: string; name: string; phone: string | null; is_active: boolean };
type BusinessTable = { id: string; label: string; sort_order: number; is_active: boolean };
type Profile = { id: string; nama: string; slug: string; is_active: boolean; logo_url: string | null; qris_image_url: string | null; qris_merchant_name: string | null };
type Metrics = { receiptCount: number; cash: number; qris: number; total: number; billing: { tagihan_pokok: number; kode_unik: number; total_tagihan: number; status_bayar: string } | null };
type RevenuePeriod = "day" | "week" | "month" | "year";
type RevenueData = { period: RevenuePeriod; series: { label: string; value: number }[]; total: number; average: number; transactionCount: number };
type DashboardData = { profile: Profile; menus: MenuItem[]; staff: Staff[]; waiters: Waiter[]; tables: BusinessTable[]; metrics: Metrics };
type DeviceInstallation = { id: string; device_type: "POS" | "KDS"; device_name: string; status: "ACTIVE" | "REVOKED" | "EXPIRED"; paired_at: string; last_seen_at: string; expires_at: string; revoked_at: string | null };
type OwnerOnboarding = { password_changed_at: string | null; owner_pwa_installed_at: string | null; completed_at: string | null };

const ownerDashboardCache = new Map<string, DashboardData>();

async function ownerFetch(path: string, init?: RequestInit) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesi login owner berakhir. Silakan login kembali.");
  const response = await fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "Permintaan gagal diproses.");
  return payload;
}

function money(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

export default function TenantOwnerDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthorized, loading, roleMismatch } = useAuthGuard(["OWNER"]);

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [autoHide, setAutoHide] = useState(true);
  const [menuModal, setMenuModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [waiterModal, setWaiterModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: "", price: "", category: "Kopi", description: "" });
  const [editingMenu, setEditingMenu] = useState<{ id: string; name: string; price: string; category: string; description: string; isAvailable: boolean } | null>(null);
  const [staffForm, setStaffForm] = useState({ username: "", name: "", password: "", role: "KASIR" });
  const [waiterForm, setWaiterForm] = useState({ name: "", phone: "" });
  const [tableInput, setTableInput] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [devices, setDevices] = useState<DeviceInstallation[]>([]);
  const [onboarding, setOnboarding] = useState<OwnerOnboarding | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>("day");
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const qrisInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const loadDashboard = async () => {
    try {
      setError("");
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) throw new Error("Sesi login owner berakhir. Silakan login kembali.");

      const cached = ownerDashboardCache.get(userId);
      if (cached) {
        setData(cached);
        setMerchantName(cached.profile.qris_merchant_name || cached.profile.nama);
      }

      const payload = await ownerFetch("/api/owner/dashboard", { cache: "no-store" });
      ownerDashboardCache.set(userId, payload.data);
      setData(payload.data);
      setMerchantName(payload.data.profile.qris_merchant_name || payload.data.profile.nama);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard gagal dimuat.");
    }
  };

  useEffect(() => {
    // Start data synchronization in parallel with the local auth guard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();

    // Berlangganan event Realtime Supabase untuk tabel menus dan transactions
    // sehingga status ketersediaan menu (Tersedia / Habis) tersinkron otomatis dengan penjualan kasir
    const supabase = createClient();
    const channel = supabase
      .channel("owner-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menus" },
        () => {
          void loadDashboard();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          void loadDashboard();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const loadDeviceCenter = async () => {
    try {
      const [devicePayload, onboardingPayload] = await Promise.all([
        ownerFetch("/api/owner/devices", { cache: "no-store" }),
        ownerFetch("/api/owner/onboarding", { cache: "no-store" }),
      ]);
      setDevices(devicePayload.devices || []);
      setOnboarding(onboardingPayload.onboarding);
      setOnboardingReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pusat perangkat gagal dimuat.");
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    const timer = window.setTimeout(() => void loadDeviceCenter(), 0);
    return () => window.clearTimeout(timer);
  }, [isAuthorized]);

  useEffect(() => {
    if (pathname !== "/owner") return;
    const legacyRoutes: Record<string, string> = { "#menu": "/owner/menu", "#staf": "/owner/staff", "#waiter": "/owner/waiters", "#qris": "/owner/qris-tables" };
    const destination = legacyRoutes[window.location.hash];
    if (destination) router.replace(destination);
  }, [pathname, router]);

  useEffect(() => {
    if (!isAuthorized || pathname !== "/owner") return;
    let cancelled = false;
    const loadRevenue = async () => {
      setRevenueLoading(true);
      try {
        const payload = await ownerFetch(`/api/owner/revenue?period=${revenuePeriod}`, { cache: "no-store" });
        if (!cancelled) setRevenueData(payload.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Grafik omzet gagal dimuat.");
      } finally {
        if (!cancelled) setRevenueLoading(false);
      }
    };
    void loadRevenue();
    return () => { cancelled = true; };
  }, [isAuthorized, pathname, revenuePeriod]);

  const mutate = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try { await work(); await loadDashboard(); }
    catch (err) { setError(err instanceof Error ? err.message : "Perubahan gagal disimpan."); }
    finally { setBusy(false); }
  };

  const createMenu = (event: React.FormEvent) => {
    event.preventDefault();
    void mutate(async () => {
      await ownerFetch("/api/owner/menus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...menuForm, price: Number(menuForm.price) }) });
      setMenuModal(false);
      setMenuForm({ name: "", price: "", category: "Kopi", description: "" });
    });
  };

  const updateMenu = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingMenu) return;
    void mutate(async () => {
      await ownerFetch("/api/owner/menus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingMenu.id,
          name: editingMenu.name,
          price: Number(editingMenu.price),
          category: editingMenu.category,
          description: editingMenu.description,
          isAvailable: editingMenu.isAvailable,
        }),
      });
      setEditingMenu(null);
    });
  };

  const createStaff = (event: React.FormEvent) => {
    event.preventDefault();
    void mutate(async () => {
      await ownerFetch("/api/owner/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(staffForm) });
      setStaffModal(false);
      setStaffForm({ username: "", name: "", password: "", role: "KASIR" });
    });
  };

  const createWaiter = (event: React.FormEvent) => {
    event.preventDefault();
    void mutate(async () => {
      await ownerFetch("/api/owner/waiters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(waiterForm) });
      setWaiterModal(false);
      setWaiterForm({ name: "", phone: "" });
    });
  };

  const addTables = () => void mutate(async () => {
    const labels = tableInput.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    await ownerFetch("/api/owner/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labels }) });
    setTableInput("");
  });

  const uploadQris = (file?: File) => {
    if (!file) return;
    void mutate(async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("merchantName", merchantName);
      await ownerFetch("/api/owner/qris", { method: "POST", body: form });
      if (qrisInput.current) qrisInput.current.value = "";
    });
  };

  const uploadLogo = (file?: File) => {
    if (!file) return;
    void mutate(async () => {
      const form = new FormData();
      form.set("file", file);
      await ownerFetch("/api/owner/branding", { method: "POST", body: form });
      if (logoInput.current) logoInput.current.value = "";
    });
  };

  const printTableStickers = async () => {
    if (!data?.tables.length) return setError("Tambahkan meja terlebih dahulu.");
    const cards = await Promise.all(data.tables.map(async (table) => {
      const url = `${window.location.origin}/menu/${data.profile.slug}?tableId=${encodeURIComponent(table.id)}`;
      return { table, url, qr: await QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: "H" }) };
    }));
    const popup = window.open("", "_blank");
    if (!popup) return setError("Izinkan pop-up browser untuk mencetak stiker meja.");
    popup.document.write(`<!doctype html><html><head><title>Stiker Meja ${escapeHtml(data.profile.nama)}</title><style>body{font-family:Arial;margin:24px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.card{border:2px solid #111;border-radius:16px;padding:18px;text-align:center;break-inside:avoid}.card img{width:190px;height:190px}.name{font-size:18px;font-weight:800}.table{font-size:26px;font-weight:900;margin:8px}.url{font-size:10px;word-break:break-all}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Cetak</button><div class="grid">${cards.map(({ table, url, qr }) => `<div class="card"><div class="name">${escapeHtml(data.profile.nama)}</div><div class="table">Meja ${escapeHtml(table.label)}</div><img src="${qr}" alt="QR Meja ${escapeHtml(table.label)}"/><div>Scan untuk melihat menu & memesan</div><div class="url">${escapeHtml(url)}</div></div>`).join("")}</div><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  const deviceAction = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      await ownerFetch("/api/owner/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setPairingCode("");
      await loadDeviceCenter();
    } catch (err) { setError(err instanceof Error ? err.message : "Perangkat gagal diperbarui."); }
    finally { setBusy(false); }
  };

  const onboardingAction = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      const payload = await ownerFetch("/api/owner/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setOnboarding(payload.onboarding);
      if (body.action === "change_password") setNewPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Onboarding gagal diperbarui."); }
    finally { setBusy(false); }
  };

  if (roleMismatch) {
    return (
      <PwaRoleMismatchModal
        isOpen={true}
        pwaKind={roleMismatch.pwaKind}
      />
    );
  }

  if (loading || !isAuthorized || !data) return (
    <div className="owner-loading" role="status" aria-label="Menyiapkan portal owner OKESIH">
      <div className="owner-loading-brand">
        <span className="owner-loading-halo" />
        <img src="/okesih-logo-animated.svg" alt="OKESIH.COM" />
        <div className="owner-loading-wordmark"><b>OKESIH</b><small>.COM</small></div>
        <div className="owner-loading-progress"><i /></div>
        {error && <button onClick={() => void loadDashboard()}>Coba Lagi</button>}
      </div>
    </div>
  );

  const { profile, metrics } = data;
  const categorySuggestions = Array.from(new Set(["Kopi", "Dingin", "Makanan", "Camilan", "Lainnya", ...data.menus.map((menu) => menu.category)])).sort((a, b) => a.localeCompare(b, "id"));
  const revenueSeries = revenueData?.series || [];
  const revenueMaximum = Math.max(...revenueSeries.map((item) => item.value), 1);
  const chartWidth = 900;
  const chartHeight = 230;
  const chartPadding = 18;
  const revenuePoints = revenueSeries.map((item, index) => {
    const x = revenueSeries.length <= 1 ? chartWidth / 2 : chartPadding + (index / (revenueSeries.length - 1)) * (chartWidth - chartPadding * 2);
    const y = chartHeight - chartPadding - (item.value / revenueMaximum) * (chartHeight - chartPadding * 2);
    return { ...item, x, y };
  });
  const linePath = revenuePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const areaPath = revenuePoints.length ? `${linePath} L${revenuePoints.at(-1)?.x},${chartHeight - chartPadding} L${revenuePoints[0].x},${chartHeight - chartPadding} Z` : "";
  const view = pathname.endsWith("/menu") ? "menu" : pathname.endsWith("/staff") ? "staff" : pathname.endsWith("/waiters") ? "waiters" : pathname.endsWith("/qris-tables") ? "qris-tables" : pathname.endsWith("/devices") ? "devices" : "overview";
  const navItems = [["⌂", "Home", "/owner", "overview"], ["◫", "Katalog Menu", "/owner/menu", "menu"], ["♟", "Akun Staf", "/owner/staff", "staff"], ["▣", "QRIS & Meja", "/owner/qris-tables", "qris-tables"]];

  return (
    <div className={`owner-shell ${sidebarExpanded ? "sidebar-open" : "sidebar-closed"}`}>
      {/* Popup Install Otomatis Pasca Login Khusus Owner */}
      <PwaRoleInstallModal pwaKind="owner" />

      <aside className="owner-sidebar" onMouseEnter={() => autoHide && setSidebarExpanded(true)} onMouseLeave={() => autoHide && setSidebarExpanded(false)}>

        <div className="owner-sidebar-head"><span className="owner-sidebar-mark">O</span><b>OWNER SPACE</b><button className="owner-sidebar-toggle" onClick={() => setSidebarExpanded((value) => !value)} aria-label="Buka atau ciutkan sidebar">☰</button></div>
        <nav>{navItems.map(([icon, label, href, itemView]) => <Link key={href} href={href} title={label} className={view === itemView ? "active" : ""} aria-current={view === itemView ? "page" : undefined}><span>{icon}</span><b>{label}</b></Link>)}</nav>
        <label className="owner-autohide"><input type="checkbox" checked={autoHide} onChange={(event) => setAutoHide(event.target.checked)} /><span>Auto-hide</span></label>
      </aside>

      <div className="owner-content">
        <header className="owner-topbar">
          <div className="owner-brand"><img src={profile.logo_url || "/logo.svg?v=2"} alt={profile.logo_url ? `Logo ${profile.nama}` : "OKESIH"}/><div><strong>{profile.nama}</strong><small>PORTAL OWNER BISNIS</small></div><span className="owner-status">● {profile.is_active ? "Buka & Beroperasi" : "Tidak Aktif"}</span></div>
          <div className="owner-actions"><ThemeToggle/><PwaInstallButton label="Install Owner" compact onInstalled={() => void onboardingAction({ action: "pwa_installed" })}/><Link href="/pos" className="btn-secondary">Layar Kasir</Link><Link href="/kds" className="btn-secondary">Layar Dapur</Link><button onClick={logoutUser} className="btn-secondary owner-close-btn" title="Keluar / Tutup" aria-label="Tutup dan keluar dari akun owner" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span className="owner-logout-text">Logout</span></button></div>
        </header>

        <main className="owner-main">
          {error && <div className="owner-error">{error}<button onClick={() => setError("")}>×</button></div>}
          {view === "overview" && <section id="ringkasan">
            <div className="owner-section-heading"><div><h1>Ringkasan Penjualan Hari Ini</h1><p>Pantau omzet tunai vs QRIS, kas di laci kasir, dan pembayaran sewa OKESIH.</p></div></div>
            <div className="owner-metrics">
              <article className="metric-revenue"><span className="metric-icon">↗</span><small>TOTAL OMZET PENJUALAN</small><strong>{money(metrics.total)}</strong><p>{metrics.receiptCount} transaksi hari ini</p></article>
              <article className="metric-payment"><span className="metric-icon">◈</span><small>RINCIAN PEMBAYARAN</small><b>Tunai <em>{money(metrics.cash)}</em></b><b>QRIS <em>{money(metrics.qris)}</em></b></article>
              <article className="metric-cash"><span className="metric-icon">▤</span><small>UANG FISIK DI LACI KASIR</small><strong className="green">{money(metrics.cash)}</strong><p>Nilai berdasarkan pembayaran tunai</p></article>
              <article className="metric-billing"><span className="metric-icon">◎</span><small>SEWA SAAS OKESIH</small><strong className="yellow">{money(Number(metrics.billing?.total_tagihan || 0))}</strong><p>{metrics.billing?.status_bayar || "Belum ditagihkan"}</p></article>
            </div>
            <section className={`owner-revenue-chart ${revenueLoading ? "is-loading" : ""}`} aria-labelledby="owner-chart-title">
              <header>
                <div><span>ANALITIK PENJUALAN</span><h2 id="owner-chart-title">Grafik Omzet Penjualan</h2><p>Pergerakan omzet dari transaksi tunai dan QRIS yang sudah tercatat.</p></div>
                <div className="owner-chart-filters" aria-label="Filter periode grafik omzet">
                  {(["day", "week", "month", "year"] as RevenuePeriod[]).map((period) => <button key={period} className={revenuePeriod === period ? "active" : ""} onClick={() => setRevenuePeriod(period)}>{({ day: "Hari", week: "Minggu", month: "Bulan", year: "Tahun" })[period]}</button>)}
                </div>
              </header>
              <div className="owner-chart-stats">
                <div><small>Total periode</small><strong>{money(revenueData?.total || 0)}</strong></div>
                <div><small>Rata-rata</small><b>{money(revenueData?.average || 0)}</b></div>
                <div><small>Transaksi</small><b>{revenueData?.transactionCount || 0} struk</b></div>
              </div>
              <div className="owner-line-chart">
                <div className="owner-y-axis"><span>{money(revenueMaximum)}</span><span>{money(Math.round(revenueMaximum / 2))}</span><span>Rp 0</span></div>
                <div className="owner-plot">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label={`Grafik omzet periode ${revenuePeriod}`}>
                    <defs><linearGradient id="ownerRevenueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f4512c" stopOpacity="0.3"/><stop offset="100%" stopColor="#f4512c" stopOpacity="0.02"/></linearGradient></defs>
                    <line x1="0" y1="18" x2="900" y2="18" className="chart-grid-line"/><line x1="0" y1="115" x2="900" y2="115" className="chart-grid-line"/><line x1="0" y1="212" x2="900" y2="212" className="chart-grid-line"/>
                    {areaPath && <path d={areaPath} fill="url(#ownerRevenueArea)"/>}
                    {linePath && <path d={linePath} className="chart-revenue-line"/>}
                    {revenuePoints.map((point, index) => <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="5" className="chart-revenue-point"><title>{point.label}: {money(point.value)}</title></circle>)}
                  </svg>
                  <div className="owner-x-axis">{revenueSeries.map((item, index) => <span key={`${item.label}-${index}`}>{item.label}</span>)}</div>
                  {!revenueLoading && revenueData?.transactionCount === 0 && <div className="owner-chart-empty"><b>Belum ada transaksi</b><span>Grafik akan terisi otomatis ketika penjualan tercatat.</span></div>}
                </div>
              </div>
            </section>
            <div className="owner-quick-grid">
              {[
                { icon: "◫", label: "Katalog Menu", desc: "Kelola daftar menu, varian, dan harga jual warkop", href: "/owner/menu" },
                { icon: "♟", label: "Akun Staf", desc: "Kelola akun login kasir dan barista / dapur", href: "/owner/staff" },
                { icon: "♙", label: "Waiter", desc: "Kelola daftar pelayan sesuai kondisi nyata usaha", href: "/owner/waiters" },
                { icon: "▣", label: "QRIS & Meja", desc: "Atur QRIS statis dan cetak stiker QR meja", href: "/owner/qris-tables" },
                { icon: "⌁", label: "Perangkat & PWA", desc: "Pairing perangkat POS, KDS, dan status aplikasi", href: "/owner/devices" },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <span>{item.icon}</span>
                  <div>
                    <b>{item.label}</b>
                    <small>{item.desc}</small>
                  </div>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="owner-quick-arrow" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                </Link>
              ))}
            </div>
          </section>}

          {view === "menu" && <section id="menu" className="owner-panel owner-page-panel owner-menu-catalog-page">
            <div className="owner-section-heading owner-menu-heading">
              <div className="owner-menu-heading-title">
                <h2>Katalog Menu</h2>
              </div>
              <div className="owner-menu-actions">
                <Link
                  href={`/menu/${profile.slug}${data.tables[0] ? `?tableId=${encodeURIComponent(data.tables[0].id)}` : ""}`}
                  target="_blank"
                  className="owner-menu-btn owner-menu-btn-preview"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>
                    Preview Menu
                    <small>Pelanggan</small>
                  </span>
                </Link>
                <button
                  type="button"
                  className="owner-menu-btn owner-menu-btn-add"
                  onClick={() => setMenuModal(true)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>
                    Tambah
                    <small>Menu Baru</small>
                  </span>
                </button>
              </div>
            </div>

            {/* Desktop / Tablet Table View */}
            <div className="owner-table-wrap owner-menu-desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kategori</th>
                    <th>Harga</th>
                    <th>Deskripsi</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.menus.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon="◫" title="Katalog masih kosong" text="Tambahkan menu pertama agar langsung tampil di kasir dan menu pelanggan." />
                      </td>
                    </tr>
                  )}
                  {data.menus.map((menu) => (
                    <tr key={menu.id}>
                      <td><b>{menu.name}</b></td>
                      <td><span className="owner-category">{menu.category}</span></td>
                      <td><strong>{money(menu.price)}</strong></td>
                      <td>{menu.description}</td>
                      <td>
                        <button
                          className={menu.isAvailable ? "pill active" : "pill"}
                          disabled={busy}
                          onClick={() => void mutate(() => ownerFetch("/api/owner/menus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menu.id, isAvailable: !menu.isAvailable }) }))}
                        >
                          {menu.isAvailable ? "● Tersedia" : "○ Habis"}
                        </button>
                      </td>
                      <td>
                        <button
                          className="link-button"
                          onClick={() => setEditingMenu({
                            id: menu.id,
                            name: menu.name,
                            price: String(menu.price),
                            category: menu.category,
                            description: menu.description === "-" ? "" : menu.description,
                            isAvailable: menu.isAvailable,
                          })}
                        >
                          Edit
                        </button>
                        <button className="link-button danger" onClick={() => confirm(`Hapus ${menu.name}?`) && void mutate(() => ownerFetch(`/api/owner/menus?id=${menu.id}`, { method: "DELETE" }))}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile PWA Card List View */}
            <div className="owner-menu-mobile-list">
              {data.menus.length === 0 && (
                <EmptyState icon="◫" title="Katalog masih kosong" text="Tambahkan menu pertama agar langsung tampil di kasir dan menu pelanggan." />
              )}
              {data.menus.map((menu) => (
                <article key={menu.id} className={`owner-menu-card ${menu.isAvailable ? "is-available" : "is-out"}`}>
                  <div className="owner-menu-card-head">
                    <div className="owner-menu-card-title">
                      <b>{menu.name}</b>
                      <span className="owner-category">{menu.category}</span>
                    </div>
                    <strong className="owner-menu-card-price">{money(menu.price)}</strong>
                  </div>
                  {menu.description && (
                    <p className="owner-menu-card-desc">{menu.description}</p>
                  )}
                  <div className="owner-menu-card-footer">
                    <button
                      type="button"
                      className={`pill ${menu.isAvailable ? "active" : ""}`}
                      disabled={busy}
                      onClick={() => void mutate(() => ownerFetch("/api/owner/menus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menu.id, isAvailable: !menu.isAvailable }) }))}
                    >
                      {menu.isAvailable ? "● Tersedia" : "○ Habis"}
                    </button>
                    <div className="owner-menu-card-actions">
                      <button
                        type="button"
                        className="owner-menu-btn-edit"
                        onClick={() => setEditingMenu({
                          id: menu.id,
                          name: menu.name,
                          price: String(menu.price),
                          category: menu.category,
                          description: menu.description === "-" ? "" : menu.description,
                          isAvailable: menu.isAvailable,
                        })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="owner-menu-btn-delete"
                        onClick={() => confirm(`Hapus ${menu.name}?`) && void mutate(() => ownerFetch(`/api/owner/menus?id=${menu.id}`, { method: "DELETE" }))}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>}

          {view === "staff" && <section id="staf" className="owner-panel owner-page-panel">
            <div className="owner-section-heading"><div><h2>Manajemen Akun Staf (Kasir &amp; Barista, dll.)</h2><p>Akun login staf tersimpan dan terisolasi untuk usaha ini.</p></div><button className="btn-primary" onClick={() => setStaffModal(true)}>+ Tambah Staf</button></div>
            <div className="owner-table-wrap"><table><thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data.staff.length === 0 && <tr><td colSpan={5}><EmptyState icon="♟" title="Belum ada akun staf" text="Buat akun kasir atau barista agar akses operasional terpisah dan aman." /></td></tr>}{data.staff.map((staff) => <tr key={staff.id}><td><b>{staff.username}</b></td><td>{staff.name}</td><td><span className="owner-category">{staff.role}</span></td><td><span className={staff.status === "ACTIVE" ? "owner-dot active" : "owner-dot"}>{staff.status === "ACTIVE" ? "● Aktif" : "○ Nonaktif"}</span></td><td><button className="link-button" onClick={() => { const password = prompt(`Password baru untuk ${staff.username} (minimal 6 karakter)`); if (password) void mutate(() => ownerFetch("/api/owner/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: staff.id, password }) })); }}>Reset Password</button><button className="link-button" onClick={() => void mutate(() => ownerFetch("/api/owner/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: staff.id, isActive: staff.status !== "ACTIVE" }) }))}>{staff.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}</button></td></tr>)}</tbody></table></div>
          </section>}

          {view === "waiters" && <section id="waiter" className="owner-panel owner-page-panel">
            <div className="owner-section-heading"><div><h2>Daftar Waiter</h2><p>Kelola pelayan sesuai kondisi nyata usaha.</p></div><button className="btn-primary" onClick={() => setWaiterModal(true)}>+ Tambah Waiter</button></div>
            <div className="owner-card-grid">{data.waiters.length === 0 && <EmptyState icon="♙" title="Daftar waiter masih kosong" text="Tambahkan waiter sesuai kondisi aktual usaha Anda." />}{data.waiters.map((waiter) => <article key={waiter.id} className="owner-small-card"><span className="owner-avatar">{waiter.name.slice(0, 1).toUpperCase()}</span><b>{waiter.name}</b><span>{waiter.phone || "Tanpa nomor telepon"}</span><button className="link-button danger" onClick={() => confirm(`Hapus ${waiter.name}?`) && void mutate(() => ownerFetch(`/api/owner/waiters?id=${waiter.id}`, { method: "DELETE" }))}>Hapus</button></article>)}</div>
          </section>}

          {view === "qris-tables" && <section id="qris" className="owner-settings-grid owner-page-panel">
            <article className="owner-panel owner-branding-panel">
              <h2>Identitas &amp; Logo Usaha</h2><p>Logo aktif otomatis tampil pada menu pelanggan, layar Kasir, dan layar Dapur. Jika belum diunggah, sistem menggunakan logo OKESIH.</p>
              <div className="owner-logo-preview"><img src={profile.logo_url || "/logo.svg?v=2"} alt={profile.logo_url ? `Logo ${profile.nama}` : "Logo OKESIH"}/></div>
              <input ref={logoInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadLogo(event.target.files?.[0])}/>
              <div className="owner-branding-actions"><button disabled={busy} className="btn-primary" onClick={() => logoInput.current?.click()}>{busy ? "Menyimpan..." : profile.logo_url ? "Ganti Logo Usaha" : "Upload Logo Usaha"}</button>{profile.logo_url && <button disabled={busy} className="btn-secondary" onClick={() => confirm("Hapus logo usaha dan gunakan logo OKESIH?") && void mutate(() => ownerFetch("/api/owner/branding", { method: "DELETE" }))}>Gunakan Logo OKESIH</button>}</div>
              <small>PNG, JPG, atau WebP · Maksimal 2 MB · Disarankan rasio 1:1.</small>
            </article>

            <article className="owner-panel">
              <h2>QRIS Statis Toko</h2><p>Satu gambar aktif per tenant. Gambar baru otomatis menggantikan gambar lama tanpa duplikasi.</p>
              {profile.qris_image_url ? <img className="owner-qris-preview" src={profile.qris_image_url} alt={`QRIS ${profile.nama}`}/> : <div className="owner-qris-placeholder">Belum ada QRIS</div>}
              <label>Nama Merchant<input value={merchantName} onChange={(event) => setMerchantName(event.target.value)} /></label>
              <input ref={qrisInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadQris(event.target.files?.[0])}/>
              <button disabled={busy || !merchantName.trim()} className="btn-primary" onClick={() => qrisInput.current?.click()}>{busy ? "Menyimpan..." : "Upload / Ganti QRIS"}</button>
            </article>

            <article className="owner-panel">
              <h2>Cetak Stiker QR Code Meja Warkop</h2><p>Masukkan nomor atau nama meja sesuai kondisi nyata, dipisahkan koma atau baris baru.</p>
              <div className="owner-table-input"><textarea value={tableInput} onChange={(event) => setTableInput(event.target.value)} placeholder="Contoh: 01, 02, Teras 1, VIP"/><button disabled={busy || !tableInput.trim()} className="btn-primary" onClick={addTables}>Tambah Meja</button></div>
              <div className="owner-table-chips">{data.tables.map((table) => <span key={table.id}><Link target="_blank" href={`/menu/${profile.slug}?tableId=${encodeURIComponent(table.id)}`}>Meja {table.label}</Link><button aria-label={`Hapus meja ${table.label}`} onClick={() => confirm(`Hapus meja ${table.label}?`) && void mutate(() => ownerFetch(`/api/owner/tables?id=${table.id}`, { method: "DELETE" }))}>×</button></span>)}</div>
              <button className="btn-primary" disabled={!data.tables.length} onClick={() => void printTableStickers()}>🖨️ Cetak Semua Stiker QR Meja</button>
            </article>
          </section>}

          {view === "devices" && <section className="owner-device-page owner-page-panel">
            <div className="owner-section-heading"><div><h1>Perangkat &amp; PWA</h1><p>Pasangkan tablet Kasir dan layar Dapur tanpa membagikan password Owner.</p></div><PwaInstallButton label="Install Aplikasi Owner" onInstalled={() => void onboardingAction({ action: "pwa_installed" })}/></div>
            <div className="owner-device-setup">
              <article className="owner-panel"><span className="device-step">01</span><h2>Buka aplikasi di perangkat tujuan</h2><p>Pada tablet Kasir buka <b>okesih.com/pos</b>. Pada layar dapur buka <b>okesih.com/kds</b>, kemudian pilih Buat Kode Pairing.</p><div className="owner-device-links"><Link href="/pos" target="_blank">Buka Kasir ↗</Link><Link href="/kds" target="_blank">Buka KDS ↗</Link></div></article>
              <article className="owner-panel"><span className="device-step">02</span><h2>Setujui kode pairing</h2><p>Masukkan enam digit yang tampil pada perangkat. Kode hanya berlaku lima menit dan sekali pakai.</p><div className="owner-pair-form"><input inputMode="numeric" maxLength={6} placeholder="000000" value={pairingCode} onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, ""))}/><button className="btn-primary" disabled={busy || pairingCode.length !== 6} onClick={() => void deviceAction({ action: "approve", code: pairingCode })}>{busy ? "Memproses..." : "Setujui Perangkat"}</button></div></article>
            </div>
            <article className="owner-panel owner-device-list"><div className="owner-section-heading"><div><h2>Perangkat Terdaftar</h2><p>Cabut akses segera jika perangkat hilang atau tidak lagi digunakan.</p></div>{devices.some((device) => device.status === "ACTIVE") && <button className="link-button danger" onClick={() => confirm("Cabut seluruh perangkat Kasir dan KDS?") && void deviceAction({ action: "revoke_all" })}>Cabut Semua</button>}</div>
              {devices.length === 0 ? <EmptyState icon="⌁" title="Belum ada perangkat" text="Buka Kasir atau KDS pada perangkat tujuan untuk memulai pairing."/> : <div className="owner-device-grid">{devices.map((device) => <div key={device.id} className={`owner-device-card ${device.status.toLowerCase()}`}><span>{device.device_type === "POS" ? "▤" : "♨"}</span><div><small>{device.device_type === "POS" ? "KASIR / POS" : "DAPUR / KDS"}</small><b>{device.device_name}</b><p>Terakhir aktif {new Date(device.last_seen_at).toLocaleString("id-ID")}</p><em>{device.status === "ACTIVE" ? "● Aktif" : device.status === "REVOKED" ? "○ Dicabut" : "○ Kedaluwarsa"}</em></div>{device.status === "ACTIVE" && <button className="link-button danger" onClick={() => confirm(`Cabut akses ${device.device_name}?`) && void deviceAction({ action: "revoke", deviceId: device.id })}>Cabut</button>}</div>)}</div>}
            </article>
          </section>}
        </main>
      </div>

      {onboardingReady && onboarding && !onboarding.completed_at && <div className="owner-onboarding-backdrop"><section className="owner-onboarding-card"><img src="/logo.svg?v=2" alt="OKESIH"/><small>SELAMAT DATANG DI OKESIH</small><h2>Siapkan akun Owner Anda</h2>{!onboarding.password_changed_at ? <><p>Demi keamanan, ganti password awal yang diberikan Super Admin sebelum menggunakan dashboard.</p><label>Password baru<input type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Minimal 8 karakter"/></label><button className="btn-primary" disabled={busy || newPassword.length < 8} onClick={() => void onboardingAction({ action: "change_password", password: newPassword })}>{busy ? "Menyimpan..." : "Ganti Password & Lanjut"}</button></> : <><p>Pasang Dashboard Owner agar OKESIH dapat dibuka langsung dari layar utama. Browser tetap akan meminta persetujuan Anda.</p><PwaInstallButton label="Install OKESIH Owner" onInstalled={() => void onboardingAction({ action: "pwa_installed" })}/><button className="btn-secondary" disabled={busy} onClick={() => void onboardingAction({ action: "complete" })}>Lanjut ke Dashboard</button></>}{error && <div className="owner-error">{error}</div>}</section></div>}

      {menuModal && <Modal title="Tambah Menu" onClose={() => setMenuModal(false)}><form onSubmit={createMenu}><input required placeholder="Nama menu" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}/><input required min="1" type="number" placeholder="Harga" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}/><label className="owner-category-field">Kategori<input required list="owner-menu-categories" maxLength={50} placeholder="Pilih atau ketik kategori baru" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}/><small>Pilih kategori yang ada atau ketik kategori baru.</small></label><datalist id="owner-menu-categories">{categorySuggestions.map((item) => <option key={item} value={item}/>)}</datalist><textarea placeholder="Deskripsi" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}/><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setMenuModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">Oke</button></div></form></Modal>}
      {editingMenu && <Modal title="Edit Menu" onClose={() => setEditingMenu(null)}><form onSubmit={updateMenu}><label className="owner-category-field">Nama Menu<input required placeholder="Nama menu" value={editingMenu.name} onChange={(e) => setEditingMenu({ ...editingMenu, name: e.target.value })}/></label><label className="owner-category-field">Harga (Rp)<input required min="1" type="number" placeholder="Harga" value={editingMenu.price} onChange={(e) => setEditingMenu({ ...editingMenu, price: e.target.value })}/></label><label className="owner-category-field">Kategori<input required list="owner-menu-categories-edit" maxLength={50} placeholder="Pilih atau ketik kategori baru" value={editingMenu.category} onChange={(e) => setEditingMenu({ ...editingMenu, category: e.target.value })}/><small>Pilih kategori yang ada atau ketik kategori baru.</small></label><datalist id="owner-menu-categories-edit">{categorySuggestions.map((item) => <option key={item} value={item}/>)}</datalist><label className="owner-category-field">Deskripsi<textarea placeholder="Deskripsi menu" value={editingMenu.description} onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}/></label><label className="owner-category-field" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "4px" }}><input type="checkbox" checked={editingMenu.isAvailable} onChange={(e) => setEditingMenu({ ...editingMenu, isAvailable: e.target.checked })} style={{ width: "20px", height: "20px", margin: 0 }}/><span>Status Menu Tersedia untuk Dipesan</span></label><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setEditingMenu(null)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">{busy ? "Menyimpan..." : "Oke"}</button></div></form></Modal>}
      {staffModal && <Modal title="Tambah Akun Staf" onClose={() => setStaffModal(false)}><form onSubmit={createStaff}><input required placeholder="Username" value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}/><input required placeholder="Nama staf" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}/><input required minLength={6} type="password" placeholder="Password minimal 6 karakter" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}/><select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}><option value="KASIR">Kasir POS</option><option value="DAPUR">Barista / Dapur</option></select><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setStaffModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">Oke</button></div></form></Modal>}
      {waiterModal && <Modal title="Tambah Waiter" onClose={() => setWaiterModal(false)}><form onSubmit={createWaiter}><input required placeholder="Nama waiter" value={waiterForm.name} onChange={(e) => setWaiterForm({ ...waiterForm, name: e.target.value })}/><input inputMode="tel" placeholder="Nomor telepon" value={waiterForm.phone} onChange={(e) => setWaiterForm({ ...waiterForm, phone: e.target.value })}/><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setWaiterModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">Oke</button></div></form></Modal>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="owner-modal-backdrop"><div className="owner-modal"><header><h3>{title}</h3><button onClick={onClose}>×</button></header>{children}</div></div>;
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="owner-empty"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div>;
}
