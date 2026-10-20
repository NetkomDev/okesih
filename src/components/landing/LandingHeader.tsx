"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

interface LandingHeaderProps {
  saasFeePerReceipt?: number;
  marketingCommission?: number;
}

export default function LandingHeader({
  saasFeePerReceipt = 50,
  marketingCommission = 15,
}: LandingHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleOpenLogin = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("okesih:open-login"));
    }
  };

  return (
    <>
      <header
        className="site-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.1rem 2rem",
          borderBottom: "1px solid var(--border-subtle)",
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "rgba(13, 13, 14, 0.88)",
        }}
      >
        {/* Logo & Brand */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.85rem", textDecoration: "none", color: "inherit" }}>
          <Image
            src="/logo.svg?v=2"
            alt="Logo OKESIH.COM"
            width={46}
            height={46}
            priority
            style={{
              width: "46px",
              height: "46px",
              objectFit: "contain",
              display: "block",
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
              OKESIH<span style={{ color: "var(--brand-orange-light)" }}>.COM</span>
            </div>
            <div className="brand-tagline-text" style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 500 }}>
              Platform Kasir &amp; Operasional Kafe &amp; Resto
            </div>
          </div>
        </Link>

        {/* Navigation Links (Desktop Only) */}
        <nav style={{ display: "flex", alignItems: "center", gap: "1.5rem" }} className="desktop-nav">
          <a href="#solusi" style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}>
            Solusi Usaha
          </a>
          <a href="#fitur" style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}>
            Fitur Lengkap
          </a>
          <a href="#keunggulan" style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}>
            Keunggulan
          </a>
          <a href="#tarif" style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}>
            Biaya Sewa
          </a>
          <Link href="/marketing" style={{ color: "var(--accent-emerald)", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none" }}>
            💼 Mitra Marketing
          </Link>
          <a href="#faq" style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}>
            FAQ
          </a>
        </nav>

        {/* Action Buttons, Theme Toggle & Hamburger Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <Link
            href="/marketing"
            className="marketing-pill-btn desktop-only-btn"
          >
            <span>💼</span>
            <span>Jadi Mitra Marketing</span>
          </Link>

          <ThemeToggle />

          <button
            type="button"
            onClick={handleOpenLogin}
            className="btn-primary desktop-only-btn"
            title="Masuk ke Akun"
            aria-label="Masuk ke Akun"
            style={{
              width: "38px",
              height: "38px",
              padding: "0",
              borderRadius: "10px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: "none",
              background: "linear-gradient(135deg, #FF5722, #FF4500)",
              boxShadow: "0 4px 14px var(--brand-orange-glow)",
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <path d="M 9 8 V 7 A 4 4 0 0 1 13 3 H 17 A 4 4 0 0 1 21 7 V 17 A 4 4 0 0 1 17 21 H 13 A 4 4 0 0 1 9 17 V 16" />
              <path d="M 3 12 H 15" />
              <path d="M 11 8 L 15 12 L 11 16" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="mobile-nav-toggle"
            aria-label={isMobileMenuOpen ? "Tutup Menu" : "Buka Menu"}
            style={{
              background: isMobileMenuOpen ? "rgba(255, 69, 0, 0.2)" : "rgba(255, 255, 255, 0.06)",
              border: isMobileMenuOpen ? "1px solid rgba(255, 69, 0, 0.4)" : "1px solid var(--border-subtle)",
              borderRadius: "10px",
              color: isMobileMenuOpen ? "var(--brand-orange-light)" : "var(--text-pure-white)",
              padding: "0.45rem 0.75rem",
              fontSize: "1.2rem",
              cursor: "pointer",
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {isMobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown / Drawer */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-drawer">
          <a
            href="#solusi"
            className="mobile-nav-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>☕ Solusi Usaha</span>
            <span>→</span>
          </a>
          <a
            href="#fitur"
            className="mobile-nav-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>⚡ Fitur Lengkap</span>
            <span>→</span>
          </a>
          <a
            href="#keunggulan"
            className="mobile-nav-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>💎 Keunggulan</span>
            <span>→</span>
          </a>
          <a
            href="#tarif"
            className="mobile-nav-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>🏷️ Biaya Sewa (Rp {saasFeePerReceipt.toLocaleString("id-ID")})</span>
            <span>→</span>
          </a>
          <Link
            href="/marketing"
            className="mobile-nav-link"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{
              background: "var(--accent-emerald-bg)",
              border: "1px solid var(--accent-emerald-border)",
              color: "var(--accent-emerald)",
              fontWeight: 800,
            }}
          >
            <span>💼 Program Mitra Marketing (Rp {marketingCommission.toLocaleString("id-ID")}/Struk)</span>
            <span>→</span>
          </Link>
          <a
            href="#faq"
            className="mobile-nav-link"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>❓ Tanya Jawab (FAQ)</span>
            <span>→</span>
          </a>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.25rem" }}>
              <ThemeToggle showText={true} />
            </div>
            <Link
              href="/menu/demo?table=01"
              target="_blank"
              className="btn-primary"
              onClick={() => setIsMobileMenuOpen(false)}
              style={{ textAlign: "center", padding: "0.85rem", fontWeight: 800, fontSize: "0.9rem" }}
            >
              📱 Coba Demo QR Menu Meja
            </Link>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleOpenLogin();
              }}
              style={{
                textAlign: "center",
                padding: "0.85rem",
                fontWeight: 800,
                fontSize: "0.9rem",
                cursor: "pointer",
                border: "1px solid var(--border-subtle)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.6rem",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FF5722"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: "inline-block", verticalAlign: "middle" }}
              >
                <path d="M 9 8 V 7 A 4 4 0 0 1 13 3 H 17 A 4 4 0 0 1 21 7 V 17 A 4 4 0 0 1 17 21 H 13 A 4 4 0 0 1 9 17 V 16" />
                <path d="M 3 12 H 15" />
                <path d="M 11 8 L 15 12 L 11 16" />
              </svg>
              <span>Masuk ke Akun</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
