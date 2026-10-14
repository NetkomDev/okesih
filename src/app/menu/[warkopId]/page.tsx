"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Menu = { id: string; nama: string; harga: number; kategori: string; desc_menu: string | null };
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

function ToscaBatikOrnament() {
  return (
    <div className="batik-tosca-badge" aria-label="Ornamen Batik Nusantara OKESIH">
      <svg className="batik-tosca-svg" viewBox="0 0 176 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="toscaCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#042f2e" />
            <stop offset="45%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="toscaGlowLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#99f6e4" stopOpacity="1" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.75" />
          </linearGradient>
          <pattern id="kawungPattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="8" r="1.3" fill="#99f6e4" opacity="0.65" />
            <path d="M8,0 C4.5,3 4.5,13 8,16 C11.5,13 11.5,3 8,0 Z" fill="none" stroke="#5eead4" strokeWidth="0.7" opacity="0.45" />
            <path d="M0,8 C3,4.5 13,4.5 16,8 C13,11.5 3,11.5 0,8 Z" fill="none" stroke="#5eead4" strokeWidth="0.7" opacity="0.45" />
            <circle cx="0" cy="0" r="1.4" fill="#2dd4bf" opacity="0.45" />
            <circle cx="16" cy="0" r="1.4" fill="#2dd4bf" opacity="0.45" />
            <circle cx="0" cy="16" r="1.4" fill="#2dd4bf" opacity="0.45" />
            <circle cx="16" cy="16" r="1.4" fill="#2dd4bf" opacity="0.45" />
          </pattern>
        </defs>
        <rect x="1" y="1" width="174" height="48" rx="14" fill="url(#toscaCardGrad)" stroke="url(#toscaGlowLine)" strokeWidth="1.2" />
        <rect x="2" y="2" width="172" height="46" rx="13" fill="url(#kawungPattern)" />
        <g transform="translate(24, 25)">
          <circle cx="0" cy="0" r="12" fill="#042f2e" stroke="#5eead4" strokeWidth="1.2" />
          <path d="M0,-10 C-3,-4 -3,4 0,10 C3,4 3,-4 0,-10 Z" fill="#2dd4bf" opacity="0.95" />
          <path d="M-10,0 C-4,-3 4,-3 10,0 C4,3 -4,3 -10,0 Z" fill="#2dd4bf" opacity="0.95" />
          <circle cx="0" cy="0" r="3" fill="#f0fdfa" />
        </g>
        <text x="45" y="22" fill="#99f6e4" fontSize="9" fontWeight="900" letterSpacing="0.14em">BATIK NUSANTARA</text>
        <text x="45" y="36" fill="#ffffff" fontSize="11.5" fontWeight="800" letterSpacing="0.03em">Cita Rasa Warkop</text>
        <g transform="translate(155, 25)">
          <circle cx="0" cy="0" r="6" fill="#0f766e" stroke="#99f6e4" strokeWidth="0.8" opacity="0.8" />
          <path d="M0,-5 C-1.5,-2 -1.5,2 0,5 C1.5,2 1.5,-2 0,-5 Z" fill="#5eead4" opacity="0.8" />
          <path d="M-5,0 C-2,-1.5 2,-1.5 5,0 C2,1.5 -2,1.5 -5,0 Z" fill="#5eead4" opacity="0.8" />
        </g>
      </svg>
    </div>
  );
}

function CustomerMenuContent() {
  const urlParams = useParams();
  const searchParams = useSearchParams();
  const warkopId = (urlParams?.warkopId as string) || "";
  const paramTableId = searchParams.get("tableId") || "";
  const paramTable = searchParams.get("table") || "";

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
  const [orderStatus, setOrderStatus] = useState("AWAITING_CONFIRMATION");
  const [customerToken, setCustomerToken] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!warkopId) return;
    fetch(`/api/public/menu/${encodeURIComponent(warkopId)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Menu gagal dimuat.");
        
        let matchedTable = body.tables.find((table: BusinessTable) => table.id === paramTableId)
          || body.tables.find((table: BusinessTable) => table.label === paramTable);

        if (!matchedTable && typeof window !== "undefined") {
          try {
            const cached = sessionStorage.getItem(`okesih_table_${warkopId}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              matchedTable = body.tables.find((table: BusinessTable) => table.id === parsed.id || table.label === parsed.label);
            }
          } catch {}
        }

        if (matchedTable && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(`okesih_table_${warkopId}`, JSON.stringify({ id: matchedTable.id, label: matchedTable.label }));
          } catch {}
        }

        setPayload(body);
        setTableId(matchedTable?.id || "");
        setTableNumber(matchedTable?.label || "");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Menu gagal dimuat."));
  }, [paramTable, paramTableId, warkopId]);

  useEffect(() => {
    if (!order || !customerToken) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/public/orders/${order.id}`, { headers: { Authorization: `Bearer ${customerToken}` }, cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json();
      setOrderStatus(body.order.status_pesanan);
      if (["DONE", "REJECTED", "VOID"].includes(body.order.status_pesanan)) window.clearInterval(timer);
    }, 4000);
    return () => window.clearInterval(timer);
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
      const response = await fetch("/api/public/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        slug: warkopId, tableId, paymentMethod, proofImage: paymentMethod === "QRIS" ? proofImage : null, idempotencyKey: crypto.randomUUID(),
        items: Object.values(cart).map((item) => ({ menuId: item.menu.id, qty: item.qty, notes: item.notes })),
      }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Pesanan gagal disimpan.");
      setOrder(body.order); setCustomerToken(body.customerToken); setCheckout(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pesanan gagal disimpan."); }
    finally { setBusy(false); }
  };

  if (!payload) return <div className="customer-loading" role="status" aria-label={error || "Menyiapkan menu"}><Image src="/logo.svg?v=2" width={64} height={64} alt="OKESIH"/></div>;
  if (order) return <main className="customer-order-status"><Image src="/logo.svg?v=2" width={64} height={64} alt="OKESIH"/><span>ANTREAN</span><strong>#{String(order.queueNumber).padStart(3, "0")}</strong><h1>{orderStatus === "AWAITING_CONFIRMATION" ? "Menunggu konfirmasi kasir" : orderStatus === "COOKING" ? "Pesanan sedang disiapkan" : orderStatus === "READY" ? "Pesanan siap diantar" : orderStatus === "DONE" ? "Pesanan selesai" : "Pesanan tidak dapat diproses"}</h1><p>Meja {formatTableNumber(tableNumber)} · {paymentMethod === "CASH" ? "Bayar tunai saat pesanan diantar" : "QRIS sedang diverifikasi"}</p><b>Rp {Number(order.total).toLocaleString("id-ID")}</b><button className="btn-secondary" onClick={() => { setOrder(null); setCart({}); setProofImage(null); }}>Pesan Tambahan</button></main>;

  return <div className="customer-menu-page">
    <header className="customer-menu-head">
      <div className="customer-header-ornament" aria-hidden="true">
        <img src="/ornamen-header-menu.svg" alt="" />
      </div>
      <div className="customer-brand-row">
        {payload.profile.logo_url ? <img className="customer-business-logo" src={payload.profile.logo_url} alt={`Logo ${payload.profile.nama}`} /> : <Image src="/logo.svg?v=2" width={40} height={40} alt="OKESIH" />}
        <div><small>MENU DIGITAL</small><h1>{payload.profile.nama}</h1></div>
      </div>
      <p>Pesan santai dari meja. Kami siapkan untuk Anda.</p>
      {tableId ? (
        <div className="customer-table-tag" aria-label={`Nomor Meja ${formatTableNumber(tableNumber)}`}>
          <span className="customer-table-tag-label">MEJA</span>
          <div className="customer-table-tag-box">
            <b>{formatTableNumber(tableNumber)}</b>
          </div>
        </div>
      ) : (
        <ToscaBatikOrnament />
      )}
    </header>
    {error && <div className="customer-error">{error}<button onClick={() => setError("")}>×</button></div>}
    <div className="customer-menu-tools">
      <label className="customer-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari menu favorit..." aria-label="Cari menu" />{search && <button onClick={() => setSearch("")} aria-label="Hapus pencarian">×</button>}</label>
      <nav className="customer-categories" aria-label="Kategori menu">{categories.map((category) => <button key={category} className={selectedCategory === category ? "active" : ""} onClick={() => setSelectedCategory(category)}>{category}</button>)}</nav>
    </div>
    <main className="customer-menu-list">{visibleMenus.length ? visibleMenus.map((menu) => { const qty = cart[menu.id]?.qty || 0; return <article key={menu.id} className={qty ? "selected" : ""}><div className="customer-menu-icon" aria-hidden="true">{categoryIcon(menu.kategori)}</div><div className="customer-menu-copy"><small>{menu.kategori}</small><h2>{menu.nama}</h2>{menu.desc_menu && <p>{menu.desc_menu}</p>}<b>Rp {Number(menu.harga).toLocaleString("id-ID")}</b></div><div className="customer-qty">{qty > 0 ? <><button aria-label={`Kurangi ${menu.nama}`} onClick={() => changeQty(menu, -1)}>−</button><strong>{qty}</strong><button aria-label={`Tambah ${menu.nama}`} onClick={() => changeQty(menu, 1)}>+</button></> : <button className="add" aria-label={`Tambah ${menu.nama}`} onClick={() => changeQty(menu, 1)}>+</button>}</div></article>; }) : <div className="customer-menu-empty"><span>⌕</span><b>Menu tidak ditemukan</b><p>Coba kata kunci atau kategori lainnya.</p></div>}</main>
    {count > 0 && <button className="customer-cart-bar" onClick={() => setCheckout(true)}><span className="customer-cart-count">{count}</span><span><small>Pesanan Anda</small><b>Rp {total.toLocaleString("id-ID")}</b></span><strong>Lihat pesanan <i>→</i></strong></button>}
    {checkout && <div className="customer-checkout-backdrop"><section className="customer-checkout"><header><div><small>RINGKASAN PESANAN</small><h2>Periksa pesanan Anda</h2><p>{tableNumber ? `Meja ${formatTableNumber(tableNumber)}` : "⚠️ Lokasi meja belum terdeteksi"}</p></div><button className="customer-close" onClick={() => setCheckout(false)} aria-label="Tutup">×</button></header><div className="customer-checkout-items">{Object.values(cart).map(({ menu, qty, notes }) => <div className="customer-checkout-item" key={menu.id}><div><b>{menu.nama}</b><span>Rp {(Number(menu.harga) * qty).toLocaleString("id-ID")}</span></div><div className="customer-checkout-qty"><button onClick={() => changeQty(menu, -1)}>−</button><strong>{qty}</strong><button onClick={() => changeQty(menu, 1)}>+</button></div><input value={notes} onChange={(event) => changeNote(menu.id, event.target.value)} placeholder="Catatan, mis. tanpa gula" maxLength={300} /></div>)}</div><div className="customer-payment"><button className={paymentMethod === "QRIS" ? "active" : ""} onClick={() => setPaymentMethod("QRIS")}><span>▣</span> QRIS</button><button className={paymentMethod === "CASH" ? "active" : ""} onClick={() => setPaymentMethod("CASH")}><span>●</span> Tunai</button></div>{paymentMethod === "QRIS" && <div className="customer-qris">{payload.profile.qris_image_url && <img src={payload.profile.qris_image_url} alt={`QRIS ${payload.profile.qris_merchant_name || payload.profile.nama}`}/>}<b>{payload.profile.qris_merchant_name || payload.profile.nama}</b><label className="customer-proof-upload">Unggah bukti pembayaran<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readProof(event.target.files?.[0])}/></label>{proofImage && <span>✓ Bukti pembayaran siap dikirim</span>}</div>}<footer><div><small>Total pembayaran</small><strong>Rp {total.toLocaleString("id-ID")}</strong></div><button className="btn-primary" disabled={busy} onClick={() => void submitOrder()}>{busy ? "Menyimpan..." : (tableId ? "Kirim Pesanan →" : "Scan QR Meja untuk Memesan")}</button></footer></section></div>}
  </div>;
}

export default function CustomerMenuPage() {
  return (
    <Suspense fallback={<div className="customer-loading" role="status"><Image src="/logo.svg?v=2" width={64} height={64} alt="OKESIH"/></div>}>
      <CustomerMenuContent />
    </Suspense>
  );
}

