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
type View = "orders" | "sale" | "history";
type DateFilterMode = "today" | "this_week" | "this_month" | "this_year" | "custom" | "all";

type DateFilterState = {
  mode: DateFilterMode;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
};

function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRangeForMode(mode: DateFilterMode, customStart?: string, customEnd?: string): { start: Date | null; end: Date | null; label: string } {
  const now = new Date();
  if (mode === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end, label: "HARI INI" };
  }
  if (mode === "this_week") {
    // Senin sebagai awal minggu (Indonesia / ISO)
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Senin, 6 = Minggu
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59, 999);
    return { start, end, label: "MINGGU INI" };
  }
  if (mode === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end, label: "BULAN INI" };
  }
  if (mode === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start, end, label: "TAHUN INI" };
  }
  if (mode === "custom" && (customStart || customEnd)) {
    const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(2000, 0, 1);
    const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : new Date(2099, 11, 31);
    const label = customStart && customEnd && customStart === customEnd
      ? new Date(`${customStart}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
      : `${customStart ? new Date(`${customStart}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "..."} - ${customEnd ? new Date(`${customEnd}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "..."}`;
    return { start, end, label: label.toUpperCase() };
  }
  return { start: null, end: null, label: "SEMUA WAKTU" };
}

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

function Icon({ name }: { name: "orders" | "cart" | "history" | "search" | "refresh" | "bell" | "install" | "plus" | "minus" | "close" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    orders: <><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    cart: <><path d="M3 4h2l2.2 10h9.8l2-7H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></>,
    history: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    install: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 19h14"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, minus: <path d="M5 12h14"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function getOrderCashier(order: DeviceOrder, currentShiftCashier?: string): string {
  if (order.waiter_name) {
    return order.waiter_name.replace(/^Kasir:\s*/i, "").trim();
  }
  if (order.table_number === "Kasir" && currentShiftCashier) {
    return currentShiftCashier;
  }
  return "Kasir";
}

function getCashierInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "K";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
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
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [cashError, setCashError] = useState("");
  const [cashResult, setCashResult] = useState<{ orderNumber: number; total: number; received: number; change: number } | null>(null);
  const [saleMessage, setSaleMessage] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");
  const [historyPaymentFilter, setHistoryPaymentFilter] = useState("ALL");
  const [historyDateFilter, setHistoryDateFilter] = useState<DateFilterState>({ mode: "today" });
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [tempCustomStart, setTempCustomStart] = useState("");
  const [tempCustomEnd, setTempCustomEnd] = useState("");

  // PIN Gate Keamanan Audit Histori
  const [historyUnlocked, setHistoryUnlocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinChecking, setPinChecking] = useState(false);
  const [pinShaking, setPinShaking] = useState(false);

  // Filter & Search untuk Pesanan Masuk
  const [ordersFilter, setOrdersFilter] = useState<"ALL" | "PENDING" | "COOKING" | "READY">("ALL");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersNow, setOrdersNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setOrdersNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const audio = useRef<AudioContext | null>(null);
  const cashierOrderSubmitting = useRef(false);
  const shift = useCashierShift();
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

  // Kombinasi pesanan aktif dan histori pesanan agar audit selalu up to date
  const allOrders = useMemo(() => {
    if (!app.data) return [];
    const map = new Map<string, DeviceOrder>();
    for (const ord of app.data.historyOrders || []) {
      map.set(ord.id, ord);
    }
    for (const ord of app.data.orders || []) {
      map.set(ord.id, ord);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [app.data]);

  // Rentang tanggal aktif
  const activeDateRange = useMemo(() => {
    return getDateRangeForMode(
      historyDateFilter.mode,
      historyDateFilter.startDate,
      historyDateFilter.endDate
    );
  }, [historyDateFilter]);

  // Filtered orders untuk audit owner
  const filteredHistoryOrders = useMemo(() => {
    const { start, end } = activeDateRange;
    const startTime = start ? start.getTime() : null;
    const endTime = end ? end.getTime() : null;

    return allOrders.filter((order) => {
      if (startTime !== null && endTime !== null) {
        const orderTime = new Date(order.created_at).getTime();
        if (orderTime < startTime || orderTime > endTime) return false;
      }
      if (historyStatusFilter !== "ALL" && order.status_pesanan !== historyStatusFilter) {
        return false;
      }
      if (historyPaymentFilter !== "ALL" && order.payment_method !== historyPaymentFilter) {
        return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const cashierName = getOrderCashier(order, shift?.cashierName).toLowerCase();
        const table = (order.table_number || "").toLowerCase();
        const queue = String(order.nomor_antrean);
        const itemNames = order.items.map((i) => i.nama_menu).join(" ").toLowerCase();
        if (!cashierName.includes(q) && !table.includes(q) && !queue.includes(q) && !itemNames.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [allOrders, activeDateRange, historyStatusFilter, historyPaymentFilter, historySearch, shift?.cashierName]);

  // KPI Metrics Audit
  const auditStats = useMemo(() => {
    const { start, end } = activeDateRange;
    const startTime = start ? start.getTime() : null;
    const endTime = end ? end.getTime() : null;

    const targetSet = startTime !== null && endTime !== null
      ? allOrders.filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= startTime && t <= endTime;
        })
      : allOrders;

    const validCompleted = targetSet.filter((o) => o.status_pesanan !== "REJECTED");
    const totalOmzet = validCompleted.reduce((sum, o) => sum + Number(o.total_harga || 0), 0);
    const totalCount = targetSet.length;
    const cashTotal = validCompleted.filter((o) => o.payment_method === "CASH").reduce((sum, o) => sum + Number(o.total_harga || 0), 0);
    const qrisTotal = validCompleted.filter((o) => o.payment_method === "QRIS").reduce((sum, o) => sum + Number(o.total_harga || 0), 0);

    return { totalOmzet, totalCount, cashTotal, qrisTotal };
  }, [allOrders, activeDateRange]);

  const openDateFilterModal = () => {
    const todayStr = formatIsoDate(new Date());
    setTempCustomStart(historyDateFilter.startDate || todayStr);
    setTempCustomEnd(historyDateFilter.endDate || todayStr);
    setDateModalOpen(true);
  };

  const applyCustomDateRange = () => {
    if (!tempCustomStart && !tempCustomEnd) {
      setHistoryDateFilter({ mode: "today" });
    } else {
      setHistoryDateFilter({
        mode: "custom",
        startDate: tempCustomStart || tempCustomEnd,
        endDate: tempCustomEnd || tempCustomStart,
      });
    }
    setDateModalOpen(false);
  };

  const triggerPinShake = () => {
    setPinShaking(true);
    window.setTimeout(() => setPinShaking(false), 500);
  };

  const verifyAuditPin = async (e?: React.FormEvent, customPin?: string) => {
    if (e) e.preventDefault();
    const pinToVerify = customPin !== undefined ? customPin : pinInput;
    if (!pinToVerify.trim()) {
      setPinError("Masukkan PIN keamanan");
      triggerPinShake();
      return;
    }
    setPinChecking(true);
    setPinError("");
    try {
      const res = await fetch("/api/device/audit-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinToVerify }),
      });
      const data = await res.json();
      if (!res.ok || !data.verified) {
        setPinError(data.error || "PIN tidak sesuai. Hubungi Owner.");
        setPinInput(""); // Langsung kosongkan isian PIN agar siap diisi kembali
        triggerPinShake(); // Efek visual bergetar pada modal
        return;
      }
      // PIN benar: segera buka akses dan beralih ke History Pesanan
      setHistoryUnlocked(true);
      setPinModalOpen(false);
      setPinInput("");
      setPinError("");
      setView("history");
    } catch {
      setPinError("Gagal memeriksa PIN. Pastikan koneksi terhubung.");
      setPinInput("");
      triggerPinShake();
    } finally {
      setPinChecking(false);
    }
  };

  // Dukungan input keyboard fisik untuk PC/Laptop kasir (Hook dipanggil sebelum conditional early return)
  useEffect(() => {
    if (!pinModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setPinInput((prev) => {
          if (prev.length < 6) {
            const next = prev + e.key;
            setPinError("");
            if (next.length === 6) {
              void verifyAuditPin(undefined, next);
            }
            return next;
          }
          return prev;
        });
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setPinInput((prev) => prev.slice(0, -1));
        setPinError("");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPinModalOpen(false);
        setPinInput("");
        setPinError("");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (pinInput.length >= 4) {
          void verifyAuditPin();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pinModalOpen, pinInput]);

  if (app.authorized === false) return <DevicePairing type="POS" pairing={app.pairing} error={app.error} onBegin={app.beginPairing}/>;
  if (!app.data) return <div className="device-loading"><Image src="/okesih-logo-animated.svg" width={90} height={90} alt="OKESIH"/><b>{app.error || "Menyiapkan Kasir..."}</b></div>;

  const update = async (order: DeviceOrder, status: "COOKING" | "DONE" | "REJECTED") => { setBusy(true); app.setError(""); try { await app.transitionOrder(order.id, status); setSelected(null); } catch (reason) { app.setError(reason instanceof Error ? reason.message : "Pesanan gagal diperbarui."); } finally { setBusy(false); } };
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

  const allActiveOrders = [...filteredReady, ...filteredCooking, ...filteredPending];
  const filteredOrders = allActiveOrders.filter((order) => {
    if (ordersFilter === "PENDING") return order.status_pesanan === "AWAITING_CONFIRMATION";
    if (ordersFilter === "COOKING") return order.status_pesanan === "COOKING";
    if (ordersFilter === "READY") return order.status_pesanan === "READY";
    return true;
  });

  const handleOpenHistory = () => {
    if (app.data?.hasAuditPin && !historyUnlocked) {
      setPinInput("");
      setPinError("");
      setPinModalOpen(true);
      return;
    }
    setView("history");
  };

  const lockHistory = () => {
    setHistoryUnlocked(false);
    setView("orders");
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
    {app.error && <div className="ops-error" role="alert">{app.error}<button onClick={() => app.setError("")}>×</button></div>}
    {saleMessage && <div className="pos-toast"><span>✓</span>{saleMessage}</div>}

    {view === "orders" ? (
      <main className="pos-orders-page">
        {/* Top Hero / Operational Header */}
        <section className="pos-orders-hero">
          <div className="pos-orders-hero-copy">
            <div className="pos-orders-live-chip">
              <span className="live-dot" />
              <span>MONITOR KASIR AKTIF</span>
              <span className="live-divider">•</span>
              <b>{pending.length + cooking.length + ready.length} Pesanan Berjalan</b>
            </div>
            <h1>Antrean &amp; Transaksi Masuk</h1>
            <p>Pantau pesanan meja masuk secara real-time, konfirmasi pembayaran, dan pantau proses dapur.</p>
          </div>
          <div className="pos-orders-hero-actions">
            <button
              type="button"
              className="pos-hero-btn secondary"
              onClick={() => void app.refresh()}
              title="Sinkronkan data pesanan sekarang"
            >
              <Icon name="refresh" />
              <span>Sinkronkan</span>
            </button>
            <button
              type="button"
              className="pos-hero-btn primary"
              onClick={() => setView("sale")}
              title="Buat pesanan langsung di meja kasir"
            >
              <Icon name="plus" />
              <span>Pesanan Langsung</span>
            </button>
          </div>
        </section>

        {/* 3 Interactive KPI Filter Cards */}
        <section className="pos-kpi-grid">
          <button
            type="button"
            className={`pos-kpi-card waiting ${ordersFilter === "PENDING" ? "active" : ""} ${pending.length > 0 ? "has-urgent" : ""}`}
            onClick={() => setOrdersFilter((prev) => (prev === "PENDING" ? "ALL" : "PENDING"))}
          >
            <div className="pos-kpi-icon">
              <Icon name="orders" />
              {pending.length > 0 && <span className="pos-kpi-pulse" />}
            </div>
            <div className="pos-kpi-info">
              <small>PERLU KONFIRMASI</small>
              <strong>{pending.length}</strong>
              <p>Pesanan dari meja</p>
            </div>
            <span className="pos-kpi-indicator">
              {ordersFilter === "PENDING" ? "Filter Aktif ✓" : "Klik Filter"}
            </span>
          </button>

          <button
            type="button"
            className={`pos-kpi-card cooking ${ordersFilter === "COOKING" ? "active" : ""}`}
            onClick={() => setOrdersFilter((prev) => (prev === "COOKING" ? "ALL" : "COOKING"))}
          >
            <div className="pos-kpi-icon">♨</div>
            <div className="pos-kpi-info">
              <small>SEDANG DISIAPKAN</small>
              <strong>{cooking.length}</strong>
              <p>Diproses dapur (KDS)</p>
            </div>
            <span className="pos-kpi-indicator">
              {ordersFilter === "COOKING" ? "Filter Aktif ✓" : "Klik Filter"}
            </span>
          </button>

          <button
            type="button"
            className={`pos-kpi-card ready ${ordersFilter === "READY" ? "active" : ""}`}
            onClick={() => setOrdersFilter((prev) => (prev === "READY" ? "ALL" : "READY"))}
          >
            <div className="pos-kpi-icon">✓</div>
            <div className="pos-kpi-info">
              <small>SIAP DIANTAR</small>
              <strong>{ready.length}</strong>
              <p>Menunggu pengantaran</p>
            </div>
            <span className="pos-kpi-indicator">
              {ordersFilter === "READY" ? "Filter Aktif ✓" : "Klik Filter"}
            </span>
          </button>
        </section>

        {/* Operational Filter & Search Toolbar */}
        <section className="pos-orders-toolbar">
          <div className="pos-orders-filter-tabs">
            <button
              type="button"
              className={ordersFilter === "ALL" ? "active" : ""}
              onClick={() => setOrdersFilter("ALL")}
            >
              Semua ({pending.length + cooking.length + ready.length})
            </button>
            <button
              type="button"
              className={ordersFilter === "PENDING" ? "active" : ""}
              onClick={() => setOrdersFilter("PENDING")}
            >
              Perlu Konfirmasi ({pending.length})
            </button>
            <button
              type="button"
              className={ordersFilter === "COOKING" ? "active" : ""}
              onClick={() => setOrdersFilter("COOKING")}
            >
              Dapur ({cooking.length})
            </button>
            <button
              type="button"
              className={ordersFilter === "READY" ? "active" : ""}
              onClick={() => setOrdersFilter("READY")}
            >
              Siap Diantar ({ready.length})
            </button>
          </div>

          <label className="pos-orders-search-box">
            <Icon name="search" />
            <input
              type="text"
              value={ordersSearch}
              onChange={(e) => setOrdersSearch(e.target.value)}
              placeholder="Cari no. antrean, meja, atau nama menu..."
            />
            {ordersSearch && (
              <button
                type="button"
                className="pos-orders-search-clear"
                onClick={() => setOrdersSearch("")}
                title="Hapus pencarian"
              >
                <Icon name="close" />
              </button>
            )}
          </label>
        </section>

        {/* Orders Content Area */}
        {ordersFilter === "ALL" ? (
          <>
            {/* Section 1: Konfirmasi Pesanan Baru */}
            <section className="pos-order-section pending-section">
              <div className="pos-section-heading">
                <div className="pos-section-title-wrap">
                  <span className="pos-section-tag pending">⚡ PERLU TINDAKAN CEPAT</span>
                  <h2>Konfirmasi Pesanan</h2>
                </div>
                <span className={`pos-section-badge ${filteredPending.length > 0 ? "urgent" : ""}`}>
                  {filteredPending.length} pesanan menunggu
                </span>
              </div>

              {filteredPending.length === 0 ? (
                <div className="pos-pending-banner-compact">
                  <div className="pos-pending-banner-copy">
                    <span className="pos-pending-banner-check">✓</span>
                    <div>
                      <strong>Semua pesanan meja sudah ditangani</strong>
                      <p>Pesanan baru dari pelanggan akan berdering dan muncul otomatis di sini.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pos-pending-banner-cta"
                    onClick={() => setView("sale")}
                  >
                    + Buat Pesanan Langsung
                  </button>
                </div>
              ) : (
                <div className="pos-tickets-grid">
                  {filteredPending.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onOpen={() => setSelected(order)}
                      onQuickConfirm={(ord) => void update(ord, "COOKING")}
                      busy={busy}
                      now={ordersNow}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Section 2: Dapur & Pengantaran */}
            {(filteredReady.length > 0 || filteredCooking.length > 0) && (
              <section className="pos-order-section kitchen-section">
                <div className="pos-section-heading">
                  <div className="pos-section-title-wrap">
                    <span className="pos-section-tag kitchen">PROSES BERJALAN</span>
                    <h2>Dapur &amp; Pengantaran</h2>
                  </div>
                  <span className="pos-section-badge">
                    {filteredReady.length + filteredCooking.length} pesanan
                  </span>
                </div>
                <div className="pos-tickets-grid">
                  {filteredReady.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onOpen={() => setSelected(order)}
                      onQuickReadyDone={(ord) => void update(ord, "DONE")}
                      busy={busy}
                      now={ordersNow}
                    />
                  ))}
                  {filteredCooking.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onOpen={() => setSelected(order)}
                      busy={busy}
                      now={ordersNow}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredPending.length === 0 && filteredReady.length === 0 && filteredCooking.length === 0 && (
              <div className="pos-empty-state-large">
                <div className="pos-empty-icon">☕</div>
                <h3>Belum ada transaksi aktif saat ini</h3>
                <p>Silakan buat pesanan baru langsung dari kasir atau tunggu pesanan dari meja pelanggan.</p>
                <button
                  type="button"
                  className="pos-empty-btn"
                  onClick={() => setView("sale")}
                >
                  + Buat Pesanan Kasir
                </button>
              </div>
            )}
          </>
        ) : (
          <section className="pos-order-section">
            <div className="pos-section-heading">
              <div className="pos-section-title-wrap">
                <span className="pos-section-tag">
                  {ordersFilter === "PENDING"
                    ? "PERLU KONFIRMASI"
                    : ordersFilter === "COOKING"
                    ? "DAPUR (KDS)"
                    : "SIAP DIANTAR"}
                </span>
                <h2>
                  {ordersFilter === "PENDING"
                    ? "Pesanan Menunggu Konfirmasi"
                    : ordersFilter === "COOKING"
                    ? "Sedang Disiapkan Dapur"
                    : "Pesanan Siap Diantar"}
                </h2>
              </div>
              <span className="pos-section-badge">
                {filteredOrders.length} pesanan
              </span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="pos-empty-filtered">
                <span>🔍</span>
                <h3>Tidak ada pesanan ditemukan</h3>
                <p>
                  {ordersSearch
                    ? `Tidak ada pesanan yang cocok dengan pencarian "${ordersSearch}"`
                    : "Tidak ada pesanan dalam kategori ini saat ini."}
                </p>
                {ordersSearch && (
                  <button type="button" onClick={() => setOrdersSearch("")}>
                    Reset Pencarian
                  </button>
                )}
              </div>
            ) : (
              <div className="pos-tickets-grid">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onOpen={() => setSelected(order)}
                    onQuickConfirm={(ord) => void update(ord, "COOKING")}
                    onQuickReadyDone={(ord) => void update(ord, "DONE")}
                    busy={busy}
                    now={ordersNow}
                  />
                ))}
              </div>
            )}
          </section>
        )}
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
    </main> : <main className="pos-history-page">
      <section className="pos-hero-row">
        <div className="pos-history-intro">
          <small>REKAP TRANSAKSI</small>
          <h1>Histori Pesanan &amp; Audit Kasir</h1>
          <p>Rekap seluruh transaksi, nama kasir pelaksana, dan rincian pembayaran untuk keperluan audit owner.</p>
        </div>
        <div className="pos-history-actions">
          {app.data?.hasAuditPin && (
            <button
              type="button"
              className="pos-history-lock-button"
              onClick={lockHistory}
              title="Kunci kembali akses audit"
            >
              <span aria-hidden="true">🔒</span> Kunci Audit
            </button>
          )}
          <button className="pos-history-sync-button" type="button" onClick={() => void app.refresh()}><Icon name="refresh"/> Sinkronkan</button>
        </div>
      </section>

      {/* KPI Audit Card */}
      <section className="pos-audit-stats">
        <button
          type="button"
          className="pos-audit-card omzet pos-card-clickable"
          onClick={openDateFilterModal}
          title="Klik untuk memilih rentang waktu filter audit"
        >
          <div className="pos-audit-icon">💰</div>
          <div>
            <small>
              <span>OMZET</span>
              <span className="pos-audit-period-tag">{activeDateRange.label}</span>
            </small>
            <strong>Rp {auditStats.totalOmzet.toLocaleString("id-ID")}</strong>
            <p>{auditStats.totalCount} transaksi · Klik untuk ubah filter</p>
          </div>
          <div className="pos-audit-card-action-hint" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </button>
        <article className="pos-audit-card orders">
          <div className="pos-audit-icon">🧾</div>
          <div>
            <small>TOTAL STRUK</small>
            <strong>{auditStats.totalCount} Struk</strong>
            <p>Berhasil &amp; diproses</p>
          </div>
        </article>
        <article className="pos-audit-card cash">
          <div className="pos-audit-icon">💵</div>
          <div>
            <small>TOTAL KAS TUNAI</small>
            <strong>Rp {auditStats.cashTotal.toLocaleString("id-ID")}</strong>
            <p>Uang fisik di laci kasir</p>
          </div>
        </article>
        <article className="pos-audit-card qris">
          <div className="pos-audit-icon">📱</div>
          <div>
            <small>TOTAL NON-TUNAI (QRIS)</small>
            <strong>Rp {auditStats.qrisTotal.toLocaleString("id-ID")}</strong>
            <p>Masuk rekening usaha</p>
          </div>
        </article>
      </section>

      {/* Toolbar Filter & Pencarian */}
      <section className="pos-audit-toolbar">
        <div className="pos-audit-toolbar-heading">
          <div>
            <strong>Temukan transaksi</strong>
            <small>{filteredHistoryOrders.length} transaksi ditampilkan</small>
          </div>
          <span>{activeDateRange.label}</span>
        </div>
        <label className="pos-audit-search">
          <Icon name="search"/>
          <input
            type="text"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            placeholder="Cari kasir, meja, antrean, atau menu..."
          />
        </label>

        <div className="pos-audit-filters">
          <div className="pos-audit-filter-block">
            <span>Periode</span>
            <div className="pos-audit-pill-group">
              <button
                className={historyDateFilter.mode === "today" ? "active" : ""}
                onClick={() => setHistoryDateFilter({ mode: "today" })}
              >
                Hari Ini
              </button>
              <button
                className={historyDateFilter.mode === "this_week" ? "active" : ""}
                onClick={() => setHistoryDateFilter({ mode: "this_week" })}
              >
                Minggu Ini
              </button>
              <button
                className={historyDateFilter.mode === "this_month" ? "active" : ""}
                onClick={() => setHistoryDateFilter({ mode: "this_month" })}
              >
                Bulan Ini
              </button>
              <button
                className={historyDateFilter.mode === "this_year" ? "active" : ""}
                onClick={() => setHistoryDateFilter({ mode: "this_year" })}
              >
                Tahun Ini
              </button>
              <button
                className={historyDateFilter.mode === "custom" || historyDateFilter.mode === "all" ? "active" : ""}
                onClick={openDateFilterModal}
              >
                {historyDateFilter.mode === "custom" ? "Custom 📅" : "Lainnya ▾"}
              </button>
            </div>
          </div>

          <div className="pos-audit-filter-block">
            <span>Pembayaran</span>
            <div className="pos-audit-pill-group">
              <button
                className={historyPaymentFilter === "ALL" ? "active" : ""}
                onClick={() => setHistoryPaymentFilter("ALL")}
              >
                Semua
              </button>
              <button
                className={historyPaymentFilter === "CASH" ? "active" : ""}
                onClick={() => setHistoryPaymentFilter("CASH")}
              >
                Tunai
              </button>
              <button
                className={historyPaymentFilter === "QRIS" ? "active" : ""}
                onClick={() => setHistoryPaymentFilter("QRIS")}
              >
                QRIS
              </button>
            </div>
          </div>

          <div className="pos-audit-filter-block">
            <span>Status</span>
            <div className="pos-audit-pill-group">
              <button
                className={historyStatusFilter === "ALL" ? "active" : ""}
                onClick={() => setHistoryStatusFilter("ALL")}
              >
                Semua
              </button>
              <button
                className={historyStatusFilter === "DONE" ? "active" : ""}
                onClick={() => setHistoryStatusFilter("DONE")}
              >
                Selesai
              </button>
              <button
                className={historyStatusFilter === "COOKING" ? "active" : ""}
                onClick={() => setHistoryStatusFilter("COOKING")}
              >
                Dapur
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tabel Histori & Audit Desktop / Tablet */}
      <div className="pos-history-table-wrapper">
        <table className="pos-history-table">
          <colgroup>
            <col className="pos-history-col-order" />
            <col className="pos-history-col-cashier" />
            <col className="pos-history-col-items" />
            <col className="pos-history-col-payment" />
            <col className="pos-history-col-status" />
            <col className="pos-history-col-total" />
            <col className="pos-history-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th>Pesanan</th>
              <th>Kasir Penanggung Jawab</th>
              <th>Ringkasan Menu</th>
              <th>Pembayaran</th>
              <th>Status</th>
              <th>Total Transaksi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistoryOrders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "48px 20px" }}>
                  <div style={{ color: "#64748b", fontWeight: 750, fontSize: "14px" }}>
                    Tidak ada transaksi histori yang cocok dengan filter.
                  </div>
                </td>
              </tr>
            ) : (
              filteredHistoryOrders.map((order) => {
                const cashier = getOrderCashier(order, shift?.cashierName);
                const orderTime = new Date(order.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const orderDate = new Date(order.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                });
                const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
                const itemsSummary = order.items.map((i) => `${i.qty}× ${i.nama_menu}`).join(", ");

                return (
                  <tr key={order.id}>
                    <td>
                      <div className="pos-history-order-cell">
                        <div className="pos-audit-queue">
                          <strong>#{String(order.nomor_antrean).padStart(3, "0")}</strong>
                          <small>{orderDate} · {orderTime}</small>
                        </div>
                        <span className="pos-audit-table-tag">
                          {order.table_number === "Kasir" ? "Kasir / Take away" : `Meja ${order.table_number}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="pos-audit-cashier-badge" title={`Kasir penanggung jawab: ${cashier}`}>
                        <span className="pos-cashier-avatar">{getCashierInitials(cashier)}</span>
                        <span className="pos-cashier-text">{cashier}</span>
                      </div>
                    </td>
                    <td>
                      <div className="pos-audit-items-desc" title={itemsSummary}>
                        <b>{itemsSummary || "Pesanan"}</b>
                        <small>{itemCount} total item dipesan</small>
                      </div>
                    </td>
                    <td>
                      <span className={`pos-audit-pay-pill ${order.payment_method.toLowerCase()}`}>
                        {order.payment_method === "CASH" ? "💵 TUNAI" : "📱 QRIS"}
                      </span>
                    </td>
                    <td>
                      <span className={`pos-audit-status-pill ${order.status_pesanan.toLowerCase()}`}>
                        {order.status_pesanan === "DONE"
                          ? "Selesai"
                          : order.status_pesanan === "READY"
                          ? "Siap Diantar"
                          : order.status_pesanan === "COOKING"
                          ? "Disiapkan"
                          : order.status_pesanan === "AWAITING_CONFIRMATION"
                          ? "Menunggu"
                          : order.status_pesanan === "REJECTED"
                          ? "Ditolak"
                          : order.status_pesanan}
                      </span>
                    </td>
                    <td className="pos-audit-total-cell">
                      Rp {Number(order.total_harga).toLocaleString("id-ID")}
                    </td>
                    <td>
                      <button
                        className="pos-audit-action-btn"
                        onClick={() => setSelected(order)}
                        title="Lihat detail pesanan dan audit"
                      >
                        Detail Struk
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Tampilan Mobile: Kartu Transaksi Adaptif Tanpa Scroll Horizontal */}
      <div className="pos-history-mobile-list" aria-label="Daftar transaksi histori mobile">
        <div className="pos-history-list-heading">
          <div>
            <strong>Daftar transaksi</strong>
            <small>Ketuk kartu untuk melihat detail struk</small>
          </div>
          <span>{filteredHistoryOrders.length}</span>
        </div>
        {filteredHistoryOrders.length === 0 ? (
          <div className="pos-history-mobile-empty">
            <span className="pos-hme-icon">🔍</span>
            <strong>Tidak ada transaksi</strong>
            <p>Tidak ada riwayat transaksi yang cocok dengan filter atau kata kunci pencarian.</p>
          </div>
        ) : (
          filteredHistoryOrders.map((order) => {
            const cashier = getOrderCashier(order, shift?.cashierName);
            const orderTime = new Date(order.created_at).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const orderDate = new Date(order.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
            });
            const itemCount = order.items.reduce((s, i) => s + i.qty, 0);
            const itemsSummary = order.items.map((i) => `${i.qty}× ${i.nama_menu}`).join(", ");
            const statusLabel =
              order.status_pesanan === "DONE"
                ? "Selesai"
                : order.status_pesanan === "READY"
                ? "Siap Diantar"
                : order.status_pesanan === "COOKING"
                ? "Disiapkan"
                : order.status_pesanan === "AWAITING_CONFIRMATION"
                ? "Menunggu"
                : order.status_pesanan === "REJECTED"
                ? "Ditolak"
                : order.status_pesanan;

            return (
              <article
                key={`mobile-${order.id}`}
                className="pos-history-mobile-card"
                onClick={() => setSelected(order)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(order);
                  }
                }}
              >
                <header className="pos-hm-header">
                  <div className="pos-hm-queue-wrap">
                    <strong className="pos-hm-queue-num">#{String(order.nomor_antrean).padStart(3, "0")}</strong>
                    <span className="pos-hm-table-tag">
                      {order.table_number === "Kasir" ? "Take away / Kasir" : `Meja ${order.table_number}`}
                    </span>
                  </div>
                  <span className={`pos-audit-status-pill ${order.status_pesanan.toLowerCase()}`}>
                    {statusLabel}
                  </span>
                </header>

                <div className="pos-hm-items-wrap">
                  <p className="pos-hm-items-text">{itemsSummary || "Pesanan"}</p>
                  <small className="pos-hm-items-count">{itemCount} total item dipesan</small>
                </div>

                <div className="pos-hm-meta-row">
                  <div className="pos-hm-cashier-badge">
                    <span className="pos-cashier-avatar">{getCashierInitials(cashier)}</span>
                    <span className="pos-hm-cashier-name">{cashier}</span>
                  </div>
                  <span className="pos-hm-time">{orderDate} · {orderTime}</span>
                </div>

                <footer className="pos-hm-footer">
                  <span className={`pos-audit-pay-pill ${order.payment_method.toLowerCase()}`}>
                    {order.payment_method === "CASH" ? "💵 TUNAI" : "📱 QRIS"}
                  </span>
                  <div className="pos-hm-amount-action">
                    <strong className="pos-hm-amount">
                      Rp {Number(order.total_harga).toLocaleString("id-ID")}
                    </strong>
                    <span className="pos-hm-detail-link">
                      Detail <span>→</span>
                    </span>
                  </div>
                </footer>
              </article>
            );
          })
        )}
      </div>
    </main>}

    {/* Popup Modal Filter Rentang Waktu (Omzet Card & Toolbar) */}
    {dateModalOpen && (
      <div className="ops-modal-backdrop" onClick={() => setDateModalOpen(false)}>
        <section className="pos-filter-modal" onClick={(e) => e.stopPropagation()}>
          <button className="ops-modal-close" onClick={() => setDateModalOpen(false)} aria-label="Tutup">
            ×
          </button>
          <div className="pos-filter-modal-header">
            <small>FILTER AUDIT OMZET</small>
            <h2>Pilih Periode Waktu</h2>
            <p>Filter ringkasan omzet dan daftar transaksi berdasarkan kurun waktu tertentu.</p>
          </div>

          <div className="pos-filter-preset-grid">
            <button
              type="button"
              className={`pos-preset-option ${historyDateFilter.mode === "today" ? "active" : ""}`}
              onClick={() => {
                setHistoryDateFilter({ mode: "today" });
                setDateModalOpen(false);
              }}
            >
              <b>Hari Ini</b>
              <span>Transaksi hari ini</span>
            </button>

            <button
              type="button"
              className={`pos-preset-option ${historyDateFilter.mode === "this_week" ? "active" : ""}`}
              onClick={() => {
                setHistoryDateFilter({ mode: "this_week" });
                setDateModalOpen(false);
              }}
            >
              <b>Minggu Ini</b>
              <span>Senin s/d Minggu ini</span>
            </button>

            <button
              type="button"
              className={`pos-preset-option ${historyDateFilter.mode === "this_month" ? "active" : ""}`}
              onClick={() => {
                setHistoryDateFilter({ mode: "this_month" });
                setDateModalOpen(false);
              }}
            >
              <b>Bulan Ini</b>
              <span>Bulan berjalan saat ini</span>
            </button>

            <button
              type="button"
              className={`pos-preset-option ${historyDateFilter.mode === "this_year" ? "active" : ""}`}
              onClick={() => {
                setHistoryDateFilter({ mode: "this_year" });
                setDateModalOpen(false);
              }}
            >
              <b>Tahun Ini</b>
              <span>Tahun {new Date().getFullYear()}</span>
            </button>
          </div>

          <div className={`pos-custom-range-card ${historyDateFilter.mode === "custom" ? "active" : ""}`}>
            <h3>
              <span>📅</span>
              <span>Filter Custom Berdasarkan Tanggal</span>
            </h3>
            <div className="pos-custom-date-grid">
              <div className="pos-date-field">
                <label>Dari Tanggal</label>
                <input
                  type="date"
                  value={tempCustomStart}
                  onChange={(e) => setTempCustomStart(e.target.value)}
                />
              </div>
              <div className="pos-date-field">
                <label>Sampai Tanggal</label>
                <input
                  type="date"
                  value={tempCustomEnd}
                  onChange={(e) => setTempCustomEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="pos-filter-modal-actions">
            <button
              type="button"
              className="pos-filter-btn-cancel"
              onClick={() => {
                setHistoryDateFilter({ mode: "all" });
                setDateModalOpen(false);
              }}
            >
              Reset (Semua Waktu)
            </button>
            <button
              type="button"
              className="pos-filter-btn-apply"
              onClick={applyCustomDateRange}
            >
              Terapkan Tanggal
            </button>
          </div>
        </section>
      </div>
    )}

    {/* Modal Input PIN Akses Audit */}
    {pinModalOpen && (
      <div className="ops-modal-backdrop">
        <section className={`pos-pin-modal ${pinShaking ? "shake" : ""}`}>
          <button
            className="ops-modal-close"
            onClick={() => {
              setPinModalOpen(false);
              setPinError("");
              setPinInput("");
            }}
          >
            ×
          </button>

          <div className="pos-pin-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 className="pos-pin-title">Akses Terproteksi</h2>
          <p className="pos-pin-desc">
            Halaman Histori &amp; Rekap Audit dikunci. Masukkan PIN keamanan Owner untuk membuka akses.
          </p>

          <form onSubmit={verifyAuditPin}>
            {/* Indikator Titik PIN */}
            <div className="pos-pin-dots">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={index}
                  className={`pos-pin-dot ${index < pinInput.length ? "filled" : ""}`}
                />
              ))}
            </div>

            {pinError && (
              <div className="pos-pin-error">
                <span>⚠️</span>
                <span>{pinError}</span>
              </div>
            )}

            {/* Tombol Numpad Layar Sentuh / Tablet / POS */}
            <div className="pos-pin-numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  className="pos-pin-num-btn"
                  onClick={() => {
                    if (pinInput.length < 6) {
                      const next = pinInput + String(num);
                      setPinInput(next);
                      setPinError("");
                      if (next.length === 6) {
                        void verifyAuditPin(undefined, next);
                      }
                    }
                  }}
                  disabled={pinChecking}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="pos-pin-num-btn special"
                onClick={() => {
                  setPinInput("");
                  setPinError("");
                }}
                disabled={pinChecking || !pinInput}
              >
                Reset
              </button>
              <button
                type="button"
                className="pos-pin-num-btn"
                onClick={() => {
                  if (pinInput.length < 6) {
                    const next = pinInput + "0";
                    setPinInput(next);
                    setPinError("");
                    if (next.length === 6) {
                      void verifyAuditPin(undefined, next);
                    }
                  }
                }}
                disabled={pinChecking}
              >
                0
              </button>
              <button
                type="button"
                className="pos-pin-num-btn special"
                onClick={() => {
                  setPinInput((prev) => prev.slice(0, -1));
                  setPinError("");
                }}
                disabled={pinChecking || !pinInput}
              >
                ⌫ Hapus
              </button>
            </div>

            <div className="pos-pin-actions">
              <button
                type="button"
                className="pos-pin-btn-cancel"
                onClick={() => {
                  setPinModalOpen(false);
                  setPinError("");
                  setPinInput("");
                }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={pinChecking || pinInput.length < 4}
                className="pos-pin-btn-submit"
              >
                {pinChecking ? "Memeriksa..." : "Buka Akses →"}
              </button>
            </div>
          </form>
        </section>
      </div>
    )}

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
