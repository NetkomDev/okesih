"use client";

import Link from "next/link";

export default function MobileBottomBar() {
  const handleOpenLogin = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("okesih:open-login"));
    }
  };

  return (
    <div className="mobile-bottom-bar">
      <Link
        href="/menu/demo?table=01"
        target="_blank"
        className="btn-primary"
        style={{
          flex: 1,
          fontSize: "0.85rem",
          padding: "0.75rem 0.5rem",
          textAlign: "center",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.35rem",
          borderRadius: "10px",
          textDecoration: "none",
        }}
      >
        <span>📱</span>
        <span>Demo QR</span>
      </Link>
      <button
        type="button"
        onClick={handleOpenLogin}
        className="btn-secondary"
        style={{
          flex: 1,
          fontSize: "0.85rem",
          padding: "0.75rem 0.5rem",
          textAlign: "center",
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.35rem",
          borderRadius: "10px",
          cursor: "pointer",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <span>🔑</span>
        <span>Masuk Akun</span>
      </button>
    </div>
  );
}
