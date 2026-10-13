"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useAuthGuard, logoutUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/ThemeToggle";

type MenuItem = { id: string; name: string; price: number; category: string; description: string; isAvailable: boolean };
type Staff = { id: string; username: string; name: string; role: "KASIR" | "DAPUR"; status: "ACTIVE" | "INACTIVE" };
type Waiter = { id: string; name: string; phone: string | null; is_active: boolean };
type BusinessTable = { id: string; label: string; sort_order: number; is_active: boolean };
type Profile = { id: string; nama: string; slug: string; is_active: boolean; qris_image_url: string | null; qris_merchant_name: string | null };
type Metrics = { receiptCount: number; cash: number; qris: number; total: number; billing: { tagihan_pokok: number; kode_unik: number; total_tagihan: number; status_bayar: string } | null };
type DashboardData = { profile: Profile; menus: MenuItem[]; staff: Staff[]; waiters: Waiter[]; tables: BusinessTable[]; metrics: Metrics };

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
  const { isAuthorized, loading } = useAuthGuard(["OWNER"]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [autoHide, setAutoHide] = useState(true);
  const [menuModal, setMenuModal] = useState(false);
  const [staffModal, setStaffModal] = useState(false);
  const [waiterModal, setWaiterModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: "", price: "", category: "Kopi", description: "" });
  const [staffForm, setStaffForm] = useState({ username: "", name: "", password: "", role: "KASIR" });
  const [waiterForm, setWaiterForm] = useState({ name: "", phone: "" });
  const [tableInput, setTableInput] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const qrisInput = useRef<HTMLInputElement>(null);

  const loadDashboard = async () => {
    try {
      setError("");
      const payload = await ownerFetch("/api/owner/dashboard", { cache: "no-store" });
      setData(payload.data);
      setMerchantName(payload.data.profile.qris_merchant_name || payload.data.profile.nama);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard gagal dimuat.");
    }
  };

  useEffect(() => {
    // Initial remote synchronization after the auth guard resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthorized) void loadDashboard();
  }, [isAuthorized]);

  useEffect(() => {
    if (pathname !== "/owner") return;
    const legacyRoutes: Record<string, string> = { "#menu": "/owner/menu", "#staf": "/owner/staff", "#waiter": "/owner/waiters", "#qris": "/owner/qris-tables" };
    const destination = legacyRoutes[window.location.hash];
    if (destination) router.replace(destination);
  }, [pathname, router]);

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

  const printTableStickers = async () => {
    if (!data?.tables.length) return setError("Tambahkan meja terlebih dahulu.");
    const cards = await Promise.all(data.tables.map(async (table) => {
      const url = `${window.location.origin}/menu/${data.profile.slug}?table=${encodeURIComponent(table.label)}`;
      return { table, url, qr: await QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: "H" }) };
    }));
    const popup = window.open("", "_blank");
    if (!popup) return setError("Izinkan pop-up browser untuk mencetak stiker meja.");
    popup.document.write(`<!doctype html><html><head><title>Stiker Meja ${escapeHtml(data.profile.nama)}</title><style>body{font-family:Arial;margin:24px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.card{border:2px solid #111;border-radius:16px;padding:18px;text-align:center;break-inside:avoid}.card img{width:190px;height:190px}.name{font-size:18px;font-weight:800}.table{font-size:26px;font-weight:900;margin:8px}.url{font-size:10px;word-break:break-all}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Cetak</button><div class="grid">${cards.map(({ table, url, qr }) => `<div class="card"><div class="name">${escapeHtml(data.profile.nama)}</div><div class="table">Meja ${escapeHtml(table.label)}</div><img src="${qr}" alt="QR Meja ${escapeHtml(table.label)}"/><div>Scan untuk melihat menu & memesan</div><div class="url">${escapeHtml(url)}</div></div>`).join("")}</div><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  if (loading || !isAuthorized || !data) return <div className="owner-loading"><span>☕</span><strong>{error || "Memuat data usaha owner..."}</strong></div>;

  const { profile, metrics } = data;
  const view = pathname.endsWith("/menu") ? "menu" : pathname.endsWith("/staff") ? "staff" : pathname.endsWith("/waiters") ? "waiters" : pathname.endsWith("/qris-tables") ? "qris-tables" : "overview";
  const navItems = [["▦", "Ringkasan", "/owner", "overview"], ["◫", "Katalog Menu", "/owner/menu", "menu"], ["♟", "Akun Staf", "/owner/staff", "staff"], ["♙", "Waiter", "/owner/waiters", "waiters"], ["▣", "QRIS & Meja", "/owner/qris-tables", "qris-tables"]];

  return (
    <div className={`owner-shell ${sidebarExpanded ? "sidebar-open" : "sidebar-closed"}`}>
      <aside className="owner-sidebar" onMouseEnter={() => autoHide && setSidebarExpanded(true)} onMouseLeave={() => autoHide && setSidebarExpanded(false)}>
        <div className="owner-sidebar-head"><span className="owner-sidebar-mark">O</span><b>OWNER SPACE</b><button className="owner-sidebar-toggle" onClick={() => setSidebarExpanded((value) => !value)} aria-label="Buka atau ciutkan sidebar">☰</button></div>
        <nav>{navItems.map(([icon, label, href, itemView]) => <Link key={href} href={href} title={label} className={view === itemView ? "active" : ""} aria-current={view === itemView ? "page" : undefined}><span>{icon}</span><b>{label}</b></Link>)}</nav>
        <label className="owner-autohide"><input type="checkbox" checked={autoHide} onChange={(event) => setAutoHide(event.target.checked)} /><span>Auto-hide</span></label>
      </aside>

      <div className="owner-content">
        <header className="owner-topbar">
          <div className="owner-brand"><img src="/logo.svg?v=2" alt="OKESIH"/><div><strong>{profile.nama}</strong><small>PORTAL OWNER BISNIS</small></div><span className="owner-status">● {profile.is_active ? "Buka & Beroperasi" : "Tidak Aktif"}</span></div>
          <div className="owner-actions"><ThemeToggle/><Link href="/pos" className="btn-secondary">Layar Kasir</Link><Link href="/kds" className="btn-secondary">Layar Dapur</Link><button onClick={logoutUser} className="btn-secondary">Logout</button></div>
        </header>

        <main className="owner-main">
          {error && <div className="owner-error">{error}<button onClick={() => setError("")}>×</button></div>}
          {view === "overview" && <section id="ringkasan">
            <div className="owner-section-heading"><div><h1>Ringkasan Penjualan Hari Ini</h1><p>Pantau omzet tunai vs QRIS, kas di laci kasir, dan pembayaran sewa OKESIH.</p></div><Link href={`/menu/${profile.slug}?table=${encodeURIComponent(data.tables[0]?.label || "01")}`} target="_blank" className="btn-primary">Preview Menu Pelanggan</Link></div>
            <div className="owner-metrics">
              <article className="metric-revenue"><span className="metric-icon">↗</span><small>TOTAL OMZET PENJUALAN</small><strong>{money(metrics.total)}</strong><p>{metrics.receiptCount} transaksi hari ini</p></article>
              <article className="metric-payment"><span className="metric-icon">◈</span><small>RINCIAN PEMBAYARAN</small><b>Tunai <em>{money(metrics.cash)}</em></b><b>QRIS <em>{money(metrics.qris)}</em></b></article>
              <article className="metric-cash"><span className="metric-icon">▤</span><small>UANG FISIK DI LACI KASIR</small><strong className="green">{money(metrics.cash)}</strong><p>Nilai berdasarkan pembayaran tunai</p></article>
              <article className="metric-billing"><span className="metric-icon">◎</span><small>SEWA SAAS OKESIH</small><strong className="yellow">{money(Number(metrics.billing?.total_tagihan || 0))}</strong><p>{metrics.billing?.status_bayar || "Belum ditagihkan"}</p></article>
            </div>
            <div className="owner-quick-grid">
              {navItems.slice(1).map(([icon, label, href]) => <Link key={href} href={href}><span>{icon}</span><div><b>{label}</b><small>Buka halaman pengelolaan</small></div><em>→</em></Link>)}
            </div>
          </section>}

          {view === "menu" && <section id="menu" className="owner-panel owner-page-panel">
            <div className="owner-section-heading"><div><h2>Katalog Menu</h2><p>Tersinkronisasi ke menu pelanggan dan kasir.</p></div><button className="btn-primary" onClick={() => setMenuModal(true)}>+ Tambah Menu</button></div>
            <div className="owner-table-wrap"><table><thead><tr><th>Nama</th><th>Kategori</th><th>Harga</th><th>Deskripsi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data.menus.length === 0 && <tr><td colSpan={6}><EmptyState icon="◫" title="Katalog masih kosong" text="Tambahkan menu pertama agar langsung tampil di kasir dan menu pelanggan." /></td></tr>}{data.menus.map((menu) => <tr key={menu.id}><td><b>{menu.name}</b></td><td><span className="owner-category">{menu.category}</span></td><td><strong>{money(menu.price)}</strong></td><td>{menu.description}</td><td><button className={menu.isAvailable ? "pill active" : "pill"} disabled={busy} onClick={() => void mutate(() => ownerFetch("/api/owner/menus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menu.id, isAvailable: !menu.isAvailable }) }))}>{menu.isAvailable ? "● Tersedia" : "○ Habis"}</button></td><td><button className="link-button" onClick={() => { const value = prompt("Harga baru", String(menu.price)); if (value && Number(value) > 0) void mutate(() => ownerFetch("/api/owner/menus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menu.id, price: Number(value) }) })); }}>Ubah Harga</button><button className="link-button danger" onClick={() => confirm(`Hapus ${menu.name}?`) && void mutate(() => ownerFetch(`/api/owner/menus?id=${menu.id}`, { method: "DELETE" }))}>Hapus</button></td></tr>)}</tbody></table></div>
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
              <div className="owner-table-chips">{data.tables.map((table) => <span key={table.id}><Link target="_blank" href={`/menu/${profile.slug}?table=${encodeURIComponent(table.label)}`}>Meja {table.label}</Link><button aria-label={`Hapus meja ${table.label}`} onClick={() => confirm(`Hapus meja ${table.label}?`) && void mutate(() => ownerFetch(`/api/owner/tables?id=${table.id}`, { method: "DELETE" }))}>×</button></span>)}</div>
              <button className="btn-primary" disabled={!data.tables.length} onClick={() => void printTableStickers()}>🖨️ Cetak Semua Stiker QR Meja</button>
            </article>
          </section>}
        </main>
      </div>

      {menuModal && <Modal title="Tambah Menu" onClose={() => setMenuModal(false)}><form onSubmit={createMenu}><input required placeholder="Nama menu" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}/><input required min="1" type="number" placeholder="Harga" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}/><select value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}>{["Kopi", "Dingin", "Makanan", "Camilan", "Lainnya"].map((item) => <option key={item}>{item}</option>)}</select><textarea placeholder="Deskripsi" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}/><button disabled={busy} className="btn-primary">Simpan Menu</button></form></Modal>}
      {staffModal && <Modal title="Tambah Akun Staf" onClose={() => setStaffModal(false)}><form onSubmit={createStaff}><input required placeholder="Username" value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}/><input required placeholder="Nama staf" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}/><input required minLength={6} type="password" placeholder="Password minimal 6 karakter" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}/><select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}><option value="KASIR">Kasir POS</option><option value="DAPUR">Barista / Dapur</option></select><button disabled={busy} className="btn-primary">Buat Akun Staf</button></form></Modal>}
      {waiterModal && <Modal title="Tambah Waiter" onClose={() => setWaiterModal(false)}><form onSubmit={createWaiter}><input required placeholder="Nama waiter" value={waiterForm.name} onChange={(e) => setWaiterForm({ ...waiterForm, name: e.target.value })}/><input inputMode="tel" placeholder="Nomor telepon" value={waiterForm.phone} onChange={(e) => setWaiterForm({ ...waiterForm, phone: e.target.value })}/><button disabled={busy} className="btn-primary">Simpan Waiter</button></form></Modal>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="owner-modal-backdrop"><div className="owner-modal"><header><h3>{title}</h3><button onClick={onClose}>×</button></header>{children}</div></div>;
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="owner-empty"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div>;
}
