"use client";

import { useEffect, useState } from "react";
import { requestPwaInstallation } from "@/lib/pwa-install";
import { isStandaloneApp } from "@/lib/pwa-routing";

export default function CustomerInstallCard() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const initial = window.setTimeout(() => setInstalled(isStandaloneApp()), 0);
    const onAppInstalled = () => setInstalled(true);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => { clearTimeout(initial); window.removeEventListener("appinstalled", onAppInstalled); };
  }, []);

  const handleInstall = async () => {
    try {
      localStorage.setItem("okesih_installed_pwa_role", "scanner");
    } catch {}

    if (installed) {
      window.location.href = "/scan";
      return;
    }
    const outcome = await requestPwaInstallation();
    if (outcome === "accepted") {
      setInstalled(true);
    } else if (outcome === "unavailable") {
      // Browser tidak mendukung programmatic prompt (misal iOS Safari), langsung buka scanner
      window.location.href = "/scan";
    }
  };

  return (
    <button
      type="button"
      className="btn-install-clean"
      onClick={handleInstall}
      aria-label="Install Aplikasi"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span>{installed ? "Buka Aplikasi Scanner" : "Install Aplikasi"}</span>
    </button>
  );
}
