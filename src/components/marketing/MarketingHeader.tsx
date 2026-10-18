import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";

export default function MarketingHeader() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        backgroundColor: "rgba(13, 13, 14, 0.85)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0.85rem 1.5rem",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              fontWeight: 700,
              textDecoration: "none",
              padding: "0.45rem 0.95rem",
              borderRadius: "var(--radius-pill)",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border-subtle)",
              transition: "all 0.2s ease",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "inline-block", flexShrink: 0 }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Beranda</span>
          </Link>

          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Image
                src="/logo.svg?v=2"
                alt="Logo OKESIH.COM"
                width={40}
                height={40}
                style={{ width: "40px", height: "40px", objectFit: "contain", display: "block", flexShrink: 0 }}
              />
              <span style={{ fontWeight: 900, fontSize: "1.1rem" }}>
                OKESIH<span style={{ color: "var(--brand-orange-light)" }}>.COM</span>
              </span>
            </div>
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ThemeToggle />
          <Link
            href="/marketing/daftar"
            className="btn-primary"
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)",
              padding: "0.55rem 1.25rem",
              fontSize: "0.85rem",
              fontWeight: 800,
              borderRadius: "var(--radius-pill)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
            }}
          >
            <span>📝</span>
            <span>Daftar Jadi Mitra</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
