"use client";
import type { Tab } from "./context";

const items: { tab: Tab; label: string; path: string }[] = [
  { tab: "overview", label: "Ringkasan", path: "M3 13h7v8H3z M14 3h7v18h-7z M3 3h7v6H3z" },
  { tab: "tenants", label: "Tenant", path: "M3 21h18 M5 21V5l7-3 7 3v16 M9 8h1 M14 8h1 M9 12h1 M14 12h1 M10 21v-5h4v5" },
  { tab: "marketing", label: "Mitra", path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
  { tab: "qris_billing", label: "Tagihan", path: "M5 3h14v18l-3-2-4 2-4-2-3 2z M9 7h6 M9 11h6 M9 15h3" },
  { tab: "platform_config", label: "Pengaturan", path: "M4 7h9 M17 7h3 M4 17h3 M11 17h9 M17 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M11 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0" },
];

export default function MobileNav({ activeTab, onNavigate }: { activeTab: Tab; onNavigate: (tab: Tab) => void }) {
  return <nav className="sa-mobile-nav" aria-label="Menu utama Super Admin">
    {items.map(({ tab, label, path }) => <button type="button" key={tab} aria-current={activeTab === tab ? "page" : undefined} onClick={() => onNavigate(tab)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
      <span>{label}</span>
    </button>)}
  </nav>;
}
