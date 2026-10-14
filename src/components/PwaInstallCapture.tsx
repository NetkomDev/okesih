"use client";

import { useEffect } from "react";
import { installationKind } from "@/lib/pwa-routing";

export default function PwaInstallCapture() {
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      window.__okesihInstallPrompt = event;
      window.__okesihInstallKind = installationKind(window.location.pathname);
      window.dispatchEvent(new Event("okesih-install-ready"));
    };
    const installed = () => { window.__okesihInstallPrompt = undefined; };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}

declare global {
  interface Window { __okesihInstallPrompt?: Event; __okesihInstallKind?: "POS" | "KDS" | "OWNER" | "MARKETING" | "SUPERADMIN" | "DASHBOARD"; }
}
