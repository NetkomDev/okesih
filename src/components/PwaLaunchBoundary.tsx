"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isDashboardLaunch } from "@/lib/pwa-routing";

function isInstalled() {
  return window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

/** Check once per document launch, not after client-side navigation from login. */
export default function PwaLaunchBoundary({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    if (pathname === "/" && isInstalled()) window.location.replace("/login");
  }, [pathname]);
  useEffect(() => {
    const redirect = () => {
      if (isInstalled() && isDashboardLaunch(window.location.pathname)) {
        window.location.replace("/login");
        return true;
      }
      return false;
    };
    const timer = window.setTimeout(() => { if (!redirect()) setReady(true); }, 0);
    // A restored document must not bypass the launch screen through back/forward cache.
    const restored = (event: PageTransitionEvent) => { if (event.persisted) redirect(); };
    const resumed = () => {
      if (!isInstalled() || !isDashboardLaunch(window.location.pathname)) return;
      if (document.visibilityState === "hidden") setReady(false);
      else redirect();
    };
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", resumed);
    return () => {
      window.clearTimeout(timer); window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", resumed);
    };
  }, []);
  // Keep the server-rendered website available, but hide it until launch detection finishes.
  return <div style={ready ? { display: "contents" } : { visibility: "hidden" }}>{children}</div>;
}
