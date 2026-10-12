"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface ReadyQueueItem {
  ticketNumber: number;
  tableNumber: string;
  readyAt: number; // timestamp
}

export default function TvQueuePage() {
  // Durasi menghilangnya antrean siap diambil (dalam detik, diatur oleh Super Admin Pusat)
  const [autoDismissSeconds, setAutoDismissSeconds] = useState<number>(60);

  // Daftar antrean yang sedang diracik barista
  const inProgressQueue = [
    { ticketNumber: 13, tableNumber: "02" },
    { ticketNumber: 14, tableNumber: "08" },
    { ticketNumber: 15, tableNumber: "03" },
  ];

  // Daftar antrean yang SIAP DIAMBIL / DIANTAR (HIJAU)
  const [readyQueue, setReadyQueue] = useState<ReadyQueueItem[]>([
    { ticketNumber: 11, tableNumber: "01", readyAt: Date.now() - 35000 },
    { ticketNumber: 12, tableNumber: "05", readyAt: Date.now() - 5000 },
  ]);

  // Voice calling helper
  const speakQueue = (num: number, table: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const text = `OKESIH, Nomor ${num} untuk Meja ${table}, silakan diambil atau diantar.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Timer loop: membuang tiket hijau yang usianya sudah melewati autoDismissSeconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setReadyQueue((prev) =>
        prev.filter((item) => {
          const elapsedSec = (now - item.readyAt) / 1000;
          return elapsedSec < autoDismissSeconds;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [autoDismissSeconds]);

  // Uji simulasi pesanan baru selesai
  const simulateNewReadyOrder = () => {
    const randomTicket = Math.floor(Math.random() * 80) + 20;
    const randomTable = `0${Math.floor(Math.random() * 9) + 1}`;
    const newItem: ReadyQueueItem = {
      ticketNumber: randomTicket,
      tableNumber: randomTable,
      readyAt: Date.now(),
    };
    setReadyQueue((prev) => [newItem, ...prev]);
    speakQueue(randomTicket, randomTable);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#050506",
        color: "#FFF",
        overflow: "hidden",
      }}
    >
      {/* Smart TV Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <Link href="/" style={{ fontSize: "1.75rem", fontWeight: 900, display: "flex", alignItems: "center", gap: "0.75rem", textDecoration: "none", color: "inherit" }}>
            <img
              src="/logo.svg?v=2"
              alt="Logo OKESIH.COM"
              width={48}
              height={48}
              style={{ width: "48px", height: "48px", objectFit: "contain", display: "inline-block" }}
            />
            <span>
              OKESIH <span style={{ color: "var(--brand-orange-light)" }}>WARKOP KITA</span>
            </span>
          </Link>
          <span className="badge badge-ready" style={{ fontSize: "0.85rem", padding: "0.35rem 0.85rem" }}>
            ● Layar Antrean Smart TV
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Auto-Dismiss Pusat: <strong style={{ color: "#10B981" }}>{autoDismissSeconds}s</strong>
          </div>
          <button
            onClick={simulateNewReadyOrder}
            className="btn-primary"
            style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
          >
            ⚡ Simulasi Pesanan Siap &amp; Panggil
          </button>
        </div>
      </header>

      {/* Main Split Screen */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: "1px", background: "var(--border-subtle)" }}>
        {/* Kolom Kiri: Sedang Diracik Barista */}
        <div style={{ background: "var(--bg-deep-black)", padding: "2.5rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#F59E0B" }} />
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#FBBF24" }}>
              SEDANG DIRACIK
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1.25rem" }}>
            {inProgressQueue.map((item) => (
              <div
                key={item.ticketNumber}
                className="glass-panel"
                style={{
                  padding: "1.5rem 1rem",
                  textAlign: "center",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#E5E7EB" }}>
                  #{item.ticketNumber < 10 ? `00${item.ticketNumber}` : `0${item.ticketNumber}`}
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--brand-orange-light)", marginTop: "0.35rem" }}>
                  MEJA #{item.tableNumber}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kolom Kanan: SIAP DIAMBIL / DIANTAR (HIJAU & AUTO-DISMISS) */}
        <div style={{ background: "rgba(16, 185, 129, 0.05)", padding: "2.5rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#10B981" }} />
              <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#34D399" }}>
                SIAP DIAMBIL / DIANTAR ☕
              </h2>
            </div>
            <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              *Menghilang otomatis setelah diantar
            </span>
          </div>

          {readyQueue.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: "1.25rem" }}>
              Belum ada pesanan yang siap.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
              {readyQueue.map((item) => {
                const remainingSec = Math.max(0, Math.ceil(autoDismissSeconds - (Date.now() - item.readyAt) / 1000));
                return (
                  <div
                    key={item.ticketNumber}
                    className="glass-panel"
                    style={{
                      padding: "2rem 1.5rem",
                      textAlign: "center",
                      borderRadius: "var(--radius-xl)",
                      border: "2px solid #10B981",
                      background: "rgba(16, 185, 129, 0.18)",
                      boxShadow: "0 10px 30px rgba(16, 185, 129, 0.25)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.5s ease",
                    }}
                  >
                    <div style={{ fontSize: "4rem", fontWeight: 900, color: "#10B981", lineHeight: 1 }}>
                      #{item.ticketNumber < 10 ? `00${item.ticketNumber}` : `0${item.ticketNumber}`}
                    </div>

                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 900,
                        color: "#FFFFFF",
                        background: "#059669",
                        padding: "0.3rem 1rem",
                        borderRadius: "var(--radius-pill)",
                        marginTop: "0.75rem",
                      }}
                    >
                      MEJA #{item.tableNumber}
                    </div>

                    <div style={{ fontSize: "0.75rem", color: "#A7F3D0", marginTop: "0.75rem" }}>
                      Menghilang dalam {remainingSec}s
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
