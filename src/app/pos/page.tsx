"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";

interface OrderItem {
  name: string;
  qty: number;
  notes: string;
  price: number;
}

interface IncomingTableOrder {
  id: string;
  tableNumber: string;
  customerName: string;
  items: OrderItem[];
  totalPrice: number;
  paymentMethod: "QRIS_WARKOP" | "CASH";
  proofUrl?: string;
  createdAt: string;
}

interface WaiterShiftRecord {
  id: string;
  waiterName: string;
  startedAt: string;
  endedAt: string;
  totalCashExpected: number;
  actualCashDeposited: number;
  difference: number;
  notes: string;
}

export default function PosModulePage() {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState<boolean>(false);

  // Active Waiter & Shift Management State
  const [activeWaiter, setActiveWaiter] = useState<string>("Rian");
  const [waiterShiftStartTime, setWaiterShiftStartTime] = useState<string>("08:00");
  const [waiterCashCollected, setWaiterCashCollected] = useState<number>(34000);
  const [waiterOrdersCount, setWaiterOrdersCount] = useState<number>(2);

  // Shift Modal State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [nextWaiterName, setNextWaiterName] = useState<string>("");
  const [physicalCashInput, setPhysicalCashInput] = useState<string>("34000");
  const [shiftNotes, setShiftNotes] = useState<string>("Laci rapi, modal receh aman.");

  // Shift History State
  const [shiftHistory, setShiftHistory] = useState<WaiterShiftRecord[]>([
    {
      id: "shf-01",
      waiterName: "Dani",
      startedAt: "00:00",
      endedAt: "08:00",
      totalCashExpected: 145000,
      actualCashDeposited: 145000,
      difference: 0,
      notes: "Shift malam lancar, kas laci cocok persis.",
    },
  ]);

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
    {
      id: "ord-meja-03",
      tableNumber: "03",
      customerName: "Andi (Meja 03)",
      items: [
        { name: "Kopi Hitam Tubruk Giras", qty: 1, notes: "Kental pahit", price: 5000 },
        { name: "Indomie Kuah Dobel Telur", qty: 1, notes: "Telur 1/2 matang", price: 16000 },
      ],
      totalPrice: 21000,
      paymentMethod: "CASH",
      createdAt: "Baru saja",
    },
  ]);

  const [selectedAuditOrder, setSelectedAuditOrder] = useState<IncomingTableOrder | null>(null);
  const [thermalReceiptOrder, setThermalReceiptOrder] = useState<IncomingTableOrder | null>(null);

  // Audio Context Ref for Loud Alarm Synthesizer
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

  const playBeep = () => {
    try {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio fallback
    }
  };

  // Loop alarm if incoming orders exist
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

  const handleOpenAuditModal = (order: IncomingTableOrder) => {
    setSelectedAuditOrder(order);
  };

  const handleConfirmOrder = (order: IncomingTableOrder) => {
    setSelectedAuditOrder(null);
    // Open thermal receipt print preview modal
    setThermalReceiptOrder(order);
  };

  const handlePrintReceiptAndSendToKds = (order: IncomingTableOrder) => {
    // If order was CASH, accumulate to active waiter cash collection
    if (order.paymentMethod === "CASH") {
      setWaiterCashCollected((prev) => prev + order.totalPrice);
      setWaiterOrdersCount((prev) => prev + 1);
    }

    setIncomingOrders((prev) => prev.filter((o) => o.id !== order.id));
    setThermalReceiptOrder(null);

    alert(
      `✓ Struk Tercetak & Diteruskan ke Dapur (KDS)!\n` +
      `Nomor Meja: #${order.tableNumber}\n` +
      `Metode: ${order.paymentMethod === "CASH" ? "BAYAR TUNAI (Waiters Wajib Tagih)" : "QRIS LUNAS"}\n` +
      `Waiters Bertugas: ${activeWaiter}`
    );
  };

  const handleRejectOrder = (orderId: string) => {
    setIncomingOrders((prev) => prev.filter((o) => o.id !== orderId));
    setSelectedAuditOrder(null);
    alert("❌ Pesanan Dibatalkan/Ditolak. Alarm kasir dimatikan.");
  };

  // Shift Handover Calculation
  const parsedPhysicalCash = parseFloat(physicalCashInput) || 0;
  const cashDifference = parsedPhysicalCash - waiterCashCollected;

  const handleCompleteShiftHandover = () => {
    if (!nextWaiterName.trim()) {
      alert("Harap masukkan nama Waiters pengganti untuk shift berikutnya!");
      return;
    }

    const newRecord: WaiterShiftRecord = {
      id: `shf-${Date.now()}`,
      waiterName: activeWaiter,
      startedAt: waiterShiftStartTime,
      endedAt: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      totalCashExpected: waiterCashCollected,
      actualCashDeposited: parsedPhysicalCash,
      difference: cashDifference,
      notes: shiftNotes,
    };

    setShiftHistory((prev) => [newRecord, ...prev]);

    // Reset shift for next waiter
    const newWaiter = nextWaiterName.trim();
    setActiveWaiter(newWaiter);
    setWaiterShiftStartTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
    setWaiterCashCollected(0);
    setWaiterOrdersCount(0);
    setNextWaiterName("");
    setPhysicalCashInput("0");
    setIsShiftModalOpen(false);

    alert(
      `✓ Shift Waiters Berhasil Ditutup & Direkam!\n` +
      `Waiters Lama: ${newRecord.waiterName}\n` +
      `Kas Sistem: Rp ${newRecord.totalCashExpected.toLocaleString("id-ID")}\n` +
      `Kas Fisik Laci: Rp ${newRecord.actualCashDeposited.toLocaleString("id-ID")}\n` +
      `Selisih: Rp ${newRecord.difference.toLocaleString("id-ID")}\n\n` +
      `Shift baru sekarang aktif untuk: ${newWaiter}`
    );
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-deep-black)" }}>
      {/* Top Bar Kasir */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.875rem 1.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/" style={{ fontSize: "1.2rem", fontWeight: 800 }}>
            ☕ OKESIH <span style={{ color: "var(--brand-orange-light)" }}>POS KASIR</span>
          </Link>
          <span className="badge badge-ready">● PWA Online</span>

          {/* Alarm Audio Toggle Button */}
          {!audioEnabled ? (
            <button
              onClick={enableAudio}
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                border: "1px solid #EF4444",
                color: "#FCA5A5",
                fontSize: "0.775rem",
                fontWeight: 700,
                padding: "0.3rem 0.75rem",
                borderRadius: "var(--radius-pill)",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                cursor: "pointer",
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
                fontSize: "0.775rem",
                fontWeight: 700,
                padding: "0.3rem 0.75rem",
                borderRadius: "var(--radius-pill)",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                animation: isAlarmPlaying ? "pulse 1s infinite" : "none",
              }}
            >
              {isAlarmPlaying ? "🚨 ALARM BERDERING: Pesanan Meja Masuk!" : "🔔 Alarm Kasir Siaga"}
            </span>
          )}
        </div>

        {/* Right Header: Waiters Active Shift & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Active Waiters Badge & Shift Handover Trigger */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--bg-surface-2)",
              padding: "0.3rem 0.75rem",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Waiters Aktif:</span>
            <input
              type="text"
              value={activeWaiter}
              onChange={(e) => setActiveWaiter(e.target.value)}
              title="Ketik nama waiters bertugas saat ini"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--brand-orange-light)",
                fontWeight: 800,
                fontSize: "0.85rem",
                width: "90px",
                outline: "none",
              }}
            />
            <button
              onClick={() => setIsShiftModalOpen(true)}
              style={{
                background: "rgba(255, 69, 0, 0.2)",
                border: "1px solid rgba(255, 69, 0, 0.5)",
                color: "var(--brand-orange-light)",
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "0.2rem 0.5rem",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              🔄 Ganti Shift
            </button>
          </div>

          <button className="btn-secondary" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
            🖨️ Printer Thermal
          </button>
          <button
            className="btn-primary"
            style={{
              padding: "0.45rem 0.85rem",
              fontSize: "0.8rem",
              background: "linear-gradient(135deg, #EF4444, #DC2626)",
            }}
          >
            🔒 Tutup Toko &amp; OCR
          </button>
        </div>
      </header>

      {/* Banner Khusus Pesanan Meja yang Masuk & Alarm Berdering */}
      {incomingOrders.length > 0 && (
        <div
          style={{
            background: "linear-gradient(90deg, rgba(239, 68, 68, 0.25) 0%, rgba(255, 69, 0, 0.25) 100%)",
            borderBottom: "2px solid #EF4444",
            padding: "0.75rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "24px" }}>🚨</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#FCA5A5" }}>
                {incomingOrders.length} Pesanan QR Meja Baru Masuk! Kasir Wajib Konfirmasi
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Alarm terus berdering sampai kasir menekan konfirmasi dan mencetak struk fisik.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {incomingOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => handleOpenAuditModal(ord)}
                className="btn-primary"
                style={{
                  padding: "0.45rem 1rem",
                  fontSize: "0.825rem",
                  background: ord.paymentMethod === "CASH" ? "linear-gradient(135deg, #10B981, #059669)" : "linear-gradient(135deg, #EF4444, #FF4500)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span>{ord.paymentMethod === "CASH" ? "💵 TUNAI" : "📱 QRIS"}</span>
                <span>Meja #{ord.tableNumber}</span>
                <span>(Rp {ord.totalPrice.toLocaleString("id-ID")})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 390px", gap: "1px", background: "var(--border-subtle)" }}>
        {/* Left: Product Grid for Direct Tap */}
        <div style={{ background: "var(--bg-deep-black)", padding: "1.25rem", overflowY: "auto" }}>
          {/* Summary Strip Shift Waiters Aktif */}
          <div
            style={{
              background: "var(--bg-surface-1)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "0.875rem 1.25rem",
              marginBottom: "1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>REKAM SHIFT WAITERS AKTIF</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#FFF" }}>
                Waiters: <span style={{ color: "var(--brand-orange-light)" }}>{activeWaiter}</span> (Mulai {waiterShiftStartTime})
              </div>
            </div>
            <div style={{ display: "flex", gap: "1.5rem", textAlign: "right" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Pesanan Tunai</div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{waiterOrdersCount} Bon Meja</div>
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Uang Tunai Ditagih (Sistem)</div>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "#10B981" }}>
                  Rp {waiterCashCollected.toLocaleString("id-ID")}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.875rem" }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>Pemesanan Langsung Kasir (Pelanggan Pesan di Depan Kasir)</div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Tap menu untuk input cepat</span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "0.875rem",
            }}
          >
            {[
              { name: "Kopi Hitam Tubruk", price: "Rp 5.000", cat: "Kopi" },
              { name: "Kopi Susu Panas", price: "Rp 7.000", cat: "Kopi" },
              { name: "Es Teh Manis Jumbo", price: "Rp 5.000", cat: "Dingin" },
              { name: "Extra Joss Susu", price: "Rp 8.000", cat: "Dingin" },
              { name: "Indomie Goreng + Telur", price: "Rp 12.000", cat: "Makanan" },
              { name: "Indomie Rebus Kuah Kari", price: "Rp 16.000", cat: "Makanan" },
              { name: "Roti Bakar Coklat Keju", price: "Rp 10.000", cat: "Camilan" },
              { name: "Gorengan Tempe (3 pcs)", price: "Rp 5.000", cat: "Camilan" },
            ].map((item) => (
              <button
                key={item.name}
                className="glass-panel"
                style={{
                  padding: "1rem",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "120px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.7rem", color: "var(--brand-orange-light)", fontWeight: 700 }}>
                    {item.cat}
                  </span>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, marginTop: "0.25rem", color: "#FFF" }}>
                    {item.name}
                  </div>
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#FFF" }}>
                  {item.price}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Direct Checkout Cart */}
        <div style={{ background: "var(--bg-surface-1)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 800 }}>Pesanan Manual Kasir</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Untuk tamu yang langsung order di meja kasir
            </div>
          </div>

          <div style={{ flex: 1, padding: "1.25rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="glass-panel" style={{ padding: "0.875rem", display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Kopi Susu Panas</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>1x @ Rp 7.000 (Manis sedang)</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Rp 7.000</div>
            </div>
          </div>

          <div style={{ padding: "1.25rem", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Subtotal:</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Rp 7.000</span>
            </div>

            <button
              className="btn-primary"
              style={{
                width: "100%",
                padding: "0.875rem",
                fontSize: "0.95rem",
              }}
            >
              BAYAR TUNAI &amp; CETAK STRUK
            </button>
          </div>
        </div>
      </div>

      {/* MODAL 1: AUDIT & KONFIRMASI PESANAN MEJA (QRIS ATAU TUNAI) */}
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
              padding: "1.75rem",
              border: selectedAuditOrder.paymentMethod === "CASH" ? "2px solid #10B981" : "2px solid #EF4444",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.9)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <span
                  className={selectedAuditOrder.paymentMethod === "CASH" ? "badge badge-ready" : "badge badge-cooking"}
                  style={{ marginBottom: "0.25rem" }}
                >
                  {selectedAuditOrder.paymentMethod === "CASH" ? "💵 BAYAR TUNAI (TAGIH DI MEJA)" : "📱 TRANSFER QRIS WARKOP"}
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

            {/* Rincian Menu Dipesan */}
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
                  fontSize: "1.05rem",
                  fontWeight: 900,
                }}
              >
                <span>Total Tagihan:</span>
                <span style={{ color: "var(--brand-orange-light)" }}>
                  Rp {selectedAuditOrder.totalPrice.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Konten Verifikasi Sesuai Metode Bayar */}
            {selectedAuditOrder.paymentMethod === "QRIS_WARKOP" ? (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.35rem", color: "var(--text-muted)" }}>
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
                    style={{ maxHeight: "140px", maxWidth: "100%", borderRadius: "8px", objectFit: "contain" }}
                  />
                  <div style={{ fontSize: "0.75rem", color: "#10B981", marginTop: "0.5rem", fontWeight: 600 }}>
                    ✓ Periksa mutasi bank Anda apakah dana Rp {selectedAuditOrder.totalPrice.toLocaleString("id-ID")} telah masuk.
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  borderRadius: "var(--radius-md)",
                  padding: "1rem",
                  marginBottom: "1.25rem",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 800, color: "#34D399", marginBottom: "0.35rem" }}>
                  💵 Prosedur Kasir untuk Pembayaran Tunai:
                </div>
                <div style={{ color: "var(--text-muted)" }}>
                  1. Pelanggan memilih bayar tunai di meja.<br />
                  2. Kasir menekan tombol konfirmasi untuk mencetak struk bertuliskan{" "}
                  <strong style={{ color: "#EF4444" }}>[BAYAR TUNAI]</strong>.<br />
                  3. Transaksi dicatat ke shift Waiters bertugas (<strong>{activeWaiter}</strong>).<br />
                  4. Waiters wajib menagih uang tunai saat mengantar pesanan &amp; struk ke Meja #{selectedAuditOrder.tableNumber}.
                </div>
              </div>
            )}

            {/* Tombol Aksi Kasir */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "0.75rem" }}>
              <button
                onClick={() => handleRejectOrder(selectedAuditOrder.id)}
                className="btn-secondary"
                style={{ background: "rgba(239, 68, 68, 0.15)", borderColor: "#EF4444", color: "#FCA5A5", fontWeight: 700 }}
              >
                ✕ Batalkan / Tolak
              </button>

              <button
                onClick={() => handleConfirmOrder(selectedAuditOrder)}
                className="btn-primary"
                style={{
                  background: selectedAuditOrder.paymentMethod === "CASH" ? "linear-gradient(135deg, #10B981, #059669)" : "linear-gradient(135deg, #FF4500, #EA580C)",
                  fontWeight: 800,
                }}
              >
                ✓ Konfirmasi &amp; Cetak Struk →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PRINTER THERMAL PREVIEW (DENGAN TEKS BESAR QRIS ATAU TUNAI SESUAI SOP WAITERS) */}
      {thermalReceiptOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "420px",
              width: "100%",
              padding: "1.75rem",
              background: "#FFF",
              color: "#000",
              borderRadius: "16px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95)",
              fontFamily: "monospace",
            }}
          >
            {/* Mock Tampilan Kertas Struk Thermal Bluetooth */}
            <div style={{ textAlign: "center", borderBottom: "2px dashed #333", paddingBottom: "0.75rem", marginBottom: "0.75rem" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>WARKOP GIRAS NUSANTARA</div>
              <div style={{ fontSize: "0.75rem", color: "#444" }}>Jl. Kopi Tubruk No. 1, Jakarta</div>
              <div style={{ fontSize: "0.75rem", color: "#666", marginTop: "2px" }}>
                {new Date().toLocaleDateString("id-ID")} {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>

            <div style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>No. Bon: #012</span>
                <span style={{ fontWeight: 900 }}>MEJA #{thermalReceiptOrder.tableNumber}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#444" }}>
                <span>Waiters Bertugas:</span>
                <strong>{activeWaiter}</strong>
              </div>
            </div>

            {/* Item List */}
            <div style={{ borderBottom: "1px dashed #333", paddingBottom: "0.5rem", marginBottom: "0.5rem", fontSize: "0.8rem" }}>
              {thermalReceiptOrder.items.map((it, idx) => (
                <div key={idx} style={{ marginBottom: "0.35rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>{it.qty}x {it.name}</span>
                    <span>Rp {(it.qty * it.price).toLocaleString("id-ID")}</span>
                  </div>
                  {it.notes && <div style={{ fontSize: "0.7rem", color: "#555" }}>- {it.notes}</div>}
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: 900, marginBottom: "0.75rem" }}>
              <span>TOTAL HARGA:</span>
              <span>Rp {thermalReceiptOrder.totalPrice.toLocaleString("id-ID")}</span>
            </div>

            {/* TEKS BESAR & TEBAL (SESUAI INSTRUKSI SPESIFIK USER) */}
            <div
              style={{
                border: "3px solid #000",
                padding: "0.75rem",
                textAlign: "center",
                background: thermalReceiptOrder.paymentMethod === "CASH" ? "#FEE2E2" : "#D1FAE5",
                marginBottom: "1rem",
              }}
            >
              {thermalReceiptOrder.paymentMethod === "CASH" ? (
                <>
                  <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#DC2626", letterSpacing: "1px" }}>
                    *** BAYAR TUNAI : Rp {thermalReceiptOrder.totalPrice.toLocaleString("id-ID")} ***
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#991B1B", marginTop: "4px" }}>
                    &gt;&gt; WAITERS WAJIB TAGIH KE MEJA &lt;&lt;
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#059669", letterSpacing: "1px" }}>
                    *** QRIS LUNAS : Rp {thermalReceiptOrder.totalPrice.toLocaleString("id-ID")} ***
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "#065F46", marginTop: "4px" }}>
                    &gt;&gt; SUDAH LUNAS - TIDAK PERLU TAGIH &lt;&lt;
                  </div>
                </>
              )}
            </div>

            <div style={{ fontSize: "0.7rem", color: "#555", textAlign: "center", marginBottom: "1.25rem", fontStyle: "italic" }}>
              * SOP: Waiters/Pelayan WAJIB cek teks kotak besar di atas sebelum menyerahkan hidangan &amp; struk ke meja pelanggan!
            </div>

            {/* Tombol Cetak Thermal */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.5rem" }}>
              <button
                onClick={() => setThermalReceiptOrder(null)}
                style={{
                  padding: "0.75rem",
                  background: "#E5E7EB",
                  color: "#374151",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Batal
              </button>

              <button
                onClick={() => handlePrintReceiptAndSendToKds(thermalReceiptOrder)}
                style={{
                  padding: "0.75rem",
                  background: "#000",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 900,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                🖨️ Cetak &amp; Kirim KDS →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: MANAJEMEN SHIFT WAITERS & REKONSILIASI KAS LACI (ANTI-SELISIH) */}
      {isShiftModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "580px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "2rem",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 900 }}>Pergantian Shift Waiters &amp; Rekonsiliasi Kas</h2>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Pencocokan uang tunai yang ditagih waiters dengan uang fisik di laci kasir
                </div>
              </div>
              <button
                onClick={() => setIsShiftModalOpen(false)}
                className="btn-secondary"
                style={{ width: "32px", height: "32px", padding: 0 }}
              >
                ✕
              </button>
            </div>

            {/* Info Shift Saat Ini */}
            <div
              style={{
                background: "var(--bg-surface-1)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "1.25rem",
                marginBottom: "1.25rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Waiters Bertugas:</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--brand-orange-light)" }}>{activeWaiter}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Jam Kerja Shift:</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>
                    {waiterShiftStartTime} - Sekarang ({new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })})
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: "var(--bg-surface-2)",
                  padding: "1rem",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total Tagihan Tunai (Catatan Sistem):</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>Berdasarkan bon TUNAI yang ditagih {activeWaiter}</div>
                </div>
                <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "#10B981" }}>
                  Rp {waiterCashCollected.toLocaleString("id-ID")}
                </div>
              </div>
            </div>

            {/* Input Uang Fisik Di Laci & Kalkulasi Selisih */}
            <div
              style={{
                background: "var(--bg-surface-1)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "1.25rem",
                marginBottom: "1.25rem",
              }}
            >
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                💵 Input Jumlah Uang Fisik Di Laci / Diserahkan Waiters:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-dim)" }}>Rp</span>
                <input
                  type="number"
                  value={physicalCashInput}
                  onChange={(e) => setPhysicalCashInput(e.target.value)}
                  placeholder="Ketik nominal uang fisik di laci..."
                  style={{
                    flex: 1,
                    background: "var(--bg-surface-2)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    fontSize: "1.1rem",
                    fontWeight: 800,
                    color: "#FFF",
                    outline: "none",
                  }}
                />
              </div>

              {/* Status Pencocokan / Selisih */}
              <div
                style={{
                  padding: "0.875rem",
                  borderRadius: "8px",
                  border: cashDifference === 0 ? "1px solid #10B981" : "1px solid #EF4444",
                  background: cashDifference === 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 800, color: cashDifference === 0 ? "#34D399" : "#FCA5A5" }}>
                    {cashDifference === 0
                      ? "✓ KAS COCOK / BALANCE"
                      : cashDifference < 0
                      ? "⚠️ SELISIH MINUS (UANG FISIK KURANG!)"
                      : "ℹ️ SELISIH SURPLUS (UANG FISIK LEBIH)"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    {cashDifference === 0
                      ? "Uang di laci sama persis dengan tagihan bon tunai."
                      : `Perbedaan antara fisik dan sistem: Rp ${Math.abs(cashDifference).toLocaleString("id-ID")}`}
                  </div>
                </div>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, color: cashDifference === 0 ? "#10B981" : "#EF4444" }}>
                  {cashDifference === 0 ? "Rp 0" : (cashDifference > 0 ? `+Rp ${cashDifference.toLocaleString("id-ID")}` : `-Rp ${Math.abs(cashDifference).toLocaleString("id-ID")}`)}
                </div>
              </div>
            </div>

            {/* Input Shift Baru */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.4rem" }}>
                👤 Nama Waiters Pengganti (Shift Selanjutnya):
              </label>
              <input
                type="text"
                value={nextWaiterName}
                onChange={(e) => setNextWaiterName(e.target.value)}
                placeholder="Contoh: Dani, Farhan, Bagas..."
                style={{
                  width: "100%",
                  background: "var(--bg-surface-2)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  fontSize: "0.95rem",
                  color: "#FFF",
                  outline: "none",
                  marginBottom: "0.75rem",
                }}
              />

              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.4rem" }}>
                📝 Catatan Serah Terima Shift:
              </label>
              <textarea
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                rows={2}
                placeholder="Catatan kondisi laci, uang kembalian, dll..."
                style={{
                  width: "100%",
                  background: "var(--bg-surface-2)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "0.6rem 0.85rem",
                  fontSize: "0.85rem",
                  color: "#FFF",
                  outline: "none",
                }}
              />
            </div>

            {/* Tombol Simpan Shift */}
            <button
              onClick={handleCompleteShiftHandover}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "0.95rem",
                background: "linear-gradient(135deg, #10B981, #059669)",
                fontWeight: 900,
                marginBottom: "1.5rem",
              }}
            >
              💾 SIMPAN &amp; MULAI SHIFT WAITERS BARU
            </button>

            {/* Riwayat Shift Sebelumnya Hari Ini */}
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.5rem", color: "var(--text-muted)" }}>
                Riwayat Shift Waiters Hari Ini:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {shiftHistory.map((sh) => (
                  <div
                    key={sh.id}
                    className="glass-panel"
                    style={{
                      padding: "0.75rem 1rem",
                      fontSize: "0.8rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {sh.waiterName} ({sh.startedAt} - {sh.endedAt})
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{sh.notes}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800 }}>Fisik: Rp {sh.actualCashDeposited.toLocaleString("id-ID")}</div>
                      <div style={{ fontSize: "0.72rem", color: sh.difference === 0 ? "#10B981" : "#EF4444", fontWeight: 700 }}>
                        {sh.difference === 0 ? "✓ Klop (Rp 0)" : `Selisih: Rp ${sh.difference.toLocaleString("id-ID")}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
