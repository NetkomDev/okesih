"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<{ outcome: "accepted" | "dismissed" }> };

export default function PwaInstallButton({ label = "Install Aplikasi", compact = false, onInstalled }: { label?: string; compact?: boolean; onInstalled?: () => void }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const initialTimer = window.setTimeout(() => {
      if (standalone) setInstalled(true);
      if (window.__okesihInstallPrompt) setPrompt(window.__okesihInstallPrompt as InstallPromptEvent);
    }, 0);
    const beforeInstall = (event: Event) => { event.preventDefault(); window.__okesihInstallPrompt = event; setPrompt(event as InstallPromptEvent); };
    const installReady = () => { if (window.__okesihInstallPrompt) setPrompt(window.__okesihInstallPrompt as InstallPromptEvent); };
    const appInstalled = () => { setInstalled(true); setPrompt(null); onInstalled?.(); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("okesih-install-ready", installReady);
    window.addEventListener("appinstalled", appInstalled);
    return () => { window.clearTimeout(initialTimer); window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("okesih-install-ready", installReady); window.removeEventListener("appinstalled", appInstalled); };
  }, [onInstalled]);

  if (installed) return <span className={compact ? "pwa-installed compact" : "pwa-installed"}>✓ Aplikasi terpasang</span>;
  return <button className={compact ? "pwa-install compact" : "pwa-install"} onClick={async () => {
    if (prompt) { const result = await prompt.prompt(); if (result.outcome === "accepted") onInstalled?.(); window.__okesihInstallPrompt = undefined; setPrompt(null); }
    else alert("Gunakan menu browser lalu pilih ‘Install aplikasi’ atau ‘Tambahkan ke layar utama’. Fitur ini bergantung pada browser dan perangkat.");
  }}>{label}</button>;
}
