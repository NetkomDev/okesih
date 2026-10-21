"use client";
import { DeviceSyncQueue } from "@/components/DeviceSyncQueue";
import { Icon,getOrderCashier } from "@/components/pos/helpers";

import dynamic from "next/dynamic";
const History = dynamic(() => import("@/components/pos/History"), { loading: () => <p role="status">Memuat histori...</p> });
const AuditPinModal = dynamic(() => import("@/components/pos/AuditPinModal"));

import CashierShiftGate,{ useCashierShift } from "@/components/CashierShiftGate";
import DevicePairing from "@/components/DevicePairing";
import DevicePwaModal from "@/components/DevicePwaModal";
import { requestPwaInstallation } from "@/lib/pwa-install";
import { type DeviceOrder,useDeviceApp } from "@/lib/use-device-app";
import { usePwaInstallStatus } from "@/lib/use-pwa-install-status";
import Image from "next/image";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";

type CartLine = { qty: number; notes: string };
type View = "orders" | "sale" | "history";

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

function formatElapsedTime(createdAt: string, now: number): string {
  const diffMs = Math.max(0, now - new Date(createdAt).getTime());
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Baru saja";
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours} jam lalu`;
}

export default function PosModulePage() {
  const [historyRevision, setHistoryRevision] = useState(0);
  const [view, setView] = useState<View>("orders");
  const app = useDeviceApp("POS", false);
  const pwaInstalled = usePwaInstallStatus("/pos/manifest.webmanifest");
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
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [cashError, setCashError] = useState("");
  const [cashResult, setCashResult] = useState<{ orderNumber: number; total: number; received: number; change: number } | null>(null);
  const [saleMessage, setSaleMessage] = useState("");
  
  
  
  
  
  
  

  // PIN Gate Keamanan Audit Histori
  const [historyUnlocked, setHistoryUnlocked] = useState(false);
  const [historyPin, setHistoryPin] = useState("");
  
  const [pinModalOpen, setPinModalOpen] = useState(false);
  
  
  
  

  // Pipeline Pesanan Masuk
  const [mobileTab, setMobileTab] = useState<"PENDING" | "COOKING" | "READY">("COOKING");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersNow, setOrdersNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setOrdersNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const audio = useRef<AudioContext | null>(null);
  const cashierOrderSubmitting = useRef(false);
  const shift = useCashierShift();
  const pending = useMemo(
    () => app.data?.orders.filter((order) => order.status_pesanan === "AWAITING_CONFIRMATION") || [],
    [app.data?.orders]
  );

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
  const cashAmount = Number(cashReceived || 0);
  const cashChange = Math.max(cashAmount - cartTotal, 0);
  const cashShortage = Math.max(cartTotal - cashAmount, 0);
  const cashQuickAmounts = useMemo(() => Array.from(new Set([
    cartTotal,
    Math.ceil(cartTotal / 10_000) * 10_000,
    Math.ceil(cartTotal / 20_000) * 20_000,
    Math.ceil(cartTotal / 50_000) * 50_000,
    Math.ceil(cartTotal / 100_000) * 100_000,
  ])).filter((amount) => amount > 0).slice(0, 4), [cartTotal]);

  
  
  
  
  
   
    
  
  
  
  
  

  

  

  

  

  // Dukungan input keyboard fisik untuk PC/Laptop kasir (Hook dipanggil sebelum conditional early return)
  

  const lockHistory = useCallback(() => {
    setHistoryUnlocked(false);
    setHistoryPin("");
    setView("orders");
  }, []);
  if (app.authorized === false) return <DevicePairing type="POS" pairing={app.pairing} error={app.error} onBegin={app.beginPairing}/>;
  if (!app.data) return <div className="device-loading"><Image src="/okesih-logo-animated.svg" width={90} height={90} alt="OKESIH"/><b>{app.error || "Menyiapkan Kasir..."}</b></div>;

  const update = async (order: DeviceOrder, status: "COOKING" | "DONE" | "REJECTED") => { setBusy(true); app.setError(""); try { await app.transitionOrder(order.id, status); setHistoryRevision(value => value + 1); setSelected(null); } catch (reason) { app.setError(reason instanceof Error ? reason.message : "Pesanan gagal diperbarui."); } finally { setBusy(false); } };
  const changeQty = (menuId: string, delta: number) => setCart((current) => { const nextQty = (current[menuId]?.qty || 0) + delta; if (nextQty <= 0) { const next = { ...current }; delete next[menuId]; return next; } return { ...current, [menuId]: { qty: Math.min(nextQty, 99), notes: current[menuId]?.notes || "" } }; });
  const submitCashierOrder = async (cashPayment?: number) => {
    if (!cartItems.length || cashierOrderSubmitting.current) return;
    cashierOrderSubmitting.current = true;
    const checkoutTotal = cartTotal;
    setBusy(true); setSaleMessage(""); setCashError(""); app.setError("");
    try {
      const order = await app.createCashierOrder({
        tableNumber,
        paymentMethod,
        ...(paymentMethod === "CASH" ? { cashReceived: cashPayment } : {}),
        items: cartItems.map((item) => ({ menuId: item.menu.id, qty: item.qty, notes: item.notes })),
      });
      setCart({}); setMobileCartOpen(false);
      setSaleMessage(`Pesanan #${String(order.nomor_antrean).padStart(3, "0")} sudah masuk ke KDS dapur.`);
      window.setTimeout(() => setSaleMessage(""), 5000);
      if (paymentMethod === "CASH" && cashPayment !== undefined) {
        setCashResult({ orderNumber: order.nomor_antrean, total: checkoutTotal, received: cashPayment, change: cashPayment - checkoutTotal });
        window.setTimeout(() => { setCashModalOpen(false); setCashResult(null); setCashReceived(""); }, 1800);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Pesanan kasir gagal disimpan.";
      if (paymentMethod === "CASH") setCashError(message); else app.setError(message);
    } finally { cashierOrderSubmitting.current = false; setBusy(false); }
  };
  const handleCheckout = () => {
    if (!cartItems.length || busy || !app.online) return;
    if (paymentMethod === "CASH") {
      setCashReceived(""); setCashError(""); setCashResult(null); setMobileCartOpen(false); setCashModalOpen(true);
      return;
    }
    void submitCashierOrder();
  };
  const toggleOrTestAudio = () => { const ctx = getAudioContext(); setAudioEnabled(true); setAudioUnlocked(Boolean(ctx)); if (ctx) void ctx.resume().then(() => playCashierSound(ctx)); else playCashierSound(null); };
  const cooking = app.data.orders.filter((order) => order.status_pesanan === "COOKING");
  const ready = app.data.orders.filter((order) => order.status_pesanan === "READY");

  const matchesOrderSearch = (order: DeviceOrder, q: string) => {
    if (!q) return true;
    const matchNum = String(order.nomor_antrean).includes(q) || `#${String(order.nomor_antrean)}`.includes(q);
    const matchTable = (order.table_number || "").toLowerCase().includes(q);
    const matchWaiter = (order.waiter_name || "").toLowerCase().includes(q);
    const matchItems = order.items.some((i) => i.nama_menu.toLowerCase().includes(q));
    return matchNum || matchTable || matchWaiter || matchItems;
  };

  const searchQuery = ordersSearch.trim().toLowerCase();
  const filteredPending = pending.filter((order) => matchesOrderSearch(order, searchQuery));
  const filteredCooking = cooking.filter((order) => matchesOrderSearch(order, searchQuery));
  const filteredReady = ready.filter((order) => matchesOrderSearch(order, searchQuery));
  const totalActive = filteredPending.length + filteredCooking.length + filteredReady.length;

  const handleOpenHistory = () => {
    if (app.data?.hasAuditPin && !historyUnlocked) {
      setPinModalOpen(true);
      return;
    }
    setView("history");
  };

  return <CashierShiftGate key={app.data.device.id} tenant={app.data.profile.nama} pendingCount={app.pendingCount} onShiftChanged={() => app.refresh()}><div className="ops-app pos-app pos-redesign">
    <DevicePwaModal type="POS" isOpen={pwaModalOpen} onClose={() => setPwaModalOpen(false)}/>
    <header className="pos-header">
      <div className="pos-brand"><div className="pos-brand-logo">{app.data.profile.logo_url ? <img src={app.data.profile.logo_url} alt={`Logo ${app.data.profile.nama}`}/> : <Image src="/logo.svg?v=2" width={44} height={44} alt="OKESIH"/>}</div><div><small>OKESIH <span>KASIR</span></small><strong>{app.data.profile.nama}</strong></div></div>
      <nav className="pos-nav" aria-label="Menu kasir">
        <button className={view === "orders" ? "active" : ""} onClick={() => setView("orders")}><Icon name="orders"/>Pesanan Masuk{pending.length > 0 && <b>{pending.length}</b>}</button>
        <button className={view === "sale" ? "active" : ""} onClick={() => setView("sale")}><Icon name="cart"/>Pesanan Langsung{cartCount > 0 && <b>{cartCount}</b>}</button>
        <button className={view === "history" ? "active" : ""} onClick={handleOpenHistory}>
          <Icon name="history"/>
          Histori Pesanan
          {app.data?.hasAuditPin && !historyUnlocked && <span style={{ fontSize: "11px", opacity: 0.8, marginLeft: "4px" }}>🔒</span>}
        </button>
      </nav>
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
    <DeviceSyncQueue operations={app.pendingOperations} resolve={app.resolveOperation} />
    {app.error && <div className="ops-error" role="alert">{app.error}<button onClick={() => app.setError("")}>×</button></div>}
    {saleMessage && <div className="pos-toast"><span>✓</span>{saleMessage}</div>}

    {view === "orders" ? (
      <main className="pos-pipeline-page">
        {/* Top Header Ringkas & Elegan */}
        <header className="pos-pipeline-topbar">
          <div className="pos-pipeline-title-group">
            <h1>Pesanan Masuk</h1>
            <span className="pos-pipeline-counter">
              <span className="live-dot" />
              <b>{totalActive}</b> aktif
            </span>
          </div>

          <div className="pos-pipeline-top-actions">
            <label className="pos-pipeline-search">
              <Icon name="search" />
              <input
                type="text"
                value={ordersSearch}
                onChange={(e) => setOrdersSearch(e.target.value)}
                placeholder="Cari no. antrean, meja, menu..."
              />
              {ordersSearch && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setOrdersSearch("")}
                  title="Hapus filter"
                >
                  <Icon name="close" />
                </button>
              )}
            </label>

            <button
              type="button"
              className="pos-pipeline-btn-sync"
              onClick={() => void app.refresh()}
              title="Sinkronkan data pesanan"
            >
              <Icon name="refresh" />
              <span>Sinkron</span>
            </button>

            <button
              type="button"
              className="pos-pipeline-btn-new"
              onClick={() => setView("sale")}
              title="Buat pesanan langsung di kasir"
            >
              <Icon name="plus" />
              <span>+ Pesanan Kasir</span>
            </button>
          </div>
        </header>

        {/* Mobile Stage Selector Tabs (Hanya di layar kecil) */}
        <nav className="pos-pipeline-mobile-tabs" aria-label="Tahap Pesanan">
          <button
            type="button"
            className={`tab-btn ${mobileTab === "PENDING" ? "active pending" : ""}`}
            onClick={() => setMobileTab("PENDING")}
          >
            <span className="tab-step">1</span>
            <span className="tab-name">Pesanan Masuk</span>
            <span className="tab-count">{filteredPending.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${mobileTab === "COOKING" ? "active cooking" : ""}`}
            onClick={() => setMobileTab("COOKING")}
          >
            <span className="tab-step">2</span>
            <span className="tab-name">Proses Dapur</span>
            <span className="tab-count">{filteredCooking.length}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${mobileTab === "READY" ? "active ready" : ""}`}
            onClick={() => setMobileTab("READY")}
          >
            <span className="tab-step">3</span>
            <span className="tab-name">Siap Diambil</span>
            <span className="tab-count">{filteredReady.length}</span>
          </button>
        </nav>

        {/* 3-Column Visual Pipeline Board */}
        <div className="pos-pipeline-board">
          {/* KOLOM 1: PESANAN MASUK */}
          <section className={`pos-pipeline-col col-pending ${mobileTab === "PENDING" ? "mobile-show" : "mobile-hide"}`}>
            <header className="pos-pipeline-col-header">
              <div className="col-header-info">
                <span className="col-step-badge">1</span>
                <h2>Pesanan Masuk</h2>
              </div>
              <span className={`col-count-badge ${filteredPending.length > 0 ? "has-items" : ""}`}>
                {filteredPending.length}
              </span>
            </header>

            <div className="pos-pipeline-cards">
              {filteredPending.length === 0 ? (
                <div className="pos-pipeline-empty">
                  <span className="empty-emoji">📥</span>
                  <p>Tidak ada pesanan menunggu</p>
                </div>
              ) : (
                filteredPending.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpen={() => setSelected(order)}
                    onQuickConfirm={(ord) => void update(ord, "COOKING")}
                    busy={busy}
                    now={ordersNow}
                  />
                ))
              )}
            </div>
          </section>

          {/* Flow Indicator Desktop */}
          <div className="pos-pipeline-arrow-desktop" aria-hidden="true">→</div>

          {/* KOLOM 2: PROSES DAPUR (KDS) */}
          <section className={`pos-pipeline-col col-cooking ${mobileTab === "COOKING" ? "mobile-show" : "mobile-hide"}`}>
            <header className="pos-pipeline-col-header">
              <div className="col-header-info">
                <span className="col-step-badge">2</span>
                <h2>Proses Dapur</h2>
              </div>
              <span className={`col-count-badge ${filteredCooking.length > 0 ? "has-items" : ""}`}>
                {filteredCooking.length}
              </span>
            </header>

            <div className="pos-pipeline-cards">
              {filteredCooking.length === 0 ? (
                <div className="pos-pipeline-empty">
                  <span className="empty-emoji">🍳</span>
                  <p>Dapur sedang santai</p>
                </div>
              ) : (
                filteredCooking.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpen={() => setSelected(order)}
                    busy={busy}
                    now={ordersNow}
                  />
                ))
              )}
            </div>
          </section>

          {/* Flow Indicator Desktop */}
          <div className="pos-pipeline-arrow-desktop" aria-hidden="true">→</div>

          {/* KOLOM 3: SIAP DIAMBIL WAITER */}
          <section className={`pos-pipeline-col col-ready ${mobileTab === "READY" ? "mobile-show" : "mobile-hide"}`}>
            <header className="pos-pipeline-col-header">
              <div className="col-header-info">
                <span className="col-step-badge">3</span>
                <h2>Siap Diambil Waiter</h2>
              </div>
              <span className={`col-count-badge ${filteredReady.length > 0 ? "has-items" : ""}`}>
                {filteredReady.length}
              </span>
            </header>

            <div className="pos-pipeline-cards">
              {filteredReady.length === 0 ? (
                <div className="pos-pipeline-empty">
                  <span className="empty-emoji">🛎️</span>
                  <p>Belum ada yang siap diantar</p>
                </div>
              ) : (
                filteredReady.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpen={() => setSelected(order)}
                    onQuickReadyDone={(ord) => void update(ord, "DONE")}
                    busy={busy}
                    now={ordersNow}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    ) : view === "sale" ? <main className="pos-sale-page">
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
      <button className={`pos-cart-backdrop ${mobileCartOpen ? "open" : ""}`} type="button" aria-label="Tutup keranjang" onClick={() => setMobileCartOpen(false)}/>
      <aside className={`pos-cart-panel ${mobileCartOpen ? "mobile-open" : ""}`} aria-label="Keranjang pesanan"><header><div><small>PESANAN LANGSUNG</small><h2>Keranjang</h2></div><div className="pos-cart-heading-actions"><span>{cartCount} item</span><button className="pos-cart-mobile-close" type="button" aria-label="Tutup keranjang" onClick={() => setMobileCartOpen(false)}><Icon name="close"/></button></div></header><label className="pos-field">Lokasi pesanan<select value={tableNumber} onChange={(event) => setTableNumber(event.target.value)}><option value="Kasir">Kasir / Bawa pulang</option>{app.data.tables.map((table) => <option key={table.id} value={table.label}>Meja {table.label}</option>)}</select></label>
        <div className="pos-cart-lines">{cartItems.length === 0 ? <div className="pos-cart-empty"><span><Icon name="cart"/></span><h3>Keranjang masih kosong</h3><p>Pilih menu di sebelah kiri untuk mulai membuat pesanan.</p></div> : cartItems.map((item) => <article key={item.menu.id}><div><h3>{item.menu.nama}</h3><strong>Rp {(Number(item.menu.harga) * item.qty).toLocaleString("id-ID")}</strong></div><div className="pos-cart-line-actions"><div className="pos-menu-qty"><button onClick={() => changeQty(item.menu.id, -1)}><Icon name="minus"/></button><b>{item.qty}</b><button onClick={() => changeQty(item.menu.id, 1)}><Icon name="plus"/></button></div><button className="pos-remove" onClick={() => setCart((current) => { const next = { ...current }; delete next[item.menu.id]; return next; })}><Icon name="close"/></button></div><input value={item.notes} maxLength={300} onChange={(event) => setCart((current) => ({ ...current, [item.menu.id]: { ...current[item.menu.id], notes: event.target.value } }))} placeholder="Catatan, mis. tanpa gula"/></article>)}</div>
        <div className="pos-payment"><small>METODE PEMBAYARAN</small><div><button className={paymentMethod === "CASH" ? "active" : ""} onClick={() => setPaymentMethod("CASH")}><span>Rp</span><b>Tunai</b></button><button className={paymentMethod === "QRIS" ? "active" : ""} onClick={() => setPaymentMethod("QRIS")}><span>▦</span><b>QRIS</b></button></div></div>
        <footer><div><span>Total pembayaran</span><strong>Rp {cartTotal.toLocaleString("id-ID")}</strong></div><button disabled={!cartItems.length || busy || !app.online} onClick={handleCheckout}>{busy ? "Mengirim..." : <><span>{paymentMethod === "CASH" ? "Lanjut Pembayaran Tunai" : "Bayar & Kirim ke Dapur"}</span><b>→</b></>}</button>{!app.online && <small>Hubungkan internet untuk mengirim pesanan ke KDS.</small>}</footer>
      </aside>
      <section className="pos-mobile-checkout" aria-label="Pembayaran pesanan">
        <button className="pos-mobile-cart-summary" type="button" onClick={() => setMobileCartOpen(true)}>
          <span><Icon name="cart"/><b>{cartCount}</b></span>
          <span><small>Total</small><strong>Rp {cartTotal.toLocaleString("id-ID")}</strong></span>
          <em>Lihat</em>
        </button>
        <div className="pos-mobile-payment" aria-label="Pilih metode pembayaran">
          <button type="button" className={paymentMethod === "CASH" ? "active" : ""} aria-pressed={paymentMethod === "CASH"} onClick={() => setPaymentMethod("CASH")}><span>Rp</span>Tunai</button>
          <button type="button" className={paymentMethod === "QRIS" ? "active" : ""} aria-pressed={paymentMethod === "QRIS"} onClick={() => setPaymentMethod("QRIS")}><span>▦</span>QRIS</button>
        </div>
        <button className="pos-mobile-pay" type="button" disabled={!cartItems.length || busy || !app.online} onClick={handleCheckout}>
          <span>{busy ? "Mengirim..." : "Bayar"}</span><b>→</b>
        </button>
      </section>
    </main> : <History data={app.data} online={app.online} historyPin={historyPin} lockHistory={lockHistory} setSelected={setSelected} revision={historyRevision} />}

    {/* Popup Modal Filter Rentang Waktu (Omzet Card & Toolbar) */}
    

    {/* Modal Input PIN Akses Audit */}
    {pinModalOpen && <AuditPinModal onClose={() => setPinModalOpen(false)} onVerified={(pin) => { setHistoryPin(pin); setHistoryUnlocked(true); setView("history"); }} />}

    {cashModalOpen && <div className="pos-cash-modal-backdrop" role="presentation"><section className="pos-cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-payment-title">
      {cashResult ? <div className="pos-cash-success" role="status">
        <span>✓</span><small>PEMBAYARAN BERHASIL</small><h2 id="cash-payment-title">Kembalian Rp {cashResult.change.toLocaleString("id-ID")}</h2><p>Pesanan #{String(cashResult.orderNumber).padStart(3, "0")} sudah dikirim ke dapur.</p><div><span>Dibayar <b>Rp {cashResult.received.toLocaleString("id-ID")}</b></span><span>Total <b>Rp {cashResult.total.toLocaleString("id-ID")}</b></span></div><em>Popup akan tertutup otomatis…</em>
      </div> : <form onSubmit={(event) => { event.preventDefault(); if (cashAmount >= cartTotal) void submitCashierOrder(cashAmount); }}>
        <header><div><small>PEMBAYARAN TUNAI</small><h2 id="cash-payment-title">Terima pembayaran</h2><p>Masukkan uang yang diterima dari pelanggan.</p></div><button type="button" aria-label="Tutup pembayaran tunai" disabled={busy} onClick={() => setCashModalOpen(false)}><Icon name="close"/></button></header>
        <div className="pos-cash-total"><span>Total tagihan</span><strong>Rp {cartTotal.toLocaleString("id-ID")}</strong><small>{cartCount} item · {tableNumber === "Kasir" ? "Bawa pulang" : `Meja ${tableNumber}`}</small></div>
        <label className="pos-cash-input"><span>Uang pembayaran</span><div><b>Rp</b><input autoFocus inputMode="numeric" autoComplete="off" value={cashReceived ? Number(cashReceived).toLocaleString("id-ID") : ""} onChange={(event) => setCashReceived(event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12))} placeholder="0" aria-describedby="cash-payment-status"/></div></label>
        <div className="pos-cash-quick" aria-label="Pilihan nominal cepat">{cashQuickAmounts.map((amount) => <button type="button" key={amount} className={cashAmount === amount ? "active" : ""} onClick={() => setCashReceived(String(amount))}>{amount === cartTotal ? "Uang pas" : `Rp ${amount.toLocaleString("id-ID")}`}</button>)}</div>
        <div id="cash-payment-status" className={`pos-cash-change ${cashShortage > 0 ? "short" : "ready"}`}><span>{cashShortage > 0 ? "Kurang bayar" : "Kembalian"}</span><strong>Rp {(cashShortage > 0 ? cashShortage : cashChange).toLocaleString("id-ID")}</strong></div>
        {cashError && <div className="pos-cash-error" role="alert">{cashError}</div>}
        <footer><button type="button" disabled={busy} onClick={() => setCashModalOpen(false)}>Batal</button><button type="submit" disabled={busy || cashAmount < cartTotal}>{busy ? "Memproses..." : "Selesaikan Pembayaran"}<b>→</b></button></footer>
      </form>}
    </section></div>}

    {selected && <div className="ops-modal-backdrop"><section className="ops-modal"><button className="ops-modal-close" onClick={() => setSelected(null)}>×</button><small>ANTREAN #{String(selected.nomor_antrean).padStart(3, "0")}</small><h2>{selected.table_number === "Kasir" ? "Pesanan Kasir" : `Meja ${selected.table_number}`}</h2>
      <div className="ops-modal-audit-info">
        <div>
          <small>KASIR AUDIT</small>
          <strong>{getOrderCashier(selected, shift?.cashierName)}</strong>
        </div>
        <div>
          <small>WAKTU TRANSAKSI</small>
          <strong>{new Date(selected.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</strong>
        </div>
      </div>
      <div className={`ops-payment ${selected.payment_method.toLowerCase()}`}>{selected.payment_method === "CASH" ? "BAYAR TUNAI" : "QRIS — VERIFIKASI BUKTI"}</div>{selected.payment_proof_url && <a className="ops-proof" href={selected.payment_proof_url} target="_blank" rel="noreferrer">Buka Bukti Pembayaran</a>}<div className="ops-items">{selected.items.map((item) => <div key={item.id}><span>{item.qty}× {item.nama_menu}{item.notes && <small>{item.notes}</small>}</span><b>Rp {(Number(item.harga_satuan) * item.qty).toLocaleString("id-ID")}</b></div>)}</div><strong className="ops-total">Total Rp {Number(selected.total_harga).toLocaleString("id-ID")}</strong>{selected.status_pesanan === "AWAITING_CONFIRMATION" ? <div className="ops-modal-actions"><button disabled={busy} className="danger" onClick={() => void update(selected, "REJECTED")}>Tolak</button><button disabled={busy} className="primary" onClick={() => void update(selected, "COOKING")}>{busy ? "Menyimpan..." : "Konfirmasi & Kirim ke Dapur"}</button></div> : selected.status_pesanan === "READY" ? <button disabled={busy} className="primary" onClick={() => void update(selected, "DONE")}>Tandai Sudah Diantar</button> : selected.status_pesanan === "DONE" ? <p style={{ color: "#16a34a", fontWeight: 800 }}>✓ Pesanan sudah selesai diantar.</p> : <p>Status: Sedang disiapkan dapur</p>}</section></div>}
  </div></CashierShiftGate>;
}

function OrderCard({
  order,
  onOpen,
  onQuickConfirm,
  onQuickReadyDone,
  busy,
  now,
}: {
  order: DeviceOrder;
  onOpen: () => void;
  onQuickConfirm?: (order: DeviceOrder) => void;
  onQuickReadyDone?: (order: DeviceOrder) => void;
  busy?: boolean;
  now: number;
}) {
  const isPending = order.status_pesanan === "AWAITING_CONFIRMATION";
  const isCooking = order.status_pesanan === "COOKING";
  const isReady = order.status_pesanan === "READY";

  const location = order.table_number === "Kasir" ? "Kasir / Take away" : `Meja ${order.table_number}`;
  const totalQty = order.items.reduce((sum, item) => sum + item.qty, 0);
  const timeStr = new Date(order.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const elapsed = formatElapsedTime(order.created_at, now);

  const previewItems = order.items.slice(0, 3);
  const moreCount = order.items.length - previewItems.length;
  const hasNotes = order.items.some((item) => Boolean(item.notes));

  return (
    <article
      className={`pos-ticket-card ${isPending ? "pending" : isCooking ? "cooking" : "ready"}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="pos-ticket-stripe" />
      <header className="pos-ticket-header">
        <div className="pos-ticket-num-wrap">
          <span className="pos-ticket-num">#{String(order.nomor_antrean).padStart(3, "0")}</span>
          <span className="pos-ticket-time" title={`Masuk pukul ${timeStr}`}>
            <Icon name="history" /> {elapsed}
          </span>
        </div>
        <div className="pos-ticket-badge-wrap">
          {isPending ? (
            <span className="pos-ticket-status pending">
              <span className="pos-ticket-pulse-dot" /> Perlu Konfirmasi
            </span>
          ) : isCooking ? (
            <span className="pos-ticket-status cooking">
              ♨ Di Dapur (KDS)
            </span>
          ) : (
            <span className="pos-ticket-status ready">
              ✓ Siap Diantar
            </span>
          )}
        </div>
      </header>

      <div className="pos-ticket-meta">
        <div className="pos-ticket-location">
          <span className="pos-ticket-loc-icon">{order.table_number === "Kasir" ? "🛍️" : "🪑"}</span>
          <strong>{location}</strong>
        </div>
        <span className="pos-ticket-qty-badge">{totalQty} item</span>
      </div>

      <div className="pos-ticket-items">
        {previewItems.map((item) => (
          <div key={item.id} className="pos-ticket-item-row">
            <span className="pos-ticket-item-qty">{item.qty}×</span>
            <span className="pos-ticket-item-name">{item.nama_menu}</span>
            {item.notes && <span className="pos-ticket-note-icon" title={item.notes}>📝</span>}
          </div>
        ))}
        {moreCount > 0 && (
          <div className="pos-ticket-more-items">
            +{moreCount} menu lainnya...
          </div>
        )}
        {hasNotes && (
          <div className="pos-ticket-has-notes">
            <span>📝 Ada catatan pesanan</span>
          </div>
        )}
      </div>

      <footer className="pos-ticket-footer">
        <div>
          <small>Total Tagihan</small>
          <strong>Rp {Number(order.total_harga).toLocaleString("id-ID")}</strong>
        </div>
        <span className={`pos-ticket-pay ${order.payment_method.toLowerCase()}`}>
          {order.payment_method === "CASH" ? "💵 TUNAI" : "📱 QRIS"}
        </span>
      </footer>

      <div className="pos-ticket-actions" onClick={(e) => e.stopPropagation()}>
        {isPending ? (
          <>
            <button
              type="button"
              className="pos-ticket-btn detail"
              onClick={onOpen}
            >
              Detail
            </button>
            <button
              type="button"
              className="pos-ticket-btn confirm"
              disabled={busy}
              onClick={() => onQuickConfirm && onQuickConfirm(order)}
            >
              {busy ? "Memproses..." : "Konfirmasi & Dapur →"}
            </button>
          </>
        ) : isReady ? (
          <>
            <button
              type="button"
              className="pos-ticket-btn detail"
              onClick={onOpen}
            >
              Detail
            </button>
            <button
              type="button"
              className="pos-ticket-btn ready-done"
              disabled={busy}
              onClick={() => onQuickReadyDone && onQuickReadyDone(order)}
            >
              {busy ? "Menyimpan..." : "✓ Sudah Diantar"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="pos-ticket-btn view-only"
            onClick={onOpen}
          >
            Lihat Tiket Dapur ↗
          </button>
        )}
      </div>
    </article>
  );
}
