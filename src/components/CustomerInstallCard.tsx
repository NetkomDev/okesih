"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requestPwaInstallation } from "@/lib/pwa-install";
import { isStandaloneApp } from "@/lib/pwa-routing";

export default function CustomerInstallCard() {
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneApp());
    setAvailable(Boolean(window.__okesihInstallPrompt));

    const onReady = () => setAvailable(Boolean(window.__okesihInstallPrompt));
    const onInstalled = () => {
      setInstalled(true);
      setAvailable(false);
      setInstallSuccess(true);
    };

    window.addEventListener("okesih-install-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("okesih-install-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installed) return;
    const outcome = await requestPwaInstallation();
    if (outcome === "accepted") {
      setInstalled(true);
      setInstallSuccess(true);
      setAvailable(false);
    } else {
      setShowTip(true);
    }
  };

  return (
    <div className="customer-install-card" role="region" aria-label="Install Aplikasi Scanner">
      <div className="customer-install-header">
        <div className="customer-install-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <rect x="7" y="7" width="10" height="10" rx="1.5" />
            <line x1="7" y1="12" x2="17" y2="12" stroke="#f4512c" strokeWidth="2.5" />
          </svg>
        </div>
        <div className="customer-install-title">
          <span className="customer-install-badge">APLIKASI SCANNER RESMI</span>
          <h3>Install Aplikasi Scanner Menu</h3>
        </div>
      </div>

      <p className="customer-install-desc">
        Pasang di layar HP Anda. Langsung scan QR di meja mana saja pada seluruh warkop &amp; kafe jaringan OKESIH tanpa perlu login akun.
      </p>

      <div className="customer-install-actions">
        {installSuccess || installed ? (
          <div className="customer-install-success">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Aplikasi sudah terpasang di HP Anda</span>
          </div>
        ) : (
          <button
            type="button"
            className="customer-btn-install"
            onClick={handleInstall}
            aria-label="Install Aplikasi Scanner Menu"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Install Aplikasi
          </button>
        )}

        <Link href="/scan" className="customer-btn-open-scan">
          Buka Scanner QR Meja Sekarang <i>→</i>
        </Link>
      </div>

      {showTip && !installed && (
        <div className="customer-install-tip">
          <small>
            💡 <strong>Panduan Pemasangan Cepat:</strong><br />
            • <strong>Chrome / Android:</strong> Ketuk menu titik tiga (⋮) di pojok kanan atas, lalu pilih <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> atau <strong>&quot;Instal Aplikasi&quot;</strong>.<br />
            • <strong>Safari / iPhone:</strong> Ketuk tombol Bagikan (ikon kotak panah ke atas ⎋) di bilah bawah, lalu pilih <strong>&quot;Add to Home Screen&quot; (Tambahkan ke Layar Utama)</strong>.
          </small>
        </div>
      )}
    </div>
  );
}
