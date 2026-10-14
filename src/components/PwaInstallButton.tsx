"use client";

import { useEffect, useState } from "react";
import { installationKind } from "@/lib/pwa-routing";
import { requestPwaInstallation } from "@/lib/pwa-install";

export default function PwaInstallButton({ label = "Install Aplikasi", compact = false, onInstalled }: { label?: string; compact?: boolean; onInstalled?: () => void }) {
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const initialTimer = window.setTimeout(() => {
      if (standalone) setInstalled(true);
      setAvailable(Boolean(window.__okesihInstallPrompt));
    }, 0);
    const installReady = () => setAvailable(Boolean(window.__okesihInstallPrompt));
    const appInstalled = () => { setInstalled(true); setAvailable(false); onInstalled?.(); };
    window.addEventListener("okesih-install-ready", installReady);
    window.addEventListener("appinstalled", appInstalled);
    return () => { window.clearTimeout(initialTimer); window.removeEventListener("okesih-install-ready", installReady); window.removeEventListener("appinstalled", appInstalled); };
  }, [onInstalled]);

  if (installed) return <span className={compact ? "pwa-installed compact" : "pwa-installed"}>✓ Aplikasi terpasang</span>;
  return <button className={compact ? "pwa-install compact" : "pwa-install"} onClick={async () => {
    const currentKind = installationKind(window.location.pathname);
    if (available && window.__okesihInstallKind !== currentKind) {
      alert("Halaman akan dimuat ulang untuk menyiapkan aplikasi sesuai fungsi ini. Setelah terbuka, tekan Install kembali.");
      window.location.reload();
      return;
    }
    const outcome = await requestPwaInstallation(currentKind);
    setAvailable(false);
    if (outcome === "accepted") onInstalled?.();
    if (outcome === "unavailable") alert("Buka menu browser, lalu pilih ‘Instal aplikasi’ atau ‘Tambahkan ke layar utama’.");
  }}>{label}</button>;
}
