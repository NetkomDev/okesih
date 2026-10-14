"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isDashboardLaunch } from "@/lib/pwa-routing";

function isInstalled() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

/** Check once per document launch, and redirect dashboard PWAs to login screen */
export default function PwaLaunchBoundary({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const redirect = () => {
      if (typeof window === "undefined") return false;
      if (isInstalled() && isDashboardLaunch(window.location.pathname)) {
        window.location.replace("/login");
        return true;
      }
      return false;
    };

    redirect();

    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) redirect();
    };
    const resumed = () => {
      if (document.visibilityState === "visible") redirect();
    };

    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", resumed);
    return () => {
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", resumed);
    };
  }, [pathname]);

  return children ? <>{children}</> : null;
}

