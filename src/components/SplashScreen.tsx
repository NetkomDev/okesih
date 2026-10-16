"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * Komponen Splash Screen Sambutan OKESIH.COM
 * Menampilkan logo sambutan beranimasi resmi (okesih-logo-animated.svg)
 * dengan transisi fade-out halus saat halaman siap digunakan.
 */
export default function SplashScreen() {
  const pathname = usePathname();
  const isOperational = pathname.startsWith("/pos") || pathname.startsWith("/kds") || pathname.startsWith("/tv");
  const isTenantMenu = pathname.startsWith("/menu/");
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const hasSeenSplash = useSyncExternalStore(
    () => () => {},
    () => isOperational || sessionStorage.getItem("okesih_splash_welcomed") === "true",
    () => true
  );
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Cek apakah splash screen sudah pernah tampil di tab/sesi ini
    if (hasSeenSplash) {
      return;
    }

    // Waktu tunggu animasi logo SVG (2.8 detik untuk satu siklus animasi awal)
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 2600);

    const closeTimer = setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem("okesih_splash_welcomed", "true");
      } catch {
        // Abaikan jika storage private mode
      }
    }, 3200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [hasSeenSplash]);

  const handleDismiss = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      try {
        sessionStorage.setItem("okesih_splash_welcomed", "true");
      } catch {}
    }, 400);
  };

  // Jangan render di server atau jika sudah ditutup
  if (!mounted || hasSeenSplash || !visible) return null;

  return (
    <aside
      aria-label="Sambutan OKESIH.COM"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-deep-black, #0A0A0C)",
        opacity: fading ? 0 : 1,
        transform: fading ? "scale(1.04)" : "scale(1)",
        transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: fading ? "none" : "auto",
        padding: "1.5rem",
        overflow: "hidden",
      }}
    >
      {/* Background Radial Glow */}
      <div
        style={{
          position: "absolute",
          width: "480px",
          height: "480px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 69, 0, 0.18) 0%, rgba(255, 87, 34, 0.05) 50%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      {/* Kontainer Logo Animasi */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "360px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "240px",
            height: "240px",
            maxWidth: "70vw",
            maxHeight: "70vw",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: "drop-shadow(0 12px 30px rgba(255, 69, 0, 0.25))",
            marginBottom: isTenantMenu ? 0 : "1.25rem",
          }}
        >
          {/* Logo dengan nama/teks OKESIH.COM yang beranimasi */}
          <img
            src="/okesih-logo-animated.svg"
            alt="Logo Sambutan OKESIH.COM"
            width={240}
            height={240}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        {!isTenantMenu && <>
        {/* Teks Sambutan Hangat */}
        <div
          style={{
            fontSize: "1.1rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-pure-white, #FFFFFF)",
            marginBottom: "0.35rem",
          }}
        >
          Selamat Datang di <span style={{ color: "var(--brand-orange-light, #FF6F00)" }}>OKESIH.COM</span>
        </div>
        <div
          style={{
            fontSize: "0.825rem",
            color: "var(--text-muted, #94A3B8)",
            lineHeight: 1.5,
            marginBottom: "1.75rem",
          }}
        >
          Platform Kasir &amp; Operasional Usaha Kuliner Modern
        </div>

        {/* Micro Loading Progress Indicator */}
        <div
          style={{
            width: "140px",
            height: "3px",
            background: "rgba(255, 255, 255, 0.12)",
            borderRadius: "999px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, #FF5722, #FF4500, #FBBF24)",
              borderRadius: "999px",
              animation: "okesihProgress 2.4s ease-in-out forwards",
            }}
          />
        </div>
        </>}
      </div>

      {/* Tombol Lewati */}
      {!isTenantMenu && <button
        onClick={handleDismiss}
        type="button"
        style={{
          position: "absolute",
          top: "1.5rem",
          right: "1.5rem",
          zIndex: 10,
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          color: "var(--text-muted, #94A3B8)",
          fontSize: "0.75rem",
          fontWeight: 600,
          padding: "0.35rem 0.85rem",
          borderRadius: "999px",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#FFF";
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted, #94A3B8)";
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
        }}
      >
        Lewati ✕
      </button>}

      <style jsx>{`
        @keyframes okesihProgress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(0%);
          }
        }
      `}</style>
    </aside>
  );
}
