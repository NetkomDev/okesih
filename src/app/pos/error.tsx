"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function PosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OKESIH POS Error Boundary]", error);
  }, [error]);

  const handleFullReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleClearCacheAndReload = async () => {
    if (typeof window !== "undefined") {
      try {
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(names.map((name) => caches.delete(name)));
        }
      } catch {}
      window.location.href = "/pos";
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0b1018",
        color: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          background: "#151d2a",
          border: "1px solid rgba(244, 81, 44, 0.3)",
          borderRadius: "20px",
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "18px" }}>
          <Image src="/logo.svg?v=2" width={56} height={56} alt="OKESIH Logo" />
        </div>

        <h1
          style={{
            fontSize: "22px",
            fontWeight: 850,
            marginBottom: "8px",
            color: "#ffffff",
          }}
        >
          Layar Kasir Memerlukan Pemulihan
        </h1>

        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.6,
            color: "#94a3b8",
            marginBottom: "24px",
          }}
        >
          Terjadi kendala saat memuat komponen kasir. Data transaksi offline Anda tetap aman di perangkat ini.
        </p>

        {error.message && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "10px",
              color: "#fca5a5",
              fontSize: "12px",
              marginBottom: "20px",
              textAlign: "left",
              fontFamily: "monospace",
              wordBreak: "break-word",
            }}
          >
            {error.message}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={() => {
              reset();
              handleFullReload();
            }}
            style={{
              padding: "13px 20px",
              background: "linear-gradient(135deg, #f4512c 0%, #ea580c 100%)",
              color: "#ffffff",
              border: 0,
              borderRadius: "12px",
              fontWeight: 800,
              fontSize: "14.5px",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(244, 81, 44, 0.35)",
            }}
          >
            🔄 Muat Ulang Kasir
          </button>

          <button
            type="button"
            onClick={() => void handleClearCacheAndReload()}
            style={{
              padding: "12px 18px",
              background: "rgba(255, 255, 255, 0.08)",
              color: "#cbd5e1",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "12px",
              fontWeight: 700,
              fontSize: "13.5px",
              cursor: "pointer",
            }}
          >
            Bersihkan Cache & Buka Ulang
          </button>
        </div>
      </div>
    </main>
  );
}
