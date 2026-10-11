"use client";

import Link from "next/link";
import { useState, use } from "react";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  desc: string;
}

const SAMPLE_MENUS: MenuItem[] = [
  { id: "1", name: "Kopi Hitam Tubruk Giras", price: 5000, category: "Kopi", desc: "Robusta giling halus diseduh air mendidih kental khas warkop." },
  { id: "2", name: "Kopi Susu Panas Legendaris", price: 7000, category: "Kopi", desc: "Susu kental manis berpadu espresso tubruk aroma sedap." },
  { id: "3", name: "Es Teh Manis Jumbo", price: 5000, category: "Dingin", desc: "Teh melati wangi dingin segar porsi gelas besar." },
  { id: "4", name: "Extra Joss Susu Dingin", price: 8000, category: "Dingin", desc: "Minuman energi segar dicampur susu dan es batu kristal." },
  { id: "5", name: "Indomie Goreng + Telur", price: 12000, category: "Makanan", desc: "Indomie goreng dengan topping telur dan sawi hijau." },
  { id: "6", name: "Indomie Kuah Kari Dobel Telur", price: 16000, category: "Makanan", desc: "Kuah kari kental dengan 2 butir telur setengah matang." },
  { id: "7", name: "Roti Bakar Coklat Keju", price: 10000, category: "Camilan", desc: "Roti tawar tebal panggang mentega dengan meses dan parutan keju." },
  { id: "8", name: "Gorengan Tempe / Bakwan (3 Pcs)", price: 5000, category: "Camilan", desc: "Gorengan renyah hangat disajikan dengan cabai rawit hijau." },
];

interface CartItem {
  menu: MenuItem;
  qty: number;
  notes: string;
}

export default function CustomerMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ warkopId: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);

  const warkopId = resolvedParams.warkopId;
  const initialTable = resolvedSearchParams.table || "01";

  const [tableNumber, setTableNumber] = useState<string>(initialTable);
  const [isSelectingTable, setIsSelectingTable] = useState<boolean>(false);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderSent, setOrderSent] = useState<boolean>(false);

  // Cart calculations
  const totalItems = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = Object.values(cart).reduce((sum, item) => sum + item.qty * item.menu.price, 0);

  const addToCart = (menu: MenuItem) => {
    setCart((prev) => {
      const existing = prev[menu.id];
      if (existing) {
        return {
          ...prev,
          [menu.id]: { ...existing, qty: existing.qty + 1 },
        };
      }
      return {
        ...prev,
        [menu.id]: { menu, qty: 1, notes: "" },
      };
    });
  };

  const removeFromCart = (menuId: string) => {
    setCart((prev) => {
      const existing = prev[menuId];
      if (!existing) return prev;
      if (existing.qty <= 1) {
        const copy = { ...prev };
        delete copy[menuId];
        return copy;
      }
      return {
        ...prev,
        [menuId]: { ...existing, qty: existing.qty - 1 },
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProofImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitOrder = () => {
    if (!proofImage) {
      alert("Harap unggah screenshot bukti transfer QRIS terlebih dahulu!");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOrderSent(true);
      setIsCheckoutOpen(false);
    }, 1200);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-deep-black)", color: "#FFF", paddingBottom: "6rem" }}>
      {/* Top Banner Warkop */}
      <header
        style={{
          padding: "1.5rem 1.25rem",
          background: "linear-gradient(180deg, rgba(255, 69, 0, 0.3) 0%, rgba(13, 13, 14, 0) 100%)",
          borderBottom: "1px solid var(--border-subtle)",
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="badge badge-ready">● Warkop Buka</span>
              <button
                onClick={() => setIsSelectingTable(true)}
                style={{
                  background: "rgba(255, 69, 0, 0.2)",
                  border: "1px solid rgba(255, 69, 0, 0.5)",
                  color: "var(--brand-orange-light)",
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  padding: "0.25rem 0.65rem",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                📍 Meja #{tableNumber} (Ubah)
              </button>
            </div>
            <Link href="/" style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Beranda
            </Link>
          </div>

          <h1 style={{ fontSize: "1.45rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
            Warkop {warkopId.replace(/-/g, " ").toUpperCase()}
          </h1>
          <p style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
            Pesan &amp; bayar QRIS langsung dari mejamu. Barista segera meracik begitu kasir mengonfirmasi!
          </p>
        </div>
      </header>

      {/* Modal Pemilihan Meja */}
      {isSelectingTable && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div className="glass-panel" style={{ maxWidth: "400px", width: "100%", padding: "1.75rem" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem" }}>Pilih Nomor Meja Anda</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
              Pastikan sesuai stiker nomor meja tempat Anda duduk.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem", marginBottom: "1.5rem" }}>
              {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setTableNumber(num);
                    setIsSelectingTable(false);
                  }}
                  className={tableNumber === num ? "btn-primary" : "btn-secondary"}
                  style={{ padding: "0.75rem 0", fontSize: "0.95rem", fontWeight: 800 }}
                >
                  {num}
                </button>
              ))}
            </div>
            <button onClick={() => setIsSelectingTable(false)} className="btn-secondary" style={{ width: "100%" }}>
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Screen Jika Pesanan Sedang Diproses */}
      {orderSent && (
        <div style={{ maxWidth: "600px", margin: "1.5rem auto", padding: "0 1rem" }}>
          <div className="glass-panel-glow" style={{ padding: "2rem", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "1rem" }}>🔔</div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--brand-orange-light)", marginBottom: "0.5rem" }}>
              Pesanan Terkirim ke Kasir!
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Alarm kasir sedang berdering. Kasir sedang memvalidasi bukti pembayaran QRIS Anda.
              Setelah dikonfirmasi, barista akan meracik dan waiters mengantar ke <strong>Meja #{tableNumber}</strong>!
            </p>
            <div className="glass-panel" style={{ padding: "1rem", marginBottom: "1.5rem", textAlign: "left", fontSize: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ color: "var(--text-dim)" }}>Tujuan Meja:</span>
                <strong>Meja #{tableNumber}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ color: "var(--text-dim)" }}>Total Transfer:</span>
                <strong>Rp {totalPrice.toLocaleString("id-ID")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-dim)" }}>Status Tiket:</span>
                <span className="badge badge-cooking">Menunggu Verifikasi Kasir</span>
              </div>
            </div>
            <button
              onClick={() => {
                setOrderSent(false);
                setCart({});
                setProofImage(null);
              }}
              className="btn-secondary"
              style={{ width: "100%" }}
            >
              + Buat Pesanan Baru / Tambahan
            </button>
          </div>
        </div>
      )}

      {/* Daftar Menu */}
      {!orderSent && (
        <main style={{ maxWidth: "600px", margin: "1rem auto", padding: "0 1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {SAMPLE_MENUS.map((menu) => {
            const inCartQty = cart[menu.id]?.qty || 0;
            return (
              <div
                key={menu.id}
                className="glass-panel"
                style={{
                  padding: "1.1rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.875rem",
                  border: inCartQty > 0 ? "1px solid rgba(255, 69, 0, 0.4)" : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--brand-orange-light)", fontWeight: 700 }}>
                      {menu.category}
                    </span>
                    {inCartQty > 0 && <span className="badge badge-ready">{inCartQty}x di keranjang</span>}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "0.25rem" }}>{menu.name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.4, marginBottom: "0.5rem" }}>
                    {menu.desc}
                  </div>
                  <div style={{ fontWeight: 800, color: "var(--brand-orange-light)", fontSize: "1.05rem" }}>
                    Rp {menu.price.toLocaleString("id-ID")}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {inCartQty > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <button
                        onClick={() => removeFromCart(menu.id)}
                        className="btn-secondary"
                        style={{ width: "34px", height: "34px", padding: 0, fontWeight: 800 }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 800, minWidth: "20px", textAlign: "center" }}>{inCartQty}</span>
                      <button
                        onClick={() => addToCart(menu)}
                        className="btn-primary"
                        style={{ width: "34px", height: "34px", padding: 0, fontWeight: 800 }}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(menu)}
                      className="btn-primary"
                      style={{ padding: "0.55rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                    >
                      + Tambah
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </main>
      )}

      {/* Floating Order Cart Bar */}
      {!orderSent && totalItems > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: "1rem",
            left: "1rem",
            right: "1rem",
            maxWidth: "580px",
            margin: "0 auto",
            padding: "0.875rem 1.25rem",
            borderRadius: "var(--radius-lg)",
            background: "linear-gradient(135deg, #1C1C21, #151518)",
            border: "1px solid rgba(255, 69, 0, 0.5)",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 50,
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Meja #{tableNumber} • {totalItems} Item
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFF" }}>
              Rp {totalPrice.toLocaleString("id-ID")}
            </div>
          </div>

          <button onClick={() => setIsCheckoutOpen(true)} className="btn-primary" style={{ padding: "0.75rem 1.5rem" }}>
            Lanjut Bayar QRIS →
          </button>
        </div>
      )}

      {/* Checkout Drawer: Tampilkan QRIS Warkop & Upload Bukti Pembayaran */}
      {isCheckoutOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "540px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "1.75rem",
              borderRadius: "24px 24px 0 0",
              borderTop: "2px solid var(--brand-orange-primary)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Bayar QRIS Warkop (Meja #{tableNumber})</h2>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Dana 100% langsung ke rekening warkop</div>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="btn-secondary"
                style={{ width: "32px", height: "32px", padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Total Pembayaran & QRIS Warkop Box */}
            <div
              style={{
                background: "var(--bg-surface-1)",
                borderRadius: "var(--radius-md)",
                padding: "1.25rem",
                textAlign: "center",
                border: "1px solid var(--border-subtle)",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total Yang Wajib Ditransfer:</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "var(--brand-orange-light)", margin: "0.25rem 0 1rem" }}>
                Rp {totalPrice.toLocaleString("id-ID")}
              </div>

              {/* Mock QRIS Statis Warkop */}
              <div
                style={{
                  width: "180px",
                  height: "180px",
                  margin: "0 auto 0.75rem",
                  backgroundColor: "#FFF",
                  borderRadius: "12px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#000", marginBottom: "4px" }}>
                  QRIS WARKOP KITA
                </div>
                <div style={{ width: "130px", height: "130px", background: "#000", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: "12px", textAlign: "center", padding: "8px" }}>
                  [SCAN QRIS WARKOP]
                </div>
                <div style={{ fontSize: "0.6rem", color: "#666", marginTop: "4px" }}>NMID: ID1029384756</div>
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                Buka BCA / Mandiri / GoPay / OVO / Dana &amp; scan kode di atas
              </div>
            </div>

            {/* Unggah Bukti Transfer */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, display: "block", marginBottom: "0.5rem" }}>
                📸 Unggah Screenshot Bukti Transfer (Wajib)
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                id="proof-upload"
                style={{ display: "none" }}
              />

              <label
                htmlFor="proof-upload"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "2px dashed rgba(255, 69, 0, 0.4)",
                  background: "var(--bg-surface-1)",
                  cursor: "pointer",
                }}
              >
                {proofImage ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.8rem", color: "#10B981", fontWeight: 700, marginBottom: "0.5rem" }}>
                      ✓ Bukti Transfer Siap Dikirim
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={proofImage}
                      alt="Preview Bukti"
                      style={{ maxHeight: "120px", borderRadius: "8px", objectFit: "contain" }}
                    />
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.5rem" }}>
                      Klik untuk ganti foto
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: "28px", marginBottom: "0.25rem" }}>📷</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>Pilih Foto Bukti Transfer</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Format JPG, PNG atau Screenshot</div>
                  </>
                )}
              </label>
            </div>

            {/* Tombol Kirim Pesanan */}
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting || !proofImage}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1rem",
                opacity: !proofImage ? 0.5 : 1,
                cursor: !proofImage ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Mengirim ke Kasir..." : `KIRIM PESANAN KE KASIR (MEJA #${tableNumber})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
