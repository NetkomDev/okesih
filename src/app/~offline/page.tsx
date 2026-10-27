"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { resolveOfflineContext, type OfflineContextConfig } from "@/lib/offline-surface";
import { detectActivePwaKind } from "@/lib/pwa-routing";

export default function OfflineFallbackPage() {
  const [config, setConfig] = useState<OfflineContextConfig>(() => resolveOfflineContext());
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pwaKind = detectActivePwaKind();
    const resolved = resolveOfflineContext({
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      referrer: document.referrer,
      pwaKind,
    });
    const contextTimer = window.setTimeout(() => setConfig(resolved), 0);

    const handleOnline = () => {
      setIsReconnecting(true);
      setTimeout(() => {
        window.location.reload();
      }, 700);
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(contextTimer);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const handleManualReload = () => {
    setIsRefreshing(true);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0B0E14",
        color: "#FFFFFF",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: "460px",
          width: "100%",
          padding: "2.5rem 2rem",
          borderRadius: "1.5rem",
          background: "linear-gradient(180deg, #161C26 0%, #0F141E 100%)",
          border: "1px solid rgba(244, 81, 44, 0.28)",
          boxShadow: "0 24px 50px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
          <Image
            src="/logo.svg?v=2"
            alt="OKESIH Logo"
            width={56}
            height={56}
            style={{ objectFit: "contain", filter: "drop-shadow(0 6px 16px rgba(244, 81, 44, 0.35))" }}
            priority
          />
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "5px 14px",
            borderRadius: "999px",
            fontSize: "0.75rem",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "1rem",
            background: isReconnecting ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 81, 44, 0.12)",
            color: isReconnecting ? "#34D399" : "#FF6A00",
            border: isReconnecting ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(244, 81, 44, 0.25)",
            transition: "all 0.3s ease",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: isReconnecting ? "#10B981" : "#FF5500",
              boxShadow: isReconnecting ? "0 0 8px #10B981" : "0 0 8px #FF5500",
            }}
          />
          {isReconnecting ? "Terhubung kembali! Memuat..." : config.badge}
        </div>

        <h1
          style={{
            fontSize: "1.55rem",
            fontWeight: 850,
            marginBottom: "0.75rem",
            letterSpacing: "-0.025em",
            color: "#FFFFFF",
            lineHeight: 1.25,
          }}
        >
          {config.title}
        </h1>

        <p
          style={{
            fontSize: "0.92rem",
            lineHeight: 1.6,
            color: "#94A3B8",
            marginBottom: "2rem",
            maxWidth: "380px",
          }}
        >
          {config.description}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
          <button
            onClick={handleManualReload}
            disabled={isRefreshing || isReconnecting}
            style={{
              padding: "0.95rem 1.5rem",
              borderRadius: "0.85rem",
              background: "linear-gradient(135deg, #F4512C 0%, #EA580C 100%)",
              color: "#FFFFFF",
              border: "none",
              fontWeight: 800,
              fontSize: "0.95rem",
              cursor: isRefreshing || isReconnecting ? "not-allowed" : "pointer",
              boxShadow: "0 6px 20px rgba(244, 81, 44, 0.4)",
              transition: "transform 0.15s ease, filter 0.15s ease",
              opacity: isRefreshing || isReconnecting ? 0.75 : 1,
            }}
          >
            {isRefreshing ? "Menghubungkan..." : config.primaryAction}
          </button>

          <Link
            href={config.secondaryHref}
            style={{
              padding: "0.85rem 1.5rem",
              borderRadius: "0.85rem",
              background: "rgba(255, 255, 255, 0.05)",
              color: "#CBD5E1",
              textDecoration: "none",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              fontWeight: 700,
              fontSize: "0.92rem",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            {config.secondaryAction}
          </Link>
        </div>
      </div>
    </main>
  );
}
