"use client";

import Link from "next/link";
import { useState } from "react";

interface KitchenTicket {
  id: string;
  ticketNumber: string;
  tableNumber: string;
  elapsedMinutes: number;
  status: "NEW" | "COOKING" | "READY";
  items: { name: string; qty: number; notes?: string }[];
}

export default function KdsModulePage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([
    {
      id: "tk-01",
      ticketNumber: "#012",
      tableNumber: "05",
      elapsedMinutes: 8,
      status: "COOKING",
      items: [
        { name: "Indomie Goreng + Telur", qty: 2, notes: "Pedas level 3, sawi banyak" },
        { name: "Es Teh Manis Jumbo", qty: 2, notes: "Normal" },
      ],
    },
    {
      id: "tk-02",
      ticketNumber: "#013",
      tableNumber: "02",
      elapsedMinutes: 3,
      status: "NEW",
      items: [
        { name: "Kopi Susu Panas", qty: 1, notes: "Gula aren sedikit" },
        { name: "Roti Bakar Keju", qty: 1, notes: "Susu kental manis" },
      ],
    },
    {
      id: "tk-03",
      ticketNumber: "#014",
      tableNumber: "08",
      elapsedMinutes: 1,
      status: "NEW",
      items: [
        { name: "Kopi Hitam Tubruk", qty: 3, notes: "Pahit kental" },
      ],
    },
  ]);

  const markCooking = (id: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "COOKING" } : t))
    );
  };

  const markReady = (id: string, ticketNum: string, tableNum: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== id));
    alert(`✓ Pesanan ${ticketNum} (Meja #${tableNum}) SELESAI!\nStatus berubah HIJAU di Layar TV dan siap diantar waiters.`);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-deep-black)" }}>
      {/* KDS Top Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.75rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/" style={{ fontSize: "1.25rem", fontWeight: 900 }}>
            🍳 OKESIH <span style={{ color: "#FBBF24" }}>BARISTA &amp; DAPUR (KDS)</span>
          </Link>
          <span className="badge badge-ready">● Realtime WebSocket Aktif</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Tiket Aktif: <strong style={{ color: "#FFF" }}>{tickets.length} Meja</strong>
          </div>
          <button className="btn-secondary" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
            🔊 Test Audio Dapur
          </button>
        </div>
      </header>

      {/* Ticket Grid */}
      <main style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
        {tickets.map((t) => (
          <div
            key={t.id}
            className="glass-panel"
            style={{
              padding: "1.25rem",
              border: t.status === "COOKING" ? "1px solid rgba(245, 158, 11, 0.5)" : "1px solid rgba(59, 130, 246, 0.4)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: t.status === "COOKING" ? "0 4px 20px rgba(245, 158, 11, 0.15)" : "none",
            }}
          >
            <div>
              {/* Header Tiket: Nomor Tiket & Nomor Meja yang Jelas! */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "1rem",
                  borderBottom: "1px solid var(--border-subtle)",
                  paddingBottom: "0.75rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.75rem", fontWeight: 900, color: t.status === "COOKING" ? "#FBBF24" : "#60A5FA" }}>
                      {t.ticketNumber}
                    </span>
                    {/* Badge Nomor Meja yang Sangat Menonjol */}
                    <span
                      style={{
                        background: "rgba(255, 69, 0, 0.2)",
                        border: "1px solid rgba(255, 69, 0, 0.5)",
                        color: "var(--brand-orange-light)",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "8px",
                        fontWeight: 900,
                        fontSize: "0.95rem",
                      }}
                    >
                      📍 MEJA #{t.tableNumber}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                    Dikonfirmasi kasir: {t.elapsedMinutes} menit lalu
                  </div>
                </div>

                <span className={t.status === "COOKING" ? "badge badge-cooking" : "badge badge-new"}>
                  {t.status === "COOKING" ? "Sedang Diracik" : "Baru Masuk"}
                </span>
              </div>

              {/* Daftar Menu Dipesan */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {t.items.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "1.05rem" }}>
                      <span>{item.qty}x {item.name}</span>
                    </div>
                    {item.notes && (
                      <span style={{ fontSize: "0.8rem", color: "var(--brand-orange-light)", fontWeight: 700, marginTop: "0.15rem" }}>
                        Catatan: {item.notes}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol Aksi Barista */}
            <div>
              {t.status === "NEW" ? (
                <button
                  onClick={() => markCooking(t.id)}
                  className="btn-secondary"
                  style={{ width: "100%", fontWeight: 700, borderColor: "rgba(59, 130, 246, 0.5)" }}
                >
                  Mulai Racik Pesanan Meja #{t.tableNumber} →
                </button>
              ) : (
                <button
                  onClick={() => markReady(t.id, t.ticketNumber, t.tableNumber)}
                  className="btn-primary"
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #10B981, #059669)",
                    boxShadow: "0 4px 16px rgba(16, 185, 129, 0.35)",
                    fontWeight: 800,
                  }}
                >
                  ✓ SELESAI (SIAP DIANTAR KE MEJA #{t.tableNumber})
                </button>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
