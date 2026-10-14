"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PwaRoleKind, PWA_ROLE_CONFIGS, isStandaloneApp } from "@/lib/pwa-routing";

type InstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface PwaRoleInstallModalProps {
  pwaKind: PwaRoleKind;
  title?: string;
  subtitle?: string;
}

export default function PwaRoleInstallModal({
  pwaKind,
  title,
  subtitle,
}: PwaRoleInstallModalProps) {
  const [showModal, setShowModal] = useState(false);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [helperText, setHelperText] = useState("");

  const config = PWA_ROLE_CONFIGS[pwaKind];
  const appTitle = title || `Pasang Aplikasi ${config?.name || "OKESIH"}`;
  const appSubtitle =
    subtitle ||
    `Tambahkan aplikasi langsung ke layar utama perangkat Anda agar akses lebih cepat dan operasional lebih lancar tanpa membuka browser lagi.`;
  const storageKey = `okesih_install_dismissed_${pwaKind}`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Jangan tampilkan jika sudah diinstal (standalone) atau user sudah klik nanti di sesi ini
    const standalone = isStandaloneApp();
    const dismissed = sessionStorage.getItem(storageKey) === "1";

    if (!standalone && !dismissed) {
      // Tampilkan popup setelah delay singkat (750ms) pasca login berhasil
      const timer = window.setTimeout(() => {
        setShowModal(true);
      }, 750);

      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setPrompt(e as InstallPromptEvent);
      };

      const handleInstallReady = () => {
        if (window.__okesihInstallPrompt) {
          setPrompt(window.__okesihInstallPrompt as InstallPromptEvent);
        }
      };

      if (window.__okesihInstallPrompt) {
        setPrompt(window.__okesihInstallPrompt as InstallPromptEvent);
      }

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("okesih-install-ready", handleInstallReady);

      return () => {
        window.clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("okesih-install-ready", handleInstallReady);
      };
    }
  }, [storageKey]);

  if (!showModal) return null;

  const handleInstallClick = async () => {
    if (prompt) {
      const result = await prompt.prompt();
      if (result.outcome === "accepted") {
        setShowModal(false);
        try {
          sessionStorage.setItem(storageKey, "1");
        } catch {}
      }
      setPrompt(null);
    } else {
      setHelperText(
        "Buka menu browser Anda (ikon titik tiga ⋮ di Chrome atau tombol Bagikan ⎋ di Safari iOS), lalu pilih 'Tambahkan ke Layar Utama' / 'Instal Aplikasi'."
      );
    }
  };

  const dismissModal = () => {
    setShowModal(false);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {}
  };

  const accentColor = config?.themeColor || "#f4512c";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99990,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        backgroundColor: "rgba(3, 7, 18, 0.8)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        animation: "pwaFadeIn 0.25s ease-out forwards",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#0d131f",
          border: `1px solid ${accentColor}40`,
          borderRadius: "1.25rem",
          padding: "2rem 1.5rem",
          boxShadow: `0 25px 50px -12px ${accentColor}30, 0 0 0 1px rgba(255,255,255,0.06)`,
          textAlign: "center",
          color: "#f3f4f6",
        }}
      >
        {/* App Logo */}
        <div
          style={{
            width: "80px",
            height: "80px",
            margin: "0 auto 1.25rem",
            borderRadius: "1.25rem",
            backgroundColor: "#060a12",
            border: `2px solid ${accentColor}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.75rem",
            boxShadow: `0 12px 24px -6px ${accentColor}40`,
          }}
        >
          <Image
            src="/logo.svg"
            alt={config?.name || "OKESIH"}
            width={64}
            height={64}
            priority
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "#ffffff",
            marginBottom: "0.5rem",
            letterSpacing: "-0.01em",
          }}
        >
          {appTitle}
        </h3>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "0.875rem",
            color: "#9ca3af",
            lineHeight: 1.55,
            marginBottom: "1.25rem",
          }}
        >
          {appSubtitle}
        </p>

        {/* Helper instructions if browser prompt cannot be invoked directly */}
        {helperText && (
          <div
            style={{
              backgroundColor: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: "0.75rem",
              padding: "0.75rem 1rem",
              marginBottom: "1.25rem",
              fontSize: "0.8rem",
              color: "#93c5fd",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            ℹ {helperText}
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
          }}
        >
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.85rem 1.25rem",
              backgroundColor: accentColor,
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "0.95rem",
              borderRadius: "0.75rem",
              border: "none",
              cursor: "pointer",
              boxShadow: `0 10px 20px -5px ${accentColor}60`,
              transition: "transform 0.15s ease, opacity 0.15s ease",
            }}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Pasang Sekarang</span>
          </button>

          <button
            type="button"
            onClick={dismissModal}
            style={{
              width: "100%",
              padding: "0.7rem 1.25rem",
              backgroundColor: "transparent",
              color: "#9ca3af",
              fontWeight: 600,
              fontSize: "0.875rem",
              borderRadius: "0.75rem",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              cursor: "pointer",
              transition: "color 0.15s ease, border-color 0.15s ease",
            }}
          >
            Nanti Saja
          </button>
        </div>
      </div>
    </div>
  );
}
