"use client";

import Link from "next/link";
import { useState } from "react";

export default function TvQueuePage() {
  const [calledNumber, setCalledNumber] = useState<number | null>(null);

  const speakQueue = (num: number) => {
    setCalledNumber(num);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(`OKESIH, Nomor ${num} silakan diambil.`);
      utterance.lang = "id-ID";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
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
          <Link href="/" style={{ fontSize: "1.75rem", fontWeight: 900 }}>
            ☕ OKESIH <span style={{ color: "var(--brand-orange-light)" }}>WARKOP KITA</span>
          </Link>
          <span className="badge badge-ready" style={{ fontSize: "0.85rem", padding: "0.35rem 0.85rem" }}>
            ● Layar Antrean Smart TV
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => speakQueue(12)}
            className="btn-primary"
            style={{ padding: "0.6rem 1.25rem", fontSize: "0.9rem" }}
          >
            🔊 Uji Panggilan Suara (Nomor #012)
          </button>
        </div>
      </header>

      {/* Main Split Columns: Sedang Digarap VS Siap Diambil */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1px", background: "var(--border-subtle)" }}>
        {/* Kolom Kiri: Sedang Diproses */}
        <div style={{ background: "var(--bg-deep-black)", padding: "2.5rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#F59E0B" }} />
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#FBBF24" }}>
              SEDANG DIGARAP
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "1.25rem" }}>
            {[13, 14, 15, 16].map((num) => (
              <div
                key={num}
                className="glass-panel"
                style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  fontSize: "3rem",
                  fontWeight: 900,
                  color: "#E5E7EB",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                }}
              >
                #{num < 10 ? `00${num}` : `0${num}`}
              </div>
            ))}
          </div>
        </div>

        {/* Kolom Kanan: Siap Diambil */}
        <div style={{ background: "rgba(16, 185, 129, 0.04)", padding: "2.5rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
            <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#10B981" }} />
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", color: "#34D399" }}>
              SIAP DIAMBIL ☕
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1.5rem" }}>
            {[11, 12].map((num) => (
              <div
                key={num}
                className="glass-panel"
                style={{
                  padding: "2rem 1.5rem",
                  textAlign: "center",
                  fontSize: "4.5rem",
                  fontWeight: 900,
                  color: "#10B981",
                  border: calledNumber === num ? "2px solid #10B981" : "1px solid rgba(16, 185, 129, 0.4)",
                  background: calledNumber === num ? "rgba(16, 185, 129, 0.15)" : "rgba(21, 21, 24, 0.9)",
                  boxShadow: "0 10px 30px rgba(16, 185, 129, 0.2)",
                  transform: calledNumber === num ? "scale(1.05)" : "scale(1)",
                  transition: "all 0.3s ease",
                }}
              >
                #{num < 10 ? `00${num}` : `0${num}`}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
