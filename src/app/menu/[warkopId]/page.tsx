"use client";

import Image from "next/image";
import { use, useEffect, useMemo, useState } from "react";

type Menu = { id: string; nama: string; harga: number; kategori: string; desc_menu: string | null };
type MenuPayload = { profile: { nama: string; slug: string; logo_url: string | null; qris_image_url: string | null; qris_merchant_name: string | null }; menus: Menu[]; tables: string[] };
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

export default function CustomerMenuPage({ params, searchParams }: { params: Promise<{ warkopId: string }>; searchParams: Promise<{ table?: string }> }) {
  const { warkopId } = use(params);
  const query = use(searchParams);
  const [payload, setPayload] = useState<MenuPayload | null>(null);
  const [tableNumber, setTableNumber] = useState(query.table || "");
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
    fetch(`/api/public/menu/${encodeURIComponent(warkopId)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Menu gagal dimuat.");
        setPayload(body);
        setTableNumber((current) => body.tables.includes(current) ? current : (body.tables[0] || ""));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Menu gagal dimuat."));
  }, [warkopId]);

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
    if (!tableNumber) return setError("Pilih meja terlebih dahulu.");
    if (paymentMethod === "QRIS" && !proofImage) return setError("Unggah bukti pembayaran QRIS terlebih dahulu.");
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/public/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        slug: warkopId, tableNumber, paymentMethod, proofImage: paymentMethod === "QRIS" ? proofImage : null, idempotencyKey: crypto.randomUUID(),
        items: Object.values(cart).map((item) => ({ menuId: item.menu.id, qty: item.qty, notes: item.notes })),
      }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Pesanan gagal disimpan.");
      setOrder(body.order); setCustomerToken(body.customerToken); setCheckout(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Pesanan gagal disimpan."); }
    finally { setBusy(false); }
  };

  if (!payload) return <div className="customer-loading"><Image src="/logo.svg?v=2" width={64} height={64} alt="OKESIH"/><b>{error || "Menyiapkan menu..."}</b></div>;
  if (order) return <main className="customer-order-status"><Image src="/logo.svg?v=2" width={64} height={64} alt="OKESIH"/><span>ANTREAN</span><strong>#{String(order.queueNumber).padStart(3, "0")}</strong><h1>{orderStatus === "AWAITING_CONFIRMATION" ? "Menunggu konfirmasi kasir" : orderStatus === "COOKING" ? "Pesanan sedang disiapkan" : orderStatus === "READY" ? "Pesanan siap diantar" : orderStatus === "DONE" ? "Pesanan selesai" : "Pesanan tidak dapat diproses"}</h1><p>Meja {tableNumber} · {paymentMethod === "CASH" ? "Bayar tunai saat pesanan diantar" : "QRIS sedang diverifikasi"}</p><b>Rp {Number(order.total).toLocaleString("id-ID")}</b><button className="btn-secondary" onClick={() => { setOrder(null); setCart({}); setProofImage(null); }}>Pesan Tambahan</button></main>;

  return <div className="customer-menu-page">
    <header className="customer-menu-head">
      <div className="customer-brand-row">
        {payload.profile.logo_url ? <img className="customer-business-logo" src={payload.profile.logo_url} alt={`Logo ${payload.profile.nama}`} /> : <Image src="/logo.svg?v=2" width={40} height={40} alt="OKESIH" />}
        <div><small>MENU DIGITAL</small><h1>{payload.profile.nama}</h1></div>
      </div>
      <p>Pesan santai dari meja. Kami siapkan untuk Anda.</p>
      <label className="customer-table-picker"><span>Lokasi pesanan</span><b>Meja</b><select aria-label="Pilih nomor meja" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)}><option value="" disabled>Pilih</option>{payload.tables.map((table) => <option key={table}>{table}</option>)}</select></label>
    </header>
    {error && <div className="customer-error">{error}<button onClick={() => setError("")}>×</button></div>}
    <div className="customer-menu-tools">
      <label className="customer-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari menu favorit..." aria-label="Cari menu" />{search && <button onClick={() => setSearch("")} aria-label="Hapus pencarian">×</button>}</label>
      <nav className="customer-categories" aria-label="Kategori menu">{categories.map((category) => <button key={category} className={selectedCategory === category ? "active" : ""} onClick={() => setSelectedCategory(category)}>{category}</button>)}</nav>
    </div>
    <main className="customer-menu-list">{visibleMenus.length ? visibleMenus.map((menu) => { const qty = cart[menu.id]?.qty || 0; return <article key={menu.id} className={qty ? "selected" : ""}><div className="customer-menu-icon" aria-hidden="true">{categoryIcon(menu.kategori)}</div><div className="customer-menu-copy"><small>{menu.kategori}</small><h2>{menu.nama}</h2>{menu.desc_menu && <p>{menu.desc_menu}</p>}<b>Rp {Number(menu.harga).toLocaleString("id-ID")}</b></div><div className="customer-qty">{qty > 0 ? <><button aria-label={`Kurangi ${menu.nama}`} onClick={() => changeQty(menu, -1)}>−</button><strong>{qty}</strong><button aria-label={`Tambah ${menu.nama}`} onClick={() => changeQty(menu, 1)}>+</button></> : <button className="add" aria-label={`Tambah ${menu.nama}`} onClick={() => changeQty(menu, 1)}>+</button>}</div></article>; }) : <div className="customer-menu-empty"><span>⌕</span><b>Menu tidak ditemukan</b><p>Coba kata kunci atau kategori lainnya.</p></div>}</main>
    {count > 0 && <button className="customer-cart-bar" onClick={() => setCheckout(true)}><span className="customer-cart-count">{count}</span><span><small>Pesanan Anda</small><b>Rp {total.toLocaleString("id-ID")}</b></span><strong>Lihat pesanan <i>→</i></strong></button>}
    {checkout && <div className="customer-checkout-backdrop"><section className="customer-checkout"><header><div><small>RINGKASAN PESANAN</small><h2>Periksa pesanan Anda</h2><p>Meja {tableNumber || "belum dipilih"}</p></div><button className="customer-close" onClick={() => setCheckout(false)} aria-label="Tutup">×</button></header><div className="customer-checkout-items">{Object.values(cart).map(({ menu, qty, notes }) => <div className="customer-checkout-item" key={menu.id}><div><b>{menu.nama}</b><span>Rp {(Number(menu.harga) * qty).toLocaleString("id-ID")}</span></div><div className="customer-checkout-qty"><button onClick={() => changeQty(menu, -1)}>−</button><strong>{qty}</strong><button onClick={() => changeQty(menu, 1)}>+</button></div><input value={notes} onChange={(event) => changeNote(menu.id, event.target.value)} placeholder="Catatan, mis. tanpa gula" maxLength={300} /></div>)}</div><div className="customer-payment"><button className={paymentMethod === "QRIS" ? "active" : ""} onClick={() => setPaymentMethod("QRIS")}><span>▣</span> QRIS</button><button className={paymentMethod === "CASH" ? "active" : ""} onClick={() => setPaymentMethod("CASH")}><span>●</span> Tunai</button></div>{paymentMethod === "QRIS" && <div className="customer-qris">{payload.profile.qris_image_url && <img src={payload.profile.qris_image_url} alt={`QRIS ${payload.profile.qris_merchant_name || payload.profile.nama}`}/>}<b>{payload.profile.qris_merchant_name || payload.profile.nama}</b><label className="customer-proof-upload">Unggah bukti pembayaran<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readProof(event.target.files?.[0])}/></label>{proofImage && <span>✓ Bukti pembayaran siap dikirim</span>}</div>}<footer><div><small>Total pembayaran</small><strong>Rp {total.toLocaleString("id-ID")}</strong></div><button className="btn-primary" disabled={busy} onClick={() => void submitOrder()}>{busy ? "Menyimpan..." : "Kirim Pesanan →"}</button></footer></section></div>}
  </div>;
}
