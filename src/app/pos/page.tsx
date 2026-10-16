"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import DevicePairing from "@/components/DevicePairing";
import CashierShiftGate, { useCashierShift } from "@/components/CashierShiftGate";
import DevicePwaModal from "@/components/DevicePwaModal";
import { requestPwaInstallation } from "@/lib/pwa-install";
import { usePwaInstallStatus } from "@/lib/use-pwa-install-status";
import { type DeviceOrder, useDeviceApp } from "@/lib/use-device-app";

type CartLine = { qty: number; notes: string };
type View = "orders" | "sale";

function CashierShiftBadge() {
  const shift = useCashierShift();
  if (!shift?.cashierName) return null;
  return (
    <button
      type="button"
      className="pos-cashier-badge"
      onClick={shift.openEndShiftModal}
      title={`Shift kasir aktif: ${shift.cashierName} · Klik untuk mengakhiri shift`}
    >
      <span className="pos-cashier-dot" aria-hidden="true">●</span>
      <span className="pos-cashier-name">{shift.cashierName}</span>
      <b className="pos-cashier-action">Akhiri Shift</b>
    </button>
  );
}

function playCashierChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [{ freq: 880, time: 0, dur: 0.16 }, { freq: 1174, time: 0.13, dur: 0.2 }, { freq: 1760, time: 0.27, dur: 0.45 }].forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + time);
    gain.gain.setValueAtTime(0.85, now + time);
    gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now + time); osc.stop(now + time + dur);
  });
}

function playCashierSound(ctx?: AudioContext | null) {
  try {
    const sound = new Audio("/sound/cash-register.mp3");
    sound.volume = 1;
    void sound.play().catch(() => { if (ctx) playCashierChime(ctx); });
  } catch { if (ctx) playCashierChime(ctx); }
}

function Icon({ name }: { name: "orders" | "cart" | "search" | "refresh" | "bell" | "install" | "plus" | "minus" | "close" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    orders: <><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    cart: <><path d="M3 4h2l2.2 10h9.8l2-7H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    install: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, minus: <path d="M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function PosModulePage() {
  const app = useDeviceApp("POS");
  const pwaInstalled = usePwaInstallStatus("/pos/manifest.webmanifest");
  const [view, setView] = useState<View>("orders");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [selected, setSelected] = useState<DeviceOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [tableNumber, setTableNumber] = useState("Kasir");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [saleMessage, setSaleMessage] = useState("");
  const audio = useRef<AudioContext | null>(null);
  const pending = app.data?.orders.filter((order) => order.status_pesanan === "AWAITING_CONFIRMATION") || [];

  const getAudioContext = () => {
    if (!audio.current && typeof window !== "undefined") {
      const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Audio) audio.current = new Audio();
    }
    if (audio.current?.state === "suspended") void audio.current.resume();
    return audio.current;
  };

  useEffect(() => {
    const unlock = () => { const ctx = getAudioContext(); if (ctx) { setAudioUnlocked(true); if (ctx.state === "suspended") void ctx.resume(); } };
    window.addEventListener("pointerdown", unlock, { passive: true }); window.addEventListener("keydown", unlock, { passive: true });
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  const prevPendingIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!app.data) return;
    const currentIds = new Set(pending.map((order) => order.id));
    if (prevPendingIds.current === null) { prevPendingIds.current = currentIds; return; }
    const hasNewOrder = pending.some((order) => !prevPendingIds.current!.has(order.id));
    prevPendingIds.current = currentIds;
    if (hasNewOrder && audioEnabled) { const ctx = getAudioContext(); if (ctx?.state === "suspended") void ctx.resume().then(() => playCashierSound(ctx)); else playCashierSound(ctx); }
  }, [app.data, audioEnabled, pending]);

  const categories = useMemo(() => ["Semua", ...Array.from(new Set((app.data?.menus || []).filter((menu) => menu.is_available).map((menu) => menu.kategori || "Lainnya")))], [app.data?.menus]);
  const visibleMenus = useMemo(() => (app.data?.menus || []).filter((menu) => menu.is_available && (category === "Semua" || (menu.kategori || "Lainnya") === category) && `${menu.nama} ${menu.desc_menu || ""}`.toLowerCase().includes(query.toLowerCase().trim())), [app.data?.menus, category, query]);
  const cartItems = useMemo(() => (app.data?.menus || []).flatMap((menu) => cart[menu.id] ? [{ menu, ...cart[menu.id] }] : []), [app.data?.menus, cart]);
  const cartCount = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.menu.harga) * item.qty, 0);

  if (app.authorized === false) return <DevicePairing type="POS" pairing={app.pairing} error={app.error} onBegin={app.beginPairing}/>;
  if (!app.data) return <div className="device-loading"><Image src="/okesih-logo-animated.svg" width={90} height={90} alt="OKESIH"/><b>{app.error || "Menyiapkan Kasir..."}</b></div>;

  const update = async (order: DeviceOrder, status: "COOKING" | "DONE" | "REJECTED") => { setBusy(true); app.setError(""); try { await app.transitionOrder(order.id, status); setSelected(null); } catch (reason) { app.setError(reason instanceof Error ? reason.message : "Pesanan gagal diperbarui."); } finally { setBusy(false); } };
  const changeQty = (menuId: string, delta: number) => setCart((current) => { const nextQty = (current[menuId]?.qty || 0) + delta; if (nextQty <= 0) { const next = { ...current }; delete next[menuId]; return next; } return { ...current, [menuId]: { qty: Math.min(nextQty, 99), notes: current[menuId]?.notes || "" } }; });
  const submitCashierOrder = async () => {
    if (!cartItems.length) return;
    setBusy(true); setSaleMessage(""); app.setError("");
    try {
      const order = await app.createCashierOrder({ tableNumber, paymentMethod, items: cartItems.map((item) => ({ menuId: item.menu.id, qty: item.qty, notes: item.notes })) });
      setCart({}); setSaleMessage(`Pesanan #${String(order.nomor_antrean).padStart(3, "0")} sudah masuk ke KDS dapur.`); window.setTimeout(() => setSaleMessage(""), 5000);
    } catch (reason) { app.setError(reason instanceof Error ? reason.message : "Pesanan kasir gagal disimpan."); } finally { setBusy(false); }
  };
  const toggleOrTestAudio = () => { const ctx = getAudioContext(); setAudioEnabled(true); setAudioUnlocked(Boolean(ctx)); if (ctx) void ctx.resume().then(() => playCashierSound(ctx)); else playCashierSound(null); };
  const cooking = app.data.orders.filter((order) => order.status_pesanan === "COOKING");
  const ready = app.data.orders.filter((order) => order.status_pesanan === "READY");

  return <CashierShiftGate key={app.data.device.id} tenant={app.data.profile.nama} pendingCount={app.pendingCount} onShiftChanged={() => app.refresh()}><div className="ops-app pos-app pos-redesign">
    <DevicePwaModal type="POS" isOpen={pwaModalOpen} onClose={() => setPwaModalOpen(false)}/>
    <header className="pos-header">
      <div className="pos-brand"><div className="pos-brand-logo">{app.data.profile.logo_url ? <img src={app.data.profile.logo_url} alt={`Logo ${app.data.profile.nama}`}/> : <Image src="/logo.svg?v=2" width={44} height={44} alt="OKESIH"/>}</div><div><small>OKESIH <span>KASIR</span></small><strong>{app.data.profile.nama}</strong></div></div>
      <nav className="pos-nav" aria-label="Menu kasir"><button className={view === "orders" ? "active" : ""} onClick={() => setView("orders")}><Icon name="orders"/>Pesanan Masuk{pending.length > 0 && <b>{pending.length}</b>}</button><button className={view === "sale" ? "active" : ""} onClick={() => setView("sale")}><Icon name="cart"/>Pesanan Langsung{cartCount > 0 && <b>{cartCount}</b>}</button></nav>
      <div className="pos-header-actions">
        <span className={app.online ? "pos-connection online" : "pos-connection offline"}><i/> {app.online ? "Online" : "Offline"}</span>
        {pwaInstalled === false && <button className="pos-icon-button pos-install-button" title="Pasang aplikasi kasir" onClick={async () => { if (window.__okesihInstallPrompt) { const result = await requestPwaInstallation("POS"); if (result === "unavailable") setPwaModalOpen(true); } else setPwaModalOpen(true); }}><Icon name="install"/><span>Pasang Aplikasi</span></button>}
        <button className="pos-icon-button" onClick={toggleOrTestAudio} title="Tes bel kasir"><Icon name="bell"/><span>{audioEnabled && audioUnlocked ? "Bel Aktif" : "Aktifkan Bel"}</span></button>
        <button className="pos-device-chip" title={app.data.device.name}><span>POS</span><b>{app.data.device.name}</b></button>
        <CashierShiftBadge />
      </div>
    </header>
    {app.cachedAt && <div className="ops-warning">Mode offline · data terakhir {new Date(app.cachedAt).toLocaleTimeString("id-ID")}. Perubahan akan disinkronkan otomatis.</div>}
    {!audioUnlocked && <button className="pos-audio-notice" onClick={toggleOrTestAudio}><Icon name="bell"/> Ketuk untuk mengaktifkan dering pesanan masuk.</button>}
    {app.error && <div className="ops-error" role="alert">{app.error}<button onClick={() => app.setError("")}>×</button></div>}
    {saleMessage && <div className="pos-toast"><span>✓</span>{saleMessage}</div>}

    {view === "orders" ? <main className="pos-orders-page">
      <section className="pos-hero-row"><div><small>RINGKASAN HARI INI</small><h1>Selamat bekerja, Kasir!</h1><p>Pantau pesanan pelanggan dan teruskan ke dapur dari satu layar.</p></div><button onClick={() => void app.refresh()}><Icon name="refresh"/> Sinkronkan</button></section>
      <section className="pos-stats"><article className="waiting"><span><Icon name="orders"/></span><div><small>PERLU KONFIRMASI</small><strong>{pending.length}</strong><p>Pesanan dari meja</p></div></article><article className="cooking"><span>♨</span><div><small>SEDANG DISIAPKAN</small><strong>{cooking.length}</strong><p>Diproses dapur</p></div></article><article className="ready"><span>✓</span><div><small>SIAP DIANTAR</small><strong>{ready.length}</strong><p>Menunggu pengantaran</p></div></article></section>
      <section className="pos-order-section"><div className="pos-section-heading"><div><span>Pesanan terbaru</span><h2>Konfirmasi Pesanan</h2></div><small>{pending.length} pesanan menunggu</small></div><div className="ops-order-grid pos-order-grid">{pending.length === 0 && <div className="pos-empty"><span>✓</span><h2>Semua pesanan sudah ditangani</h2><p>Pesanan baru dari meja akan muncul otomatis di sini.</p><button onClick={() => setView("sale")}>+ Buat Pesanan Langsung</button></div>}{pending.map((order) => <OrderCard key={order.id} order={order} onOpen={() => setSelected(order)}/>)}</div></section>
      {(cooking.length > 0 || ready.length > 0) && <section className="pos-order-section compact-section"><div className="pos-section-heading"><div><span>Proses berjalan</span><h2>Dapur &amp; Pengantaran</h2></div></div><div className="ops-order-grid pos-order-grid">{[...ready, ...cooking].map((order) => <OrderCard key={order.id} order={order} onOpen={() => setSelected(order)}/>)}</div></section>}
    </main> : <main className="pos-sale-page">
      <section className="pos-menu-panel">
        <div className="pos-menu-toolbar">
          <label className="pos-search">
            <Icon name="search"/>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari menu berdasarkan nama atau kategori..."
            />
            {query && (
              <button
                type="button"
                className="pos-search-clear"
                onClick={() => setQuery("")}
                title="Hapus pencarian"
              >
                <Icon name="close"/>
              </button>
            )}
          </label>
        </div>
        <div className="pos-categories">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="pos-menu-grid">{visibleMenus.map((menu) => { const qty = cart[menu.id]?.qty || 0; return <article key={menu.id} className={qty ? "selected" : ""}><div className="pos-menu-art"><span>{menu.kategori?.toLowerCase().includes("minum") ? "☕" : "🍽"}</span>{qty > 0 && <b>{qty}</b>}</div><div className="pos-menu-copy"><small>{menu.kategori || "Menu"}</small><h2>{menu.nama}</h2><p>{menu.desc_menu || "Siap dipesan langsung dari kasir."}</p><strong>Rp {Number(menu.harga).toLocaleString("id-ID")}</strong></div>{qty === 0 ? <button className="pos-add-menu" onClick={() => changeQty(menu.id, 1)}><Icon name="plus"/> Tambah</button> : <div className="pos-menu-qty"><button onClick={() => changeQty(menu.id, -1)}><Icon name="minus"/></button><b>{qty}</b><button onClick={() => changeQty(menu.id, 1)}><Icon name="plus"/></button></div>}</article>; })}{visibleMenus.length === 0 && <div className="pos-menu-empty">Menu tidak ditemukan.</div>}</div>
      </section>
      <aside className="pos-cart-panel"><header><div><small>PESANAN LANGSUNG</small><h2>Keranjang</h2></div><span>{cartCount} item</span></header><label className="pos-field">Lokasi pesanan<select value={tableNumber} onChange={(event) => setTableNumber(event.target.value)}><option value="Kasir">Kasir / Bawa pulang</option>{app.data.tables.map((table) => <option key={table.id} value={table.label}>Meja {table.label}</option>)}</select></label>
        <div className="pos-cart-lines">{cartItems.length === 0 ? <div className="pos-cart-empty"><span><Icon name="cart"/></span><h3>Keranjang masih kosong</h3><p>Pilih menu di sebelah kiri untuk mulai membuat pesanan.</p></div> : cartItems.map((item) => <article key={item.menu.id}><div><h3>{item.menu.nama}</h3><strong>Rp {(Number(item.menu.harga) * item.qty).toLocaleString("id-ID")}</strong></div><div className="pos-cart-line-actions"><div className="pos-menu-qty"><button onClick={() => changeQty(item.menu.id, -1)}><Icon name="minus"/></button><b>{item.qty}</b><button onClick={() => changeQty(item.menu.id, 1)}><Icon name="plus"/></button></div><button className="pos-remove" onClick={() => setCart((current) => { const next = { ...current }; delete next[item.menu.id]; return next; })}><Icon name="close"/></button></div><input value={item.notes} maxLength={300} onChange={(event) => setCart((current) => ({ ...current, [item.menu.id]: { ...current[item.menu.id], notes: event.target.value } }))} placeholder="Catatan, mis. tanpa gula"/></article>)}</div>
        <div className="pos-payment"><small>METODE PEMBAYARAN</small><div><button className={paymentMethod === "CASH" ? "active" : ""} onClick={() => setPaymentMethod("CASH")}><span>Rp</span><b>Tunai</b></button><button className={paymentMethod === "QRIS" ? "active" : ""} onClick={() => setPaymentMethod("QRIS")}><span>▦</span><b>QRIS</b></button></div></div>
        <footer><div><span>Total pembayaran</span><strong>Rp {cartTotal.toLocaleString("id-ID")}</strong></div><button disabled={!cartItems.length || busy || !app.online} onClick={() => void submitCashierOrder()}>{busy ? "Mengirim..." : <><span>Bayar & Kirim ke Dapur</span><b>→</b></>}</button>{!app.online && <small>Hubungkan internet untuk mengirim pesanan ke KDS.</small>}</footer>
      </aside>
    </main>}

    {selected && <div className="ops-modal-backdrop"><section className="ops-modal"><button className="ops-modal-close" onClick={() => setSelected(null)}>×</button><small>ANTREAN #{String(selected.nomor_antrean).padStart(3, "0")}</small><h2>{selected.table_number === "Kasir" ? "Pesanan Kasir" : `Meja ${selected.table_number}`}</h2><div className={`ops-payment ${selected.payment_method.toLowerCase()}`}>{selected.payment_method === "CASH" ? "BAYAR TUNAI" : "QRIS — VERIFIKASI BUKTI"}</div>{selected.payment_proof_url && <a className="ops-proof" href={selected.payment_proof_url} target="_blank" rel="noreferrer">Buka Bukti Pembayaran</a>}<div className="ops-items">{selected.items.map((item) => <div key={item.id}><span>{item.qty}× {item.nama_menu}{item.notes && <small>{item.notes}</small>}</span><b>Rp {(Number(item.harga_satuan) * item.qty).toLocaleString("id-ID")}</b></div>)}</div><strong className="ops-total">Total Rp {Number(selected.total_harga).toLocaleString("id-ID")}</strong>{selected.status_pesanan === "AWAITING_CONFIRMATION" ? <div className="ops-modal-actions"><button disabled={busy} className="danger" onClick={() => void update(selected, "REJECTED")}>Tolak</button><button disabled={busy} className="primary" onClick={() => void update(selected, "COOKING")}>{busy ? "Menyimpan..." : "Konfirmasi & Kirim ke Dapur"}</button></div> : selected.status_pesanan === "READY" ? <button disabled={busy} className="primary" onClick={() => void update(selected, "DONE")}>Tandai Sudah Diantar</button> : <p>Status: Sedang disiapkan dapur</p>}</section></div>}
  </div></CashierShiftGate>;
}

function OrderCard({ order, onOpen }: { order: DeviceOrder; onOpen: () => void }) {
  const location = order.table_number === "Kasir" ? "Kasir / Take away" : `Meja ${order.table_number}`;
  const status = order.status_pesanan === "AWAITING_CONFIRMATION" ? "Perlu konfirmasi" : order.status_pesanan === "READY" ? "Siap diantar" : "Sedang disiapkan";
  return <button className={`ops-order-card pos-order-card ${order.status_pesanan.toLowerCase()}`} onClick={onOpen}><header><span>#{String(order.nomor_antrean).padStart(3, "0")}</span><em>{status}</em></header><h3>{location}</h3><p>{order.items.reduce((sum, item) => sum + item.qty, 0)} item · {new Date(order.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p><footer><strong>Rp {Number(order.total_harga).toLocaleString("id-ID")}</strong><b>{order.payment_method === "CASH" ? "TUNAI" : "QRIS"}</b></footer></button>;
}
