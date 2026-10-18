import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";

export default function MarketingHeader() {
  return (
    <header className="marketing-header">
      <div className="marketing-header-inner">
        {/* Sisi Kiri: Tombol Back & Logo Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
          <Link
            href="/"
            className="marketing-back-btn"
            title="Kembali ke Beranda"
            aria-label="Kembali ke Beranda"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block", flexShrink: 0 }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Beranda</span>
          </Link>

          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              minWidth: 0,
            }}
          >
            <Image
              src="/logo.svg?v=2"
              alt="Logo OKESIH.COM"
              width={38}
              height={38}
              className="marketing-header-logo"
              style={{ width: "38px", height: "38px", objectFit: "contain", display: "block", flexShrink: 0 }}
            />
            <span
              className="marketing-header-brand-text"
              style={{
                fontWeight: 900,
                fontSize: "1.1rem",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              OKESIH<span style={{ color: "var(--brand-orange-light)" }}>.COM</span>
            </span>
          </Link>
        </div>

        {/* Sisi Kanan: Theme Toggle & Tombol CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <ThemeToggle />
          <Link
            href="/marketing/daftar"
            className="marketing-header-cta"
            title="Buka Formulir Pendaftaran Mitra Marketing"
          >
            <span>📝</span>
            <span className="marketing-cta-short-text">Daftar</span>
            <span className="marketing-cta-long-text">Daftar Jadi Mitra</span>
            <span className="marketing-cta-long-text">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
