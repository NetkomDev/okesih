"use client";

import { useEffect, useState } from "react";
import { APP_ORIGINS } from "@/lib/app-origins";

export default function AuthHandoffPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const code = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      queueMicrotask(() => setError("Kode login tidak ditemukan atau sudah kedaluwarsa."));
      return;
    }

    void fetch("/api/auth/handoff/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ code }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Login tidak dapat diselesaikan.");
        if (!cancelled) window.location.replace(payload.redirectTo);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Login tidak dapat diselesaikan.");
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#080b12", color: "#fff" }}>
      <section style={{ width: "min(420px, 100%)", textAlign: "center", padding: "32px", borderRadius: "24px", background: "#111827", border: "1px solid #263244" }}>
        <div aria-hidden="true" style={{ fontSize: "2rem", marginBottom: "12px" }}>{error ? "⚠️" : "🔐"}</div>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>{error ? "Login tidak berhasil" : "Menyiapkan portal Anda…"}</h1>
        <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.55, margin: 0 }}>
          {error || "Mohon tunggu. Sesi aman sedang dibuat pada aplikasi tujuan."}
        </p>
        {error && (
          <a href={`${APP_ORIGINS.PUBLIC}/#login`} style={{ display: "inline-block", marginTop: "20px", color: "#fb6a47", fontWeight: 800 }}>
            Kembali ke login
          </a>
        )}
      </section>
    </main>
  );
}
