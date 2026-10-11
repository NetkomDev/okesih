"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

interface IncomingTableOrder {
  id: string;
  tableNumber: string;
  customerName: string;
  items: { name: string; qty: number; notes: string; price: number }[];
  totalPrice: number;
  paymentMethod: "QRIS_WARKOP";
  proofUrl: string;
  createdAt: string;
}

export default function PosModulePage() {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState<boolean>(false);
  const [selectedAuditOrder, setSelectedAuditOrder] = useState<IncomingTableOrder | null>(null);

  // Incoming orders from table QR scans awaiting cashier payment confirmation
  const [incomingOrders, setIncomingOrders] = useState<IncomingTableOrder[]>([
    {
      id: "ord-meja-05",
      tableNumber: "05",
      customerName: "Budi (Meja 05)",
      items: [
        { name: "Kopi Susu Panas Legendaris", qty: 2, notes: "Gula aren sedikit", price: 7000 },
        { name: "Indomie Goreng + Telur", qty: 1, notes: "Pedas, sawi banyak", price: 12000 },
      ],
      totalPrice: 26000,
      paymentMethod: "QRIS_WARKOP",
      proofUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'><rect width='300' height='200' fill='%231F2937'/><text x='50%25' y='40%25' dominant-baseline='middle' text-anchor='middle' fill='%2310B981' font-size='16' font-weight='bold'>BUKTI TRANSFER QRIS</text><text x='50%25' y='60%25' dominant-baseline='middle' text-anchor='middle' fill='%23FFFFFF' font-size='18' font-weight='bold'>Rp 26.000 (BERHASIL)</text><text x='50%25' y='80%25' dominant-baseline='middle' text-anchor='middle' fill='%239CA3AF' font-size='12'>BCA Mobile - Hari Ini</text></svg>",
      createdAt: "1 Menit lalu",
    },
  ]);

  // Audio Context Ref for Loud Alarm Synthesizer (Works completely offline, zero audio asset files needed!)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const enableAudio = () => {
    if (typeof window !== "undefined") {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
        if (audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume();
        }
      }
      setAudioEnabled(true);
    }
  };

  // Play beep/siren sound using Web Audio API
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio playback fallback
    }
  };

  // Trigger looping loud alarm if there are incoming unconfirmed orders
  useEffect(() => {
    if (incomingOrders.length > 0 && audioEnabled) {
      setIsAlarmPlaying(true);
      if (!alarmIntervalRef.current) {
        playBeep();
        alarmIntervalRef.current = setInterval(() => {
          playBeep();
        }, 800);
      }
    } else {
      setIsAlarmPlaying(false);
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    }

    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
      }
    };
  }, [incomingOrders, audioEnabled]);

  const handleConfirmPayment = (orderId: string) => {
    setIncomingOrders((prev) => prev.filter((o) => o.id !== orderId));
    setSelectedAuditOrder(null);
    alert("✓ Pesanan Dikonfirmasi! Tiket otomatis diteruskan ke Dapur (KDS) dan Layar Antrean TV.");
  };

  const handleRejectOrder = (orderId: string) => {
    setIncomingOrders((prev) => prev.filter((o) => o.id !== orderId));
    setSelectedAuditOrder(null);
    alert("❌ Pesanan Ditolak (Bukti pembayaran tidak sesuai). Alarm dihentikan.");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-deep-black)" }}>
      {/* Top Bar Kasir */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/" style={{ fontSize: "1.2rem", fontWeight: 800 }}>
            ☕ OKESIH <span style={{ color: "var(--brand-orange-light)" }}>POS KASIR</span>
          </Link>
          <span className="badge badge-ready">● PWA Online</span>

          {/* Alarm Audio Toggle Button (Essential for Browser Autoplay Policy) */}
          {!audioEnabled ? (
            <button
              onClick={enableAudio}
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #EF4444",
                color: "#FCA5A5",
                fontSize: "0.8rem",
                fontWeight: 700,
                padding: "0.3rem 0.75rem",
                borderRadius: "var(--radius-pill)",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              🔇 Klik untuk Aktifkan Alarm Kasir
            </button>
          ) : (
            <span
              style={{
                background: isAlarmPlaying ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.2)",
                border: isAlarmPlaying ? "1px solid #EF4444" : "1px solid #10B981",
                color: isAlarmPlaying ? "#F87171" : "#34D399",
                fontSize: "0.8rem",
                fontWeight: 700,
                padding: "0.3rem 0.75rem",
                borderRadius: "var(--radius-pill)",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                animation: isAlarmPlaying ? "pulse 1s infinite" : "none",
              }}
            >
              {isAlarmPlaying ? "🚨 ALARM BERDERING: Pesanan Masuk!" : "🔔 Alarm Kasir Siaga"}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            🖨️ Printer Bluetooth
          </button>
          <button
            className="btn-primary"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
              background: "linear-gradient(135deg, #EF4444, #DC2626)",
            }}
          >
            🔒 Tutup Shift & Setor
          </button>
        </div>
      </header>

      {/* Banner Khusus Pesanan Meja yang Masuk & Perlu Konfirmasi Kasir */}
      {incomingOrders.length > 0 && (
        <div
          style={{
            background: "linear-gradient(90deg, rgba(239, 68, 68, 0.25) 0%, rgba(255, 69, 0, 0.25) 100%)",
            borderBottom: "2px solid #EF4444",
            padding: "0.875rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "24px" }}>🚨</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#FCA5A5" }}>
                {incomingOrders.length} Pesanan QR Meja Baru Masuk! Kasir Wajib Verifikasi Bukti QRIS
              </div>
              <div style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>
                Alarm terus berdering sampai kasir menekan tombol konfirmasi di bawah.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {incomingOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => setSelectedAuditOrder(ord)}
                className="btn-primary"
                style={{
                  padding: "0.5rem 1.25rem",
                  fontSize: "0.85rem",
                  background: "linear-gradient(135deg, #EF4444, #FF4500)",
                  animation: "bounce 1.5s infinite",
                }}
              >
                🔍 Cek Bukti Meja #{ord.tableNumber} (Rp {ord.totalPrice.toLocaleString("id-ID")})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", gap: "1px", background: "var(--border-subtle)" }}>
        {/* Left: Product Grid for Direct Tap */}
        <div style={{ background: "var(--bg-deep-black)", padding: "1.5rem", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ fontSize: "1rem", fontWeight: 800 }}>Pemesanan Langsung Kasir (Pelanggan Bayar Tunai / Di Meja)</div>
            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Tap menu untuk input cepat</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "1rem",
            }}
          >
            {[
              { name: "Kopi Hitam Tubruk", price: "Rp 5.000", cat: "Kopi" },
              { name: "Kopi Susu Panas", price: "Rp 7.000", cat: "Kopi" },
              { name: "Es Teh Manis Jumbo", price: "Rp 5.000", cat: "Dingin" },
              { name: "Nutrisari Dingin", price: "Rp 6.000", cat: "Dingin" },
              { name: "Indomie Goreng + Telur", price: "Rp 12.000", cat: "Makanan" },
              { name: "Indomie Rebus Kuah", price: "Rp 12.000", cat: "Makanan" },
              { name: "Roti Bakar Coklat Keju", price: "Rp 10.000", cat: "Camilan" },
              { name: "Gorengan Bakwan (3 pcs)", price: "Rp 5.000", cat: "Camilan" },
            ].map((item) => (
              <button
                key={item.name}
                className="glass-panel"
                style={{
                  padding: "1.25rem 1rem",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "130px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--brand-orange-light)", fontWeight: 700 }}>
                    {item.cat}
                  </span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.25rem", color: "#FFF" }}>
                    {item.name}
                  </div>
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#FFF" }}>
                  {item.price}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Direct Checkout Cart */}
        <div style={{ background: "var(--bg-surface-1)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>Pesanan Kasir Manual</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Untuk tamu pesan di meja kasir / Tunai</div>
          </div>

          <div style={{ flex: 1, padding: "1.25rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="glass-panel" style={{ padding: "0.875rem", display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Kopi Hitam Tubruk</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>1x @ Rp 5.000 (Pahit kental)</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Rp 5.000</div>
            </div>
          </div>

          <div style={{ padding: "1.25rem", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Subtotal:</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Rp 5.000</span>
            </div>

            <button
              className="btn-primary"
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1rem",
              }}
            >
              BAYAR TUNAI &amp; KIRIM KE DAPUR
            </button>
          </div>
        </div>
      </div>

      {/* Modal Popup Verifikasi Bukti Screenshot Pembayaran QRIS Pelanggan */}
      {selectedAuditOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "520px",
              width: "100%",
              padding: "2rem",
              border: "2px solid #EF4444",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.9)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <span className="badge badge-cooking" style={{ marginBottom: "0.25rem" }}>
                  Konfirmasi Pembayaran QRIS
                </span>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 900 }}>
                  Pesanan Dari Meja #{selectedAuditOrder.tableNumber}
                </h2>
              </div>
              <button
                onClick={() => setSelectedAuditOrder(null)}
                className="btn-secondary"
                style={{ width: "32px", height: "32px", padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Rincian Pesanan */}
            <div
              style={{
                background: "var(--bg-surface-1)",
                borderRadius: "var(--radius-md)",
                padding: "1rem",
                marginBottom: "1rem",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-muted)" }}>Menu Dipesan:</div>
              {selectedAuditOrder.items.map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                  <span>
                    {it.qty}x {it.name} <span style={{ color: "var(--text-dim)" }}>({it.notes})</span>
                  </span>
                  <span style={{ fontWeight: 700 }}>Rp {(it.qty * it.price).toLocaleString("id-ID")}</span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  marginTop: "0.5rem",
                  paddingTop: "0.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "1rem",
                  fontWeight: 900,
                }}
              >
                <span>Total Wajib Bayar:</span>
                <span style={{ color: "var(--brand-orange-light)" }}>
                  Rp {selectedAuditOrder.totalPrice.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Bukti Screenshot Transfer dari Pelanggan */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-muted)" }}>
                Bukti Screenshot Dari Pelanggan:
              </div>
              <div
                style={{
                  background: "#000",
                  borderRadius: "var(--radius-md)",
                  padding: "0.75rem",
                  textAlign: "center",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedAuditOrder.proofUrl}
                  alt="Bukti Transfer"
                  style={{ maxHeight: "160px", maxWidth: "100%", borderRadius: "8px", objectFit: "contain" }}
                />
                <div style={{ fontSize: "0.75rem", color: "#10B981", marginTop: "0.5rem", fontWeight: 600 }}>
                  ✓ Periksa mutasi rekening QRIS warkop Anda apakah dana Rp {selectedAuditOrder.totalPrice.toLocaleString("id-ID")} telah masuk.
                </div>
              </div>
            </div>

            {/* Tombol Aksi Kasir */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "0.75rem" }}>
              <button
                onClick={() => handleRejectOrder(selectedAuditOrder.id)}
                className="btn-secondary"
                style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "#EF4444", color: "#FCA5A5", fontWeight: 700 }}
              >
                ✕ Tolak Pesanan
              </button>

              <button
                onClick={() => handleConfirmPayment(selectedAuditOrder.id)}
                className="btn-primary"
                style={{ background: "linear-gradient(135deg, #10B981, #059669)", fontWeight: 800 }}
              >
                ✓ Konfirmasi &amp; Kirim Dapur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
