"use client";

import { useEffect } from "react";
import { installationKind, isDashboardLaunch } from "@/lib/pwa-routing";

function isInstalled() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function PwaInstallCapture() {
  useEffect(() => {
    const checkLaunch = () => {
      if (isInstalled() && isDashboardLaunch(window.location.pathname)) {
        window.location.replace("/login");
        return true;
      }
      return false;
    };
    checkLaunch();

    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) checkLaunch();
    };
    const resumed = () => {
      if (document.visibilityState === "visible") checkLaunch();
    };

    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", resumed);

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
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", resumed);
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}

declare global {
  interface Window { __okesihInstallPrompt?: Event; __okesihInstallKind?: "POS" | "KDS" | "DASHBOARD"; }
}

