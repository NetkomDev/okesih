"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { installationKind, isStandaloneApp } from "@/lib/pwa-routing";
import { requestPwaInstallation } from "@/lib/pwa-install";
import { usePwaInstallStatus } from "@/lib/use-pwa-install-status";

interface DevicePwaModalProps {
  type: "POS" | "KDS";
  isOpen?: boolean;
  onClose?: () => void;
}

export default function DevicePwaModal({ type, isOpen, onClose }: DevicePwaModalProps) {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const detectedInstalled = usePwaInstallStatus(type === "POS" ? "/pos/manifest.webmanifest" : "/kds/manifest.webmanifest");

  const title = type === "POS" ? "OKESIH Kasir" : "OKESIH Dapur KDS";
  const desc = type === "POS" ? "Aplikasi Kasir POS Warkop & Resto" : "Layar Antrean Dapur & Barista";

  // Auto-lock screen orientation to landscape when supported
  useEffect(() => {
    if (type === "POS") return;
    const lockLandscape = async () => {
      try {
        if (typeof window !== "undefined" && "orientation" in screen && "lock" in screen.orientation) {
          await (screen.orientation as unknown as { lock: (orientation: string) => Promise<void> }).lock("landscape");
        }
      } catch {
        // Browser requires user interaction or fullscreen
      }
    };

    void lockLandscape();
    const handleTouch = () => {
      void lockLandscape();
    };
    window.addEventListener("pointerdown", handleTouch, { once: true });
    return () => window.removeEventListener("pointerdown", handleTouch);
  }, [type]);

  // Check standalone, iOS, and prompt availability
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkPrompt = () => {
      setCanPrompt(Boolean(window.__okesihInstallPrompt));
    };

    window.addEventListener("okesih-install-ready", checkPrompt);
    const initialTimer = window.setTimeout(() => {
      const standalone = isStandaloneApp();
      setIsStandalone(standalone);

      const ua = window.navigator.userAgent.toLowerCase();
      const isApple = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setIsIos(isApple);
      checkPrompt();

      // Auto trigger popup if just paired
      const justPairedKey = `okesih_just_paired_${type}`;
      const justPaired = sessionStorage.getItem(justPairedKey) === "true";
      if (justPaired && !standalone && detectedInstalled !== true) {
        sessionStorage.removeItem(justPairedKey);
        setShow(true);
      }
    }, 0);

    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener("okesih-install-ready", checkPrompt);
    };
  }, [detectedInstalled, type]);

  // Popup manual dari header dan popup otomatis setelah pairing dapat hidup
  // bersamaan; nilai false dari parent tidak boleh mematikan trigger pairing.
  const visible = Boolean(isOpen) || show;

  const handleClose = () => {
    setShow(false);
    onClose?.();
  };

  const handleInstallClick = async () => {
    const currentKind = installationKind(window.location.pathname);
    const outcome = await requestPwaInstallation(currentKind);
    if (outcome === "accepted" || outcome === "dismissed") {
      handleClose();
    } else if (outcome === "unavailable") {
      if (isIos) {
        // iOS instructions are shown in modal
      } else {
        alert("Buka menu browser Anda (titik tiga di kanan atas), lalu pilih 'Instal aplikasi' atau 'Tambahkan ke Layar Utama'.");
      }
    }
  };

  return (
    <>
      {/* PWA Install Modal */}
      {visible && !isStandalone && detectedInstalled !== true && (
        <div className="ops-modal-backdrop" style={{ zIndex: 120 }}>
          <section
            className="ops-modal"
            style={{
              width: "min(500px, 94vw)",
              borderRadius: "24px",
              padding: "26px",
              boxShadow: "0 25px 60px rgba(15,23,42,0.4)",
              background: "#fff",
            }}
          >
            <button className="ops-modal-close" onClick={handleClose} aria-label="Tutup modal">
              ×
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: type === "POS" ? "#fff0eb" : "#f0fdf4",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                }}
              >
                <Image src="/logo.svg?v=2" width={38} height={38} alt="OKESIH" />
              </div>
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "#ecfdf5",
                    color: "#059669",
                    fontSize: "11px",
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                  }}
                >
                  ✓ PERANGKAT TERHUBUNG
                </span>
                <h2 style={{ fontSize: "22px", margin: "4px 0 0", color: "#0f172a", fontWeight: 850 }}>
                  Pasang {title}
                </h2>
                <small style={{ color: "#64748b", fontWeight: 700, fontSize: "12px" }}>{desc}</small>
              </div>
            </div>

            <p style={{ color: "#334155", fontSize: "14px", lineHeight: "1.5", margin: "0 0 16px" }}>
              Pasang sebagai aplikasi layar utama (PWA) di perangkat ini agar selalu tampil otomatis dalam mode{" "}
              <strong style={{ color: "#f4512c" }}>Landscape Layar Penuh (Fullscreen)</strong> tanpa bilah URL browser.
            </p>

            <div
              style={{
                display: "grid",
                gap: "10px",
                padding: "14px",
                background: "#f8fafc",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                marginBottom: "20px",
                fontSize: "13px",
                color: "#1e293b",
              }}
            >
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>🖥️</span>
                <span>
                  <strong>Otomatis Landscape:</strong> Tampilan terkunci horizontal, ideal untuk tablet kasir & monitor dapur.
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>⚡</span>
                <span>
                  <strong>Akses Langsung:</strong> Buka instan dari layar utama tanpa repot mengetik URL browser.
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>📶</span>
                <span>
                  <strong>Stabil Offline:</strong> Transaksi dan antrean tetap aman tersimpan saat internet tersendat.
                </span>
              </div>
            </div>

            {isIos ? (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "14px",
                  padding: "14px",
                  marginBottom: "16px",
                  fontSize: "13px",
                  color: "#1e40af",
                }}
              >
                <strong>Cara Pasang di iPad / iPhone (Safari):</strong>
                <ol style={{ margin: "6px 0 0", paddingLeft: "20px", lineHeight: "1.6" }}>
                  <li>
                    Ketuk tombol <strong>Bagikan / Share</strong> (ikon kotak dengan panah ke atas).
                  </li>
                  <li>
                    Pilih menu <strong>&apos;Tambahkan ke Layar Utama&apos; (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Ketuk <strong>&apos;Tambah&apos; (Add)</strong> di pojok kanan atas.
                  </li>
                </ol>
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: "12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  background: "#fff",
                  color: "#475569",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Nanti Saja
              </button>

              <button
                type="button"
                onClick={() => void handleInstallClick()}
                className="btn-primary"
                style={{
                  padding: "12px",
                  border: 0,
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #f4512c 0%, #e03a16 100%)",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: "14px",
                  boxShadow: "0 4px 14px rgba(244,81,44,0.35)",
                  cursor: "pointer",
                }}
              >
                {canPrompt ? "📲 Install Sekarang" : "📲 Pasang Aplikasi"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
