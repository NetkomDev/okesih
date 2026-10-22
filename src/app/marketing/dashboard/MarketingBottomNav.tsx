"use client";

import { useMarketingData } from "./MarketingContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MarketingBottomNav() {
  const pathname = usePathname();
  const { data } = useMarketingData();

  const navItems = [
    {
      label: "Home",
      href: "/marketing/dashboard",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      active: pathname === "/marketing/dashboard",
    },
    {
      label: "Tenant",
      href: "/marketing/dashboard/tenant-binaan",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18" />
          <path d="M5 21V7l8-4v18" />
          <path d="M19 21V11l-6-3" />
          <path d="M9 9v.01" />
          <path d="M9 12v.01" />
          <path d="M9 15v.01" />
          <path d="M9 18v.01" />
        </svg>
      ),
      active: pathname.startsWith("/marketing/dashboard/tenant-binaan"),
    },
    {
      label: "Status",
      href: "/marketing/dashboard/pengajuan",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      active: pathname.startsWith("/marketing/dashboard/pengajuan"),
    },
    {
      label: "Komisi",
      href: "/marketing/dashboard/komisi",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      active: pathname.startsWith("/marketing/dashboard/komisi"),
    },
    {
      label: "Profil",
      href: "/marketing/dashboard/profil",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      active: pathname.startsWith("/marketing/dashboard/profil"),
    },
  ];

  if (data?.profile.membershipLevel === "COORDINATOR") {
    navItems.splice(3, 0, {
      label: "KorMit",
      href: "/marketing/dashboard/kormit",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      active: pathname.startsWith("/marketing/dashboard/kormit"),
    });
  }

  return (
    <nav className="mkt-bottom-navbar" aria-label="Navigasi PWA Marketing">
      <div className="mkt-bottom-nav-inner" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`mkt-nav-item ${item.active ? "active" : ""}`}
            aria-current={item.active ? "page" : undefined}
          >
            <span className="mkt-nav-icon">{item.icon}</span>
            <span className="mkt-nav-label">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
