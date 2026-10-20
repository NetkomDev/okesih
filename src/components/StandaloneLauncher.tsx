"use client";

import { useEffect } from "react";
import { isStandaloneApp, detectActivePwaKind } from "@/lib/pwa-routing";

export default function StandaloneLauncher() {
  useEffect(() => {
    if (!isStandaloneApp()) return;

    // Jika pengguna sengaja membuka beranda dengan parameter view=landing atau from=scanner
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "landing" || params.get("from") === "scanner") {
      return;
    }

    // Cek jika pengguna memiliki PWA internal (owner, marketing, superadmin, pos, kds)
    const activePwa = detectActivePwaKind();
    if (activePwa === "owner") {
      window.location.replace("/owner");
      return;
    }
    if (activePwa === "superadmin") {
      window.location.replace("/superadmin");
      return;
    }
    if (activePwa === "marketing") {
      window.location.replace("/marketing/dashboard");
      return;
    }
    if (activePwa === "pos") {
      window.location.replace("/pos");
      return;
    }
    if (activePwa === "kds") {
      window.location.replace("/kds");
      return;
    }

    // Default: PWA terpasang di origin publik yang dibuka pengguna adalah aplikasi scanner meja
    window.location.replace("/scan");
  }, []);

  return null;
}
