"use client";

import { useEffect, useState } from "react";
import { isStandaloneApp } from "@/lib/pwa-routing";
import { PWA_INSTALLED_STORAGE_KEY } from "@/lib/pwa-install";

type RelatedApp = { id?: string; platform?: string; url?: string };
type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
  standalone?: boolean;
};

export function usePwaInstallStatus(manifestPath: string) {
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nav = navigator as NavigatorWithRelatedApps;
    const displayMode = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)");

    const detect = async () => {
      let rememberedInstalled = false;
      try { rememberedInstalled = localStorage.getItem(PWA_INSTALLED_STORAGE_KEY) === "1"; } catch {}
      if (window.__okesihInstallPrompt) rememberedInstalled = false;
      let nextInstalled = isStandaloneApp() || rememberedInstalled;
      if (!nextInstalled && nav.getInstalledRelatedApps) {
        try {
          const apps = await nav.getInstalledRelatedApps();
          nextInstalled = apps.some((app) =>
            app.platform === "webapp" && (
              app.id === "/" ||
              app.id === "/pos" ||
              app.url === manifestPath ||
              app.url?.endsWith(manifestPath)
            )
          );
        } catch {
          // The API is optional and may be blocked outside a secure context.
        }
      }
      if (!cancelled) setInstalled(nextInstalled);
    };

    const markInstalled = () => {
      try { localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, "1"); } catch {}
      setInstalled(true);
    };
    const handleInstallReady = () => void detect();
    const handleDisplayMode = () => void detect();
    void detect();
    window.addEventListener("appinstalled", markInstalled);
    window.addEventListener("okesih-install-ready", handleInstallReady);
    displayMode.addEventListener?.("change", handleDisplayMode);
    return () => {
      cancelled = true;
      window.removeEventListener("appinstalled", markInstalled);
      window.removeEventListener("okesih-install-ready", handleInstallReady);
      displayMode.removeEventListener?.("change", handleDisplayMode);
    };
  }, [manifestPath]);

  return installed;
}
