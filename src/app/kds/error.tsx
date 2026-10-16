"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function KdsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OKESIH KDS Error Boundary]", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          background: "#1e293b",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "20px",
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "18px" }}>
          <Image src="/logo.svg?v=2" width={56} height={56} alt="OKESIH Logo" />
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: 850, marginBottom: "8px", color: "#ffffff" }}>
          Layar Dapur KDS Terhenti
        </h1>

        <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#94a3b8", marginBottom: "24px" }}>
          Terjadi kendala saat memperbarui antrean dapur. Klik tombol di bawah untuk menyegarkan tampilan.
        </p>

        <button
          type="button"
          onClick={() => {
            reset();
            if (typeof window !== "undefined") window.location.reload();
          }}
          style={{
            width: "100%",
            padding: "13px 20px",
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            color: "#ffffff",
            border: 0,
            borderRadius: "12px",
            fontWeight: 800,
            fontSize: "14.5px",
            cursor: "pointer",
          }}
        >
          🔄 Muat Ulang Layar KDS
        </button>
      </div>
    </main>
  );
}
