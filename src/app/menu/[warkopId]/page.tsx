"use client";
import { customerSessionStorage, readCustomerOrders, rememberCustomerOrder, resolveCustomerTable, type CustomerOrderSession } from "@/lib/customer-order-session";
import { orderIntentKey, completeOrderIntent } from "@/lib/order-intent";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import CustomerInstallCard from "@/components/CustomerInstallCard";
import "./customer-menu.css";

type Menu = { id: string; nama: string; harga: number; kategori: string; desc_menu: string | null; image_url?: string | null };
type BusinessTable = { id: string; label: string };
type MenuPayload = { profile: { nama: string; slug: string; logo_url: string | null; qris_image_url: string | null; qris_merchant_name: string | null }; menus: Menu[]; tables: BusinessTable[] };
type CartItem = { menu: Menu; qty: number; notes: string };
type OrderResult = { id: string; queueNumber: number; total: number };

function categoryIcon(category: string) {
  const value = category.toLowerCase();
  if (value.includes("kopi")) return "☕";
  if (value.includes("dingin") || value.includes("minum")) return "🥤";
  if (value.includes("makan")) return "🍽️";
  if (value.includes("camil") || value.includes("snack")) return "🥐";
  return "✦";
}

function formatTableNumber(label: string): string {
  if (!label) return "01";
  const trimmed = label.trim();
  const mejaMatch = trimmed.match(/^meja\s*(\d+)$/i);
  if (mejaMatch) {
    const num = parseInt(mejaMatch[1], 10);
    return num < 100 ? String(num).padStart(2, "0") : String(num);
  }
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    return num < 100 ? String(num).padStart(2, "0") : String(num);
  }
  return trimmed;
}

function CustomerMenuContent() {
  const urlParams = useParams();
  const searchParams = useSearchParams();
  const warkopId = (urlParams?.warkopId as string) || "";
  const paramTableId = searchParams.get("tableId") || searchParams.get("tid") || "";
  const paramTable = searchParams.get("t") || searchParams.get("table") || "";

  const explicitTable = ["tableId", "tid", "t", "table"].some(key => searchParams.has(key));
  const [savedOrders, setSavedOrders] = useState<CustomerOrderSession[]>([]);
  const [statusTable, setStatusTable] = useState("");
  const [statusPayment, setStatusPayment] = useState<"QRIS" | "CASH">("QRIS");
  const [payload, setPayload] = useState<MenuPayload | null>(null);
  const [tableId, setTableId] = useState(paramTableId);
  const [tableNumber, setTableNumber] = useState(paramTable);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [paymentMethod, setPaymentMethod] = useState<"QRIS" | "CASH">("QRIS");
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("AWAITING_CONFIRMATION");
  const [customerToken, setCustomerToken] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!warkopId) return;
    const controller = new AbortController();
    fetch(`/api/public/menu/${encodeURIComponent(warkopId)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Menu gagal dimuat.");
        if (controller.signal.aborted) return;
        
        let cachedTable = null;
        try { cachedTable = JSON.parse(sessionStorage.getItem(`okesih_table_${warkopId}`) || "null"); } catch {}
        const matchedTable = resolveCustomerTable(body.tables, { id: paramTableId, label: paramTable, explicit: explicitTable }, cachedTable);
        if (explicitTable && !matchedTable) setError("QR meja tidak valid atau meja sudah nonaktif. Silakan scan ulang QR meja.");

        if (matchedTable && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(`okesih_table_${warkopId}`, JSON.stringify({ id: matchedTable.id, label: matchedTable.label }));
          } catch {}
        }

        setPayload(body);
        setTableId(matchedTable?.id || "");
        setTableNumber(matchedTable?.label || "");
        const sessions = readCustomerOrders(customerSessionStorage(), warkopId);
        setSavedOrders(sessions);
        const recent = sessions.find(row => !explicitTable || row.tableId === matchedTable?.id);
        if (recent) {
          setOrder(recent.order); setCustomerToken(recent.token); setOrderStatus("LOADING"); setPaymentStatus("");
          setStatusTable(recent.tableNumber); setStatusPayment(recent.paymentMethod);
        } else {
          setOrder(null); setCustomerToken(""); setOrderStatus("AWAITING_CONFIRMATION"); setPaymentStatus("");
        }
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Menu gagal dimuat."); });
    return () => controller.abort();
  }, [paramTable, paramTableId, warkopId, explicitTable]);

  useEffect(() => {
    if (!order || !customerToken) return;
    const controller = new AbortController();
    let inFlight = false;
    let terminal = false;
    const poll = async () => {
      if (inFlight || terminal || !navigator.onLine) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/public/orders/${order.id}`, { headers: { Authorization: `Bearer ${customerToken}` }, cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Status pesanan belum dapat dimuat.");
        if (controller.signal.aborted) return;
        setError(""); setOrderStatus(body.order.status_pesanan); setPaymentStatus(body.order.payment_status || "");
        terminal = ["DONE", "REJECTED", "VOID"].includes(body.order.status_pesanan);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Koneksi terputus. Status akan diperiksa kembali.");
      } finally { inFlight = false; }
    };
    void poll();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void poll(); }, 4000);
    const foreground = () => { if (document.visibilityState === "visible") void poll(); };
    window.addEventListener("online", foreground); document.addEventListener("visibilitychange", foreground);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("online", foreground); document.removeEventListener("visibilitychange", foreground); };
  }, [customerToken, order]);

  const total = useMemo(() => Object.values(cart).reduce((sum, item) => sum + Number(item.menu.harga) * item.qty, 0), [cart]);
  const count = useMemo(() => Object.values(cart).reduce((sum, item) => sum + item.qty, 0), [cart]);
  const categories = useMemo(() => ["Semua", ...Array.from(new Set(payload?.menus.map((menu) => menu.kategori).filter(Boolean) || []))], [payload]);
  const visibleMenus = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return payload?.menus.filter((menu) =>
      (selectedCategory === "Semua" || menu.kategori === selectedCategory) &&
      (!keyword || menu.nama.toLowerCase().includes(keyword) || menu.desc_menu?.toLowerCase().includes(keyword))
    ) || [];
  }, [payload, search, selectedCategory]);
  const changeQty = (menu: Menu, delta: number) => setCart((current) => {
    const existing = current[menu.id];
    const qty = (existing?.qty || 0) + delta;
    if (qty <= 0) { const next = { ...current }; delete next[menu.id]; return next; }
    return { ...current, [menu.id]: { menu, qty, notes: existing?.notes || "" } };
  });
  const changeNote = (menuId: string, notes: string) => setCart((current) => current[menuId] ? ({ ...current, [menuId]: { ...current[menuId], notes } }) : current);

  const readProof = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError("Ukuran bukti pembayaran maksimal 2 MB.");
    const reader = new FileReader();
    reader.onload = () => setProofImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const submitOrder = async () => {
    if (!tableId) return setError("Silakan scan QR Code yang terpasang di meja Anda untuk mengirim pesanan.");
    if (paymentMethod === "QRIS" && !proofImage) return setError("Unggah bukti pembayaran QRIS terlebih dahulu.");
    setBusy(true); setError("");
    try {
      const input = {
        slug: warkopId, tableId, paymentMethod, proofImage: paymentMethod === "QRIS" ? proofImage : null,
        items: Object.values(cart).map((item) => ({ menuId: item.menu.id, qty: item.qty, notes: item.notes })),
      };
      const response = await fetch("/api/public/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, idempotencyKey: await orderIntentKey(localStorage, `customer:${warkopId}:${tableId}`, input) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Pesanan gagal disimpan.");
      setOrder(body.order); setCustomerToken(body.customerToken); setOrderStatus("AWAITING_CONFIRMATION"); setPaymentStatus("");
      setStatusTable(tableNumber); setStatusPayment(paymentMethod); setCheckout(false);
      setSavedOrders(rememberCustomerOrder(customerSessionStorage(), warkopId, {
        order: body.order, token: body.customerToken, tableId, tableNumber, paymentMethod, savedAt: Date.now(),
      }));
      completeOrderIntent(localStorage, `customer:${warkopId}:${tableId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pesanan gagal disimpan."); }
    finally { setBusy(false); }
  };

  if (!payload) return <div className="customer-loading" role="status"><Image src="/logo.svg?v=2" width={64} height={64} alt="OKESIH"/>{error && <p role="alert">{error}</p>}</div>;
  if (order) return (
    <main className="customer-order-status">
      <Image src="/logo.svg?v=2" width={64} height={64} alt="OKESIH"/>
      <span>ANTREAN</span>
      <strong>#{String(order.queueNumber).padStart(3, "0")}</strong>
      <h1>{orderStatus === "LOADING" ? "Memeriksa status pesanan" : orderStatus === "AWAITING_CONFIRMATION" ? "Menunggu konfirmasi kasir" : orderStatus === "COOKING" ? "Pesanan sedang disiapkan" : orderStatus === "READY" ? "Pesanan siap diantar" : orderStatus === "DONE" ? "Pesanan selesai" : "Pesanan tidak dapat diproses"}</h1>
      <p>Meja {formatTableNumber(statusTable)} · {statusPayment === "CASH" ? (paymentStatus === "PAID" ? "Pembayaran tunai sudah dicatat kasir" : "Bayar tunai saat pesanan diantar") : ["COOKING", "READY", "DONE"].includes(orderStatus) ? "QRIS dikonfirmasi kasir" : ["REJECTED", "VOID"].includes(orderStatus) ? "Hubungi kasir untuk pemeriksaan pembayaran QRIS" : "QRIS sedang diverifikasi"}</p>
      <b>Rp {Number(order.total).toLocaleString("id-ID")}</b>
      {error && <p role="alert">{error}</p>}
      <button className="btn-secondary" onClick={() => { setOrder(null); setCustomerToken(""); setOrderStatus("AWAITING_CONFIRMATION"); setPaymentStatus(""); setCart({}); setProofImage(null); setError(""); }}>Pesan Sekarang</button>
      <CustomerInstallCard />
    </main>
  );

  return <div className="customer-menu-page">
    <header className="customer-menu-head">
      <div className="customer-header-ornament" aria-hidden="true">
        <img src="/ornamen-header-menu.svg" alt="" />
      </div>
      <div className="customer-brand-row">
        {payload.profile.logo_url ? <img className="customer-business-logo" src={payload.profile.logo_url} alt={`Logo ${payload.profile.nama}`} /> : <Image src="/logo.svg?v=2" width={40} height={40} alt="OKESIH" />}
        <div><small>MENU DIGITAL</small><h1>{payload.profile.nama}</h1></div>
      </div>
      <p>Pesan santai langsung dari tempat Anda. Kami siapkan untuk Anda.</p>
      {tableId && (
        <div className="customer-table-tag" aria-label={`Nomor ${tableNumber}`}>
          <div className="customer-table-tag-box">
            <b>{tableNumber}</b>
          </div>
        </div>
      )}
    </header>
    {error && <div className="customer-error">{error}<button onClick={() => setError("")}>×</button></div>}
    {savedOrders.length > 0 && <nav aria-label="Pesanan sebelumnya" style={{ padding: "12px" }}>
      {savedOrders.map(saved => <button className="btn-secondary" key={saved.order.id} onClick={() => {
        setOrder(saved.order); setCustomerToken(saved.token); setOrderStatus("LOADING"); setPaymentStatus("");
        setStatusTable(saved.tableNumber); setStatusPayment(saved.paymentMethod); setError("");
      }}>Lihat pesanan #{saved.order.queueNumber} · Meja {saved.tableNumber}</button>)}
    </nav>}
    <div className="customer-menu-tools">
      <label className="customer-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari menu favorit..." aria-label="Cari menu" />{search && <button onClick={() => setSearch("")} aria-label="Hapus pencarian">×</button>}</label>
      <nav className="customer-categories" aria-label="Kategori menu">{categories.map((category) => <button key={category} className={selectedCategory === category ? "active" : ""} onClick={() => setSelectedCategory(category)}>{category}</button>)}</nav>
    </div>
    <main className="customer-menu-list">{visibleMenus.length ? visibleMenus.map((menu) => { const qty = cart[menu.id]?.qty || 0; return <article key={menu.id} className={qty ? "selected" : ""}><div className="customer-menu-icon">{menu.image_url ? <img src={menu.image_url} alt={menu.nama} loading="lazy" decoding="async" className="customer-menu-photo" /> : <span aria-hidden="true">{categoryIcon(menu.kategori)}</span>}</div><div className="customer-menu-copy"><small>{menu.kategori}</small><h2>{menu.nama}</h2>{menu.desc_menu && <p>{menu.desc_menu}</p>}<b>Rp {Number(menu.harga).toLocaleString("id-ID")}</b></div><div className="customer-qty">{qty > 0 ? <><button aria-label={`Kurangi ${menu.nama}`} onClick={() => changeQty(menu, -1)}>−</button><strong>{qty}</strong><button aria-label={`Tambah ${menu.nama}`} onClick={() => changeQty(menu, 1)}>+</button></> : <button className="add" aria-label={`Tambah ${menu.nama}`} onClick={() => changeQty(menu, 1)}>+</button>}</div></article>; }) : <div className="customer-menu-empty"><span>⌕</span><b>Menu tidak ditemukan</b><p>Coba kata kunci atau kategori lainnya.</p></div>}</main>
    {count > 0 && (
      <button className="customer-cart-bar" onClick={() => setCheckout(true)} aria-label="Lihat ringkasan pesanan">
        <div className="customer-cart-info">
          <span className="customer-cart-count">{count}</span>
          <div className="customer-cart-details">
            <small>Pesanan Anda</small>
            <b>Rp {total.toLocaleString("id-ID")}</b>
          </div>
        </div>
        <strong className="customer-cart-btn">
          <span>Pesan</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </strong>
      </button>
    )}
    {checkout && <div className="customer-checkout-backdrop"><section className="customer-checkout"><header><div><small>RINGKASAN PESANAN</small><h2>Periksa pesanan Anda</h2><p>{tableNumber ? `${tableNumber}` : "⚠️ Lokasi belum terdeteksi"}</p></div><button className="customer-close" onClick={() => setCheckout(false)} aria-label="Tutup">×</button></header><div className="customer-checkout-items">{Object.values(cart).map(({ menu, qty, notes }) => <div className="customer-checkout-item" key={menu.id}><div><b>{menu.nama}</b><span>Rp {(Number(menu.harga) * qty).toLocaleString("id-ID")}</span></div><div className="customer-checkout-qty"><button onClick={() => changeQty(menu, -1)}>−</button><strong>{qty}</strong><button onClick={() => changeQty(menu, 1)}>+</button></div><input value={notes} onChange={(event) => changeNote(menu.id, event.target.value)} placeholder="Catatan, mis. tanpa gula" maxLength={300} /></div>)}</div><div className="customer-payment"><button className={paymentMethod === "QRIS" ? "active" : ""} onClick={() => setPaymentMethod("QRIS")}><span>▣</span> QRIS</button><button className={paymentMethod === "CASH" ? "active" : ""} onClick={() => setPaymentMethod("CASH")}><span>●</span> Tunai</button></div>{paymentMethod === "QRIS" && <div className="customer-qris">{payload.profile.qris_image_url && <img src={payload.profile.qris_image_url} alt={`QRIS ${payload.profile.qris_merchant_name || payload.profile.nama}`}/>}<b>{payload.profile.qris_merchant_name || payload.profile.nama}</b><label className="customer-proof-upload">Unggah bukti pembayaran<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readProof(event.target.files?.[0])}/></label>{proofImage && <span>✓ Bukti pembayaran siap dikirim</span>}</div>}<footer><div><small>Total pembayaran</small><strong>Rp {total.toLocaleString("id-ID")}</strong></div><button className="btn-primary" disabled={busy} onClick={() => void submitOrder()}>{busy ? "Menyimpan..." : (tableId ? <span className="customer-btn-submit-inner"><span>Kirim Pesanan</span><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg></span> : "Scan QR Meja untuk Memesan")}</button></footer></section></div>}
  </div>;
}

export default function CustomerMenuPage() {
  return (
    <Suspense fallback={<div className="customer-loading" role="status"><Image src="/logo.svg?v=2" width={64} height={64} alt="OKESIH"/></div>}>
      <CustomerMenuContent />
    </Suspense>
  );
}
