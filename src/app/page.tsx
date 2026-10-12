"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { extractUserRole } from "@/lib/auth-helpers";

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err === "login_required") {
        setLoginError("Sesi login diperlukan untuk mengakses dashboard tersebut.");
      } else if (err === "unauthorized") {
        setLoginError("Akses Ditolak: Anda tidak memiliki izin untuk halaman tersebut.");
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError("");

    try {
      const supabase = createClient();
      const email = username.includes("@")
        ? username.trim().toLowerCase()
        : `${username.trim().toLowerCase()}@okesih.local`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoginError(
          error.message === "Invalid login credentials"
            ? "Username atau password salah!"
            : error.message
        );
        setIsLoading(false);
        return;
      }

      // Deteksi peran pengguna secara aman
      const role = extractUserRole(data.user);

      if (role === "SUPERADMIN") {
        router.push("/superadmin");
      } else if (role === "OWNER") {
        router.push("/owner");
      } else if (role === "KASIR") {
        router.push("/pos");
      } else if (role === "DAPUR") {
        router.push("/kds");
      } else {
        router.push("/admin");
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
      setIsLoading(false);
    }
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "OKESIH",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "All (Web, Android, iOS, Windows, macOS)",
    "description":
      "Platform sistem kasir POS Offline-First, Kitchen Display (KDS), QR Menu Meja, dan Antrean TV cerdas untuk kafe, resto, rumah makan, dan warkop.",
    "offers": {
      "@type": "Offer",
      "price": "50",
      "priceCurrency": "IDR",
      "description": "Biaya sewa platform flat Rp 50 per transaksi tercetak tanpa biaya bulanan jutaan.",
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "ratingCount": "128",
    },
  };

  return (
    <>
      {/* Schema.org JSON-LD Structured Data for Google SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          backgroundColor: "var(--bg-deep-black)",
          color: "#FFF",
        }}
      >
        {/* Background Ambient Glows */}
        <div
          className="organic-shape"
          style={{
            width: "600px",
            height: "600px",
            top: "-200px",
            right: "-150px",
            background: "radial-gradient(circle, #FF4500 0%, rgba(255, 69, 0, 0) 70%)",
            opacity: 0.25,
          }}
        />
        <div
          className="organic-shape"
          style={{
            width: "550px",
            height: "550px",
            bottom: "-150px",
            left: "-100px",
            background: "radial-gradient(circle, #D83A00 0%, rgba(216, 58, 0, 0) 70%)",
            opacity: 0.15,
          }}
        />

        {/* Top Navbar */}
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
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #FF5722, #FF4500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px var(--brand-orange-glow)",
                fontWeight: 900,
                fontSize: "1.25rem",
                color: "#FFF",
                flexShrink: 0,
              }}
            >
              ☕
            </div>
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
                OKESIH<span style={{ color: "var(--brand-orange-light)" }}>.COM</span>
              </div>
              <div className="brand-tagline-text" style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 500 }}>
                Platform Kasir &amp; Operasional Kafe, Resto &amp; Warkop
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
            <a href="#faq" style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textDecoration: "none" }}>
              FAQ
            </a>
          </nav>

          {/* Action Buttons & Hamburger Toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <a
              href="#login"
              className="btn-primary desktop-only-btn"
              style={{
                padding: "0.55rem 1.15rem",
                fontSize: "0.85rem",
                fontWeight: 800,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span>Masuk ke Akun</span>
              <span>→</span>
            </a>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="mobile-nav-toggle"
              aria-label={isMobileMenuOpen ? "Tutup Menu" : "Buka Menu"}
              style={{
                background: isMobileMenuOpen ? "rgba(255, 69, 0, 0.2)" : "rgba(255, 255, 255, 0.06)",
                border: isMobileMenuOpen ? "1px solid rgba(255, 69, 0, 0.4)" : "1px solid var(--border-subtle)",
                borderRadius: "10px",
                color: isMobileMenuOpen ? "var(--brand-orange-light)" : "#FFF",
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
              <span>🏷️ Biaya Sewa Rp 50</span>
              <span>→</span>
            </a>
            <a
              href="#faq"
              className="mobile-nav-link"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>❓ Tanya Jawab (FAQ)</span>
              <span>→</span>
            </a>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
              <Link
                href="/menu/giras-nusantara?table=01"
                target="_blank"
                className="btn-primary"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ textAlign: "center", padding: "0.85rem", fontWeight: 800, fontSize: "0.9rem" }}
              >
                📱 Coba Demo QR Menu Meja
              </Link>
              <a
                href="#login"
                className="btn-secondary"
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ textAlign: "center", padding: "0.85rem", fontWeight: 800, fontSize: "0.9rem", textDecoration: "none" }}
              >
                🔑 Masuk ke Akun Sistem
              </a>
            </div>
          </div>
        )}

        {/* HERO SECTION */}
        <section
          className="hero-container"
          style={{
            padding: "4rem 2rem 2.5rem",
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
            textAlign: "center",
            position: "relative",
            zIndex: 5,
          }}
        >
          {/* Badge */}
          <div
            className="hero-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.4rem 1.1rem",
              borderRadius: "var(--radius-pill)",
              backgroundColor: "var(--brand-orange-subtle)",
              border: "1px solid rgba(255, 69, 0, 0.35)",
              color: "var(--brand-orange-light)",
              fontSize: "0.825rem",
              fontWeight: 800,
              marginBottom: "1.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              maxWidth: "100%",
            }}
          >
            ⚡ Solusi POS, Self-Order &amp; Antrean untuk Segala Usaha Penjualan
          </div>

          {/* Heading */}
          <h1
            className="hero-heading"
            style={{
              fontSize: "clamp(2.3rem, 5.5vw, 4rem)",
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: "-0.035em",
              maxWidth: "960px",
              margin: "0 auto 1.5rem",
            }}
          >
            Pesanan Mengalir Cepat,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #FF6A00 0%, #FF4500 50%, #FFA07A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Usaha Kuliner Bebas Macet.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="hero-subtitle"
            style={{
              fontSize: "1.15rem",
              lineHeight: 1.65,
              color: "var(--text-muted)",
              maxWidth: "820px",
              margin: "0 auto 2.5rem",
            }}
          >
            Sistem Kasir (POS) Offline-First, Kitchen Display System (KDS), QR Menu Meja, dan Layar Antrean TV Otomatis.
            Fleksibel untuk <strong>Warkop, Kafe, Rumah Makan, Kedai Kopi, hingga Food Court</strong>.
            Cukup pakai HP &amp; Smart TV yang sudah Anda miliki tanpa biaya alat mahal, sewa flat hanya{" "}
            <strong style={{ color: "#FFF" }}>Rp 50 per transaksi</strong>.
          </p>

          {/* CTA Group */}
          <div className="hero-cta-group" style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "3rem" }}>
            <Link
              href="/menu/giras-nusantara?table=01"
              target="_blank"
              className="btn-primary"
              style={{ padding: "0.85rem 1.6rem", fontSize: "0.95rem", fontWeight: 800 }}
            >
              📱 Coba Demo QR Menu Meja Pelanggan
            </Link>
            <a
              href="#login"
              className="btn-secondary"
              style={{ padding: "0.85rem 1.6rem", fontSize: "0.95rem", fontWeight: 800, textDecoration: "none" }}
            >
              🔑 Masuk ke Portal Operasional
            </a>
          </div>

          {/* Value Props Strip */}
          <div
            className="value-props-container"
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "2rem",
              flexWrap: "wrap",
              padding: "1rem 1.5rem",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "12px",
              maxWidth: "900px",
              margin: "0 auto",
              fontSize: "0.85rem",
              color: "#E2E8F0",
              fontWeight: 600,
            }}
          >
            <div>✓ 100% Uang Penjualan Langsung ke Rekening Anda</div>
            <div>✓ Offline-First (Tetap Jalan Saat Internet Mati)</div>
            <div>✓ Tanpa Beli Mesin Kasir Jutaan Rupiah</div>
            <div>✓ Sewa Hemat Rp 50/Struk</div>
          </div>
        </section>

        {/* SECTION: COCOK UNTUK SEGALA BIDANG USAHA KULINER & PENJUALAN */}
        <section
          id="solusi"
          className="section-container"
          style={{
            padding: "4rem 2rem",
            maxWidth: "1240px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
              Dirancang Fleksibel untuk Segala Jenis Usaha
            </h2>
            <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", maxWidth: "650px", margin: "0 auto" }}>
              Satu sistem yang dapat menyesuaikan karakter alur operasional warung kecil hingga resto berkapasitas besar.
            </p>
          </div>

          <div className="solusi-grid">
            {/* Card 1: Warkop & Kedai Kopi */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>☕</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>Warkop &amp; Kedai Kopi</h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Kelola pesanan kopi dan cemilan dengan cepat. Panggil nomor antrean di TV secara otomatis tanpa teriak.
              </p>
            </div>

            {/* Card 2: Rumah Makan & Warteg */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>🍽️</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>Rumah Makan &amp; Warteg</h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Pencatatan nomor meja akurat, cetak struk bon instan, dan rekonsiliasi kas laci kasir anti-selisih uang.
              </p>
            </div>

            {/* Card 3: Kafe & Bistro Modern */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>🍰</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>Kafe &amp; Bistro Modern</h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Pelanggan pesan mandiri via scan QR di meja, visual foto menu estetik, dan checkout QRIS langsung dari HP.
              </p>
            </div>

            {/* Card 4: Kedai Mie, Bakso & Soto */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>🍜</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>Kedai Mie, Bakso &amp; Soto</h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Sangat hemat tempat, cukup gunakan 1 smartphone untuk kasir dan dapur tanpa butuh meja kasir besar.
              </p>
            </div>

            {/* Card 5: Stand Minuman & Boba */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>🧋</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>Stand Minuman &amp; Boba</h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Layanan cepat take-away &amp; grab-and-go. Urai antrean panjang dengan cepat serta integrasi pencatatan cup harian.
              </p>
            </div>

            {/* Card 6: Food Court & Franchise */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>🍔</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>Food Court &amp; Franchise</h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Layar Smart TV memanggil nomor antrean dengan suara robot TTS, koordinasi pesanan multi-tenant tetap rapi.
              </p>
            </div>

            {/* Card 7: Bakery & Toko Roti */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>🥐</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>Bakery &amp; Toko Roti</h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Pencatatan kasir praktis untuk take-away maupun dine-in, kelola etalase varian rasa dengan update stok harian.
              </p>
            </div>

            {/* Card 8: Angkringan & Street Food */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "2.2rem", marginBottom: "0.75rem" }}>🍢</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>Angkringan &amp; Street Food</h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Sistem kasir mobile yang bisa dibawa pelayan ke meja pelanggan, tetap lancar offline walau sinyal internet terbatas.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: 4 PILAR MODUL OPERASIONAL */}
        <section
          id="fitur"
          className="section-container"
          style={{
            padding: "4rem 2rem",
            maxWidth: "1240px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
              4 Modul Terpadu Tanpa Kerumitan
            </h2>
            <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", maxWidth: "650px", margin: "0 auto" }}>
              Semua modul terhubung secara real-time via WebSockets dan siap digunakan langsung dari browser.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {/* Fitur 1 */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "2rem" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #FF5722, #FF4500)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  marginBottom: "1.25rem",
                  boxShadow: "0 6px 16px var(--brand-orange-glow)",
                }}
              >
                ⚡
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Modul Kasir (POS)</h3>
                <span className="badge badge-ready">Offline-First</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                UI tap-tap super cepat. Tetap bisa mencatat transaksi dan cetak struk bluetooth saat internet mati, otomatis sinkronisasi ke cloud saat online kembali.
              </p>
              <div style={{ fontSize: "0.85rem", color: "var(--brand-orange-light)", fontWeight: 700 }}>
                ✓ Rekonsiliasi kas laci anti-selisih
              </div>
            </div>

            {/* Fitur 2 */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "2rem" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  marginBottom: "1.25rem",
                }}
              >
                🍳
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Kitchen Display (KDS)</h3>
                <span className="badge badge-cooking">Real-Time</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                Tiket pesanan muncul instan &lt; 1 detik di layar tablet dapur. Dilengkapi timer SLA warna agar koki atau barista tidak melupakan pesanan pelanggan.
              </p>
              <div style={{ fontSize: "0.85rem", color: "#FBBF24", fontWeight: 700 }}>
                ✓ Tanpa kertas nota hilang
              </div>
            </div>

            {/* Fitur 3 */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "2rem" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  marginBottom: "1.25rem",
                }}
              >
                📺
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Antrean Smart TV</h3>
                <span className="badge badge-new">TTS Voice Robot</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                Buka di browser Smart TV mana saja. Otomatis memanggil suara robot &quot;Nomor 12 silakan diambil&quot; saat pesanan selesai disiapkan barista.
              </p>
              <div style={{ fontSize: "0.85rem", color: "#34D399", fontWeight: 700 }}>
                ✓ Menghilang otomatis sesuai durasi pusat
              </div>
            </div>

            {/* Fitur 4 */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "2rem" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  marginBottom: "1.25rem",
                }}
              >
                📱
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800 }}>QR Menu Meja</h3>
                <span className="badge badge-new">Self-Order</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
                Pelanggan cukup scan stiker QR di mejanya menggunakan kamera HP. Bisa lihat katalog menu, pesan sendiri, dan bayar via QRIS tanpa antre berdiri.
              </p>
              <div style={{ fontSize: "0.85rem", color: "#A78BFA", fontWeight: 700 }}>
                ✓ Menu dikelola mandiri oleh Owner
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: KEUNGGULAN UTAMA (MENGAPA MEMILIH OKESIH) */}
        <section
          id="keunggulan"
          className="section-container"
          style={{
            padding: "4rem 2rem",
            maxWidth: "1140px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
              Keuntungan Menggunakan OKESIH
            </h2>
            <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", maxWidth: "650px", margin: "0 auto" }}>
              Dibuat khusus untuk pengusaha yang menginginkan efisiensi maksimal tanpa terbebani modal awal.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }} className="feature-split-grid">
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.75rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📱</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                Bawa Gadget Sendiri (Nol Investasi Mesin)
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                Anda tidak perlu membeli perangkat kasir khusus seharga Rp 3 juta hingga Rp 7 juta. Aplikasi berjalan langsung di HP Android, iPhone, tablet murah, maupun laptop yang sudah Anda miliki.
              </p>
            </div>

            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.75rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>💳</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                100% Uang Penjualan Milik Anda
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                Uang pembayaran QRIS dari pelanggan langsung masuk 100% ke rekening bank/QRIS milik Anda (BCA, Mandiri, BRI, Dana, dll). OKESIH tidak menahan ataupun memotong uang hasil jerih payah Anda.
              </p>
            </div>

            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.75rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>👥</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                Anti-Selisih Kas Laci &amp; Roster Waiters
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                Sistem merekam jam kerja pelayan/waiters dan mencocokkan total tagihan struk bertanda TUNAI dengan uang cash fisik yang ada di laci kasir saat pergantian shift.
              </p>
            </div>

            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.75rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🔒</div>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
                Akun Staf Praktis Tanpa Verifikasi Email/OTP
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                Owner membuatkan langsung username &amp; password staf kasir dan barista dari dashboard. Staf cukup mengetik username lalu langsung bekerja tanpa kode OTP yang merepotkan di lapangan.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: SIMULASI BIAYA & TARIF SEWA HEMAT */}
        <section
          id="tarif"
          className="section-container"
          style={{
            padding: "4rem 2rem",
            maxWidth: "1000px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "3rem 2rem",
              textAlign: "center",
              border: "2px solid rgba(255, 69, 0, 0.4)",
              background: "linear-gradient(135deg, rgba(255, 69, 0, 0.08) 0%, rgba(13, 13, 14, 0.95) 100%)",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "var(--brand-orange-light)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
              SKEMA HARGA PALING ADIL DI INDONESIA
            </div>
            <h2 style={{ fontSize: "2.3rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
              Hanya <span style={{ color: "var(--brand-orange-light)" }}>Rp 50</span> per Struk Bon Transaksi
            </h2>
            <p style={{ fontSize: "1rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto 2rem", lineHeight: 1.6 }}>
              Tidak ada biaya langganan bulanan ratusan ribu rupiah. Jika toko sedang libur atau sepi, Anda tidak akan rugi sepeser pun!
            </p>

            {/* Perbandingan Grid */}
            <div
              className="price-compare-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1.5rem",
                maxWidth: "700px",
                margin: "0 auto 2rem",
                textAlign: "left",
              }}
            >
              <div style={{ padding: "1.25rem", borderRadius: "10px", background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ color: "#F87171", fontWeight: 800, marginBottom: "0.5rem" }}>❌ Software POS Konvensional</div>
                <div style={{ fontSize: "0.825rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
                  • Beli mesin kasir Rp 3.000.000+<br />
                  • Langganan Rp 250.000 - Rp 500.000/bln<br />
                  • Tetap harus bayar walau toko sepi<br />
                  • Uang QRIS dipotong persentase tinggi
                </div>
              </div>

              <div style={{ padding: "1.25rem", borderRadius: "10px", background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                <div style={{ color: "#34D399", fontWeight: 800, marginBottom: "0.5rem" }}>✓ Platform OKESIH.COM</div>
                <div style={{ fontSize: "0.825rem", color: "#E2E8F0", lineHeight: 1.6 }}>
                  • Biaya perangkat awal Rp 0 (pakai HP sendiri)<br />
                  • Bayar hanya Rp 50 per transaksi tercetak<br />
                  • 100 struk sehari hanya bayar sewa Rp 5.000<br />
                  • 100% uang QRIS langsung ke rekening Anda
                </div>
              </div>
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              *Setoran sewa dibayarkan harian saat tutup toko dengan kode unik alokasi untuk rekonsiliasi transfer otomatis via OCR.
            </div>
          </div>
        </section>

        {/* SECTION: PERTANYAAN UMUM (FAQ) */}
        <section
          id="faq"
          className="section-container"
          style={{
            padding: "4rem 2rem",
            maxWidth: "880px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
              Pertanyaan yang Sering Diajukan (FAQ)
            </h2>
            <p style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>
              Segala hal yang perlu Anda ketahui sebelum menggunakan platform OKESIH.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              {
                q: "Apakah saya harus membeli printer kasir atau tablet khusus?",
                a: "Tidak perlu. Anda bisa menggunakan smartphone Android atau iPhone apa saja yang sudah Anda miliki. Jika ingin mencetak struk fisik kertas, aplikasi kasir mendukung printer bluetooth thermal 58mm/80mm standar yang banyak dijual murah di pasaran.",
              },
              {
                q: "Apakah uang pembayaran dari pelanggan masuk ke rekening OKESIH?",
                a: "Sama sekali tidak. Gambar QRIS yang tampil di layar HP pelanggan adalah QRIS rekening milik usaha Anda sendiri (BCA, BRI, Mandiri, Dana, GoPay, dll). Uang pelanggan 100% masuk langsung ke rekening Anda tanpa perantara.",
              },
              {
                q: "Bagaimana jika koneksi internet di tempat usaha saya tiba-tiba terputus?",
                a: "Aplikasi Kasir POS OKESIH dilengkapi teknologi Offline-First (PWA & IndexedDB). Kasir tetap dapat menerima pesanan dan mencetak struk seperti biasa. Begitu internet terhubung kembali, sistem secara otomatis mensinkronkan seluruh data ke cloud.",
              },
              {
                q: "Bagaimana cara mendaftarkan warkop, kafe, atau warung saya ke OKESIH?",
                a: "Pendaftaran tenant warkop/usaha baru dikelola oleh tim Super Admin atau Mitra Marketing Lapangan kami. Setelah didaftarkan, Owner langsung menerima kredensial akun login instan dan dapat langsung mengatur menu serta mencetak stiker QR meja.",
              },
              {
                q: "Bagaimana cara kerja pembayaran sewa Rp 50 per transaksi?",
                a: "Setiap kali Anda menutup shift/toko di penghujung hari, sistem menghitung total struk tercetak hari itu (misalnya 100 struk = Rp 5.000 + nominal kode unik alokasi Anda). Owner cukup mentransfer ke QRIS Pusat dan bukti transfer otomatis diverifikasi oleh sistem AI OCR.",
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="glass-panel mobile-compact-panel"
                style={{
                  padding: "1.25rem 1.5rem",
                  cursor: "pointer",
                  border: openFaq === idx ? "1px solid rgba(255, 69, 0, 0.4)" : "1px solid var(--border-subtle)",
                }}
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, color: openFaq === idx ? "var(--brand-orange-light)" : "#FFF" }}>
                    {faq.q}
                  </h3>
                  <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--brand-orange-light)" }}>
                    {openFaq === idx ? "−" : "+"}
                  </span>
                </div>
                {openFaq === idx && (
                  <p style={{ marginTop: "0.85rem", fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION: FORM LOGIN RESMI STAF & OWNER */}
        <section
          id="login"
          className="section-container"
          style={{
            padding: "4rem 2rem 5rem",
            maxWidth: "600px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            className="glass-panel-glow mobile-compact-panel"
            style={{
              padding: "2.5rem 2rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #FF5722, #FF4500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
                fontSize: "24px",
              }}
            >
              🔐
            </div>

            <h2 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.5rem" }}>
              Masuk ke Sistem OKESIH
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.75rem" }}>
              Masukkan username dan password yang diberikan oleh Owner warkop/Super Admin Anda.
            </p>

            <form
              onSubmit={handleLogin}
              style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}
            >
              {loginError && (
                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #EF4444",
                    color: "#FCA5A5",
                    padding: "0.75rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {loginError}
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Username Akun
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ketik username Anda..."
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%",
                    padding: "0.875rem 1rem",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{ width: "100%", marginTop: "0.5rem", padding: "0.95rem", fontWeight: 800, fontSize: "0.95rem" }}
              >
                {isLoading ? "Memverifikasi Otoritas..." : "Masuk ke Sistem"}
              </button>
            </form>

            <div style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Sistem mendeteksi otomatis peran Anda (Super Admin, Owner, Kasir, atau Dapur) dan mengarahkan langsung ke dashboard yang berwenang.
            </div>
          </div>
        </section>

        {/* FOOTER PUBLIK */}
        <footer
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "2.5rem 2rem",
            background: "rgba(9, 9, 10, 0.95)",
            fontSize: "0.85rem",
            color: "var(--text-dim)",
          }}
        >
          <div
            className="footer-container"
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1.5rem",
            }}
          >
            <div>
              <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FFF", marginBottom: "0.25rem" }}>
                OKESIH<span style={{ color: "var(--brand-orange-light)" }}>.COM</span>
              </div>
              <div>Platform Operasional POS &amp; Self-Order Cerdas untuk Usaha Kuliner Indonesia</div>
            </div>

            <div className="footer-links" style={{ display: "flex", gap: "1.5rem" }}>
              <a href="#solusi" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Solusi Usaha</a>
              <a href="#fitur" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Fitur Modul</a>
              <a href="#tarif" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Skema Sewa</a>
              <a href="#faq" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Bantuan FAQ</a>
            </div>

            <div>
              © 2026 OKESIH.COM • All Rights Reserved.
            </div>
          </div>
        </footer>

        {/* FLOATING QUICK BOTTOM BAR FOR MOBILE */}
        <div className="mobile-bottom-bar">
          <Link
            href="/menu/giras-nusantara?table=01"
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
          <a
            href="#login"
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
              textDecoration: "none",
              borderRadius: "10px",
            }}
          >
            <span>🔑</span>
            <span>Masuk Akun</span>
          </a>
        </div>
      </main>
    </>
  );
}
