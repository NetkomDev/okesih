"use client";

import Link from "next/link";

export default function OfflineFallbackPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0D0D0E",
        color: "#FFFFFF",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          padding: "2.5rem 2rem",
          borderRadius: "1.25rem",
          background: "linear-gradient(180deg, #1A1A1E 0%, #141416 100%)",
          border: "1px solid rgba(255, 69, 0, 0.25)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            margin: "0 auto 1.5rem",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FF4500, #FF7A00)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
          }}
        >
          📶
        </div>

        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            marginBottom: "0.75rem",
            letterSpacing: "-0.02em",
          }}
        >
          OKESIH Sedang Offline
        </h1>

        <p
          style={{
            fontSize: "0.95rem",
            lineHeight: 1.6,
            color: "#A0A0A8",
            marginBottom: "2rem",
          }}
        >
          Koneksi internet perangkat Anda sedang terputus. Tenang, pesanan kasir tetap tersimpan aman di database lokal dan akan disinkronkan otomatis saat sinyal kembali!
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            }}
            style={{
              padding: "0.875rem 1.5rem",
              borderRadius: "0.75rem",
              background: "linear-gradient(135deg, #FF4500, #FF6A00)",
              color: "#FFFFFF",
              border: "none",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Coba Sambungkan Ulang
          </button>

          <Link
            href="/pos"
            style={{
              padding: "0.875rem 1.5rem",
              borderRadius: "0.75rem",
              background: "rgba(255, 255, 255, 0.05)",
              color: "#FFFFFF",
              textDecoration: "none",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Kembali ke Kasir (POS)
          </Link>
        </div>
      </div>
    </main>
  );
}
