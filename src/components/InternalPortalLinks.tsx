"use client";

import { APP_ORIGINS, appUrl, roleLoginUrl } from "@/lib/app-origins";

const portals = [
  { label: "Owner", description: "Kelola usaha dan perangkat", href: roleLoginUrl("OWNER"), icon: "🏪" },
  { label: "Super Admin", description: "Administrasi platform", href: roleLoginUrl("SUPERADMIN"), icon: "🛡️" },
  { label: "Sales", description: "Portal marketing OKESIH", href: roleLoginUrl("MARKETING"), icon: "📈" },
  { label: "Kasir POS", description: "Buka aplikasi kasir", href: appUrl("POS", "/pos"), icon: "🧾" },
  { label: "Dapur KDS", description: "Buka layar dapur", href: appUrl("KDS", "/kds"), icon: "🍳" },
] as const;

export default function InternalPortalLinks() {
  return (
    <div style={{ display: "grid", gap: "0.7rem" }}>
      {portals.map((portal) => (
        <a
          key={portal.label}
          href={portal.href}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            padding: "0.85rem 1rem",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-surface-1)",
            color: "var(--text-pure-white)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true" style={{ fontSize: "1.35rem" }}>{portal.icon}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: "0.95rem" }}>{portal.label}</strong>
            <small style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>{portal.description}</small>
          </span>
          <span aria-hidden="true">→</span>
        </a>
      ))}
      <small style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "0.25rem" }}>
        Setiap portal memakai sesi terpisah untuk keamanan. Domain publik: {new URL(APP_ORIGINS.PUBLIC).hostname}
      </small>
    </div>
  );
}
