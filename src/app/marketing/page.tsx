"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

export default function MarketingProgramPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [tenantCount, setTenantCount] = useState<number>(20);
  const [avgReceipts, setAvgReceipts] = useState<number>(120);
  const [commissionPerReceipt, setCommissionPerReceipt] = useState<number>(15);
  const [saasFeePerReceipt, setSaasFeePerReceipt] = useState<number>(50);

  useEffect(() => {
    fetch("/api/platform-settings", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => {
        setCommissionPerReceipt(payload.data.defaultMarketingCommission);
        setSaasFeePerReceipt(payload.data.saasFeePerReceipt);
      })
      .catch(() => undefined);
  }, []);

  // Perhitungan Simulasi
  const dailyReceiptsTotal = tenantCount * avgReceipts;
  const dailyCommission = dailyReceiptsTotal * commissionPerReceipt;
  const monthlyCommission = dailyCommission * 30;

  const faqs = [
    {
      q: "Apakah pendaftaran menjadi Mitra Marketing dipungut biaya?",
      a: "Sama sekali tidak dipungut biaya (100% GRATIS). Anda tidak perlu modal awal, tidak perlu membeli paket keagenan, dan tidak ada potongan pendaftaran apapun.",
    },
    {
      q: `Bagaimana sistem menghitung komisi Rp ${commissionPerReceipt.toLocaleString("id-ID")} per struk?`,
      a: `Setiap warkop, kafe, atau resto yang mendaftar menggunakan Kode Referral Anda akan terkunci di bawah akun kemitraan Anda. Setiap kali kasir atau pelanggan mencetak struk pesanan, sistem otomatis mengalokasikan Rp ${commissionPerReceipt.toLocaleString("id-ID")} ke saldo komisi Anda.`,
    },
    {
      q: "Kapan dan bagaimana komisi dicairkan?",
      a: "Pencairan komisi dapat ditransfer secara berkala langsung ke nomor rekening bank (BCA, Mandiri, BRI, BNI, BSI) atau akun e-wallet (DANA, GoPay, OVO, ShopeePay) yang Anda daftarkan tanpa potongan biaya admin tersembunyi.",
    },
    {
      q: "Apakah ada target bulanan atau jam kerja yang mengikat?",
      a: "Tidak ada jam kerja kaku dan tidak ada target minimum bulanan. Program ini 100% fleksibel, bisa dijalankan sebagai penghasilan sampingan paruh waktu maupun dikerjakan secara profesional penuh waktu.",
    },
    {
      q: "Siapa target pasar yang bisa saya ajak bergabung?",
      a: "Semua usaha makanan dan minuman: Warkop/Giras, Kafe & Coffee Shop, Resto, Angkringan, Depot, Kedai Mie, Booth Minuman, hingga Pujasera/Foodcourt di wilayah jangkauan Anda.",
    },
    {
      q: "Bagaimana cara saya membuktikan kepemilikan tenant binaan saya?",
      a: "Setiap mitra memiliki Kode Referral Resmi yang terdaftar di sistem Okesih.com. Tenant yang mendaftar wajib memasukkan kode Anda, dan Okesih.com akan memvalidasi pemetaan wilayah tenant tersebut ke profil kemitraan Anda.",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--bg-deep-black)",
        color: "var(--text-pure-white)",
        position: "relative",
        overflowX: "clip",
      }}
    >
      {/* Background Ambient Glows */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <div
          className="organic-shape"
          style={{
            width: "600px",
            height: "600px",
            top: "-150px",
            right: "-100px",
            background: "radial-gradient(circle, #10B981 0%, rgba(16, 185, 129, 0) 70%)",
            opacity: 0.16,
          }}
        />
        <div
          className="organic-shape"
          style={{
            width: "550px",
            height: "550px",
            top: "35%",
            left: "-120px",
            background: "radial-gradient(circle, #059669 0%, rgba(5, 150, 105, 0) 70%)",
            opacity: 0.12,
          }}
        />
        <div
          className="organic-shape"
          style={{
            width: "500px",
            height: "500px",
            bottom: "5%",
            right: "-80px",
            background: "radial-gradient(circle, #FBBF24 0%, rgba(251, 191, 36, 0) 70%)",
            opacity: 0.08,
          }}
        />
      </div>

      {/* STICKY TOP NAVBAR */}
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
                <img
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

      {/* HERO SECTION */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "5rem 1.5rem 4rem",
          maxWidth: "1000px",
          margin: "0 auto",
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.45rem 1.25rem",
            borderRadius: "var(--radius-pill)",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            color: "#34D399",
            fontSize: "0.825rem",
            fontWeight: 800,
            marginBottom: "1.5rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          💼 PROGRAM KEMITRAAN MARKETING RESMI
        </div>

        <h1
          style={{
            fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: "1.25rem",
          }}
        >
          Raih Komisi Pasif Harian Bersama{" "}
          <span
            style={{
              background: "linear-gradient(135deg, #34D399 0%, #10B981 50%, #FBBF24 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Ekosistem OKESIH
          </span>
        </h1>

        <p
          style={{
            fontSize: "clamp(1rem, 2vw, 1.15rem)",
            color: "var(--text-muted)",
            maxWidth: "760px",
            margin: "0 auto 2.5rem",
            lineHeight: 1.65,
          }}
        >
          Daftarkan warkop, kafe, resto, dan usaha kuliner di wilayah Anda. Nikmati bagi hasil pasif otomatis{" "}
          <strong style={{ color: "#34D399" }}>Rp {commissionPerReceipt.toLocaleString("id-ID")} per struk transaksi</strong> seumur hidup yang dicairkan langsung ke rekening bank atau e-wallet Anda!
        </p>

        {/* CTA Button Group */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "3.5rem",
          }}
        >
          <Link
            href="/marketing/daftar"
            className="btn-primary"
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)",
              padding: "1rem 2.25rem",
              fontSize: "1rem",
              fontWeight: 900,
              borderRadius: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.6rem",
              boxShadow: "0 8px 30px rgba(16, 185, 129, 0.45)",
              textDecoration: "none",
              color: "#FFF",
            }}
          >
            <span>📝</span>
            <span>Buka Formulir Pendaftaran Mitra</span>
            <span>→</span>
          </Link>

          <a
            href="#simulasi"
            className="btn-secondary"
            style={{
              padding: "1rem 1.75rem",
              fontSize: "0.95rem",
              fontWeight: 700,
              borderRadius: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <span>📊 Hitung Potensi Komisi</span>
            <span>↓</span>
          </a>
        </div>

        {/* Highlight Stats Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            padding: "1.5rem",
            borderRadius: "20px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#34D399" }}>Rp {commissionPerReceipt.toLocaleString("id-ID")} / Struk</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Bagi Hasil Otomatis Real-Time
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#FBBF24" }}>Rp 0 (Gratis)</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Tanpa Biaya &amp; Tanpa Modal Awal
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#60A5FA" }}>100% Fleksibel</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Bebas Jam Kerja &amp; Target Kantor
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#A78BFA" }}>Seumur Hidup</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Selama Tenant Tetap Beroperasi
            </div>
          </div>
        </div>
      </section>

      {/* 4 KEUNGGULAN UTAMA MENJADI MITRA */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3.5rem 1.5rem",
          maxWidth: "1100px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.75rem" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
            Keuntungan Eksklusif Mitra Marketing
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto" }}>
            Solusi bisnis kemitraan modern dengan transparansi data penuh dan pembayaran komisi tepat waktu.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: "1.85rem",
              borderRadius: "18px",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              background: "rgba(21, 21, 24, 0.75)",
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "0.75rem" }}>📈</div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem", color: "#34D399" }}>
              Komisi Pasif Berulang
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Setiap kali tenant binaan Anda melayani pelanggan dan mencetak struk pesanan, pundi komisi Anda bertambah otomatis tanpa Anda harus hadir menjaga toko.
            </p>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: "1.85rem",
              borderRadius: "18px",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              background: "rgba(21, 21, 24, 0.75)",
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "0.75rem" }}>🗺️</div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem", color: "#34D399" }}>
              Pemetaan Wilayah &amp; Referral
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Dapatkan kode referral eksklusif terdaftar resmi di Okesih.com. Tenant yang mendaftar melalui Anda terkunci aman dan tidak akan direbut oleh pihak lain.
            </p>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: "1.85rem",
              borderRadius: "18px",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              background: "rgba(21, 21, 24, 0.75)",
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "0.75rem" }}>⏱️</div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem", color: "#34D399" }}>
              100% Bebas &amp; Fleksibel
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Atur waktu kerja Anda sendiri. Sangat ideal bagi mahasiswa, pekerja lapangan, komunitas kuliner, atau siapa saja yang ingin penghasilan pasif tanpa ikatan kantor.
            </p>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: "1.85rem",
              borderRadius: "18px",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              background: "rgba(21, 21, 24, 0.75)",
            }}
          >
            <div style={{ fontSize: "2.25rem", marginBottom: "0.75rem" }}>💳</div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: "0.5rem", color: "#34D399" }}>
              Pencairan Cepat Langsung
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Rekapitulasi struk transparan. Dana komisi ditransfer langsung ke rekening bank (BCA, Mandiri, BRI, BNI) atau dompet digital (DANA, GoPay, OVO) pilihan Anda.
            </p>
          </div>
        </div>
      </section>

      {/* KALKULATOR & SIMULASI POTENSI KOMISI */}
      <section
        id="simulasi"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "4rem 1.5rem",
          maxWidth: "980px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          className="glass-panel-glow"
          style={{
            padding: "3rem 2.25rem",
            borderRadius: "24px",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 13, 14, 0.98) 100%)",
            boxShadow: "0 16px 50px rgba(0, 0, 0, 0.7)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.95rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "rgba(251, 191, 36, 0.15)",
                border: "1px solid rgba(251, 191, 36, 0.4)",
                color: "#FBBF24",
                fontSize: "0.8rem",
                fontWeight: 800,
                marginBottom: "0.75rem",
                textTransform: "uppercase",
              }}
            >
              📊 KALKULATOR POTENSI PENDAPATAN
            </div>
            <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 900, letterSpacing: "-0.02em" }}>
              Berapa Penghasilan Pasif yang Bisa Anda Dapatkan?
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0.5rem auto 0" }}>
              Geser slider di bawah ini untuk mensimulasikan jumlah tenant aktif dan rata-rata struk harian:
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "2rem",
              alignItems: "center",
            }}
          >
            {/* Slider Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-pure-white)" }}>
                    Jumlah Tenant / Kafe Binaan:
                  </label>
                  <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#34D399" }}>
                    {tenantCount} Tenant
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={tenantCount}
                  onChange={(e) => setTenantCount(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#10B981", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                  <span>1 Tenant</span>
                  <span>50 Tenant</span>
                  <span>100 Tenant</span>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-pure-white)" }}>
                    Rata-rata Transaksi per Toko / Hari:
                  </label>
                  <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FBBF24" }}>
                    {avgReceipts} Struk / Hari
                  </span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="300"
                  step="10"
                  value={avgReceipts}
                  onChange={(e) => setAvgReceipts(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#FBBF24", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                  <span>30 Struk</span>
                  <span>150 Struk</span>
                  <span>300 Struk</span>
                </div>
              </div>
            </div>

            {/* Hasil Kalkulasi Card */}
            <div
              className="calc-result-box"
              style={{
                padding: "2rem",
                borderRadius: "20px",
                background: "rgba(0, 0, 0, 0.55)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Estimasi Pendapatan Pasif Bulanan
              </div>
              <div
                style={{
                  fontSize: "clamp(2rem, 4vw, 2.75rem)",
                  fontWeight: 900,
                  color: "#34D399",
                  margin: "0.5rem 0 1rem",
                  letterSpacing: "-0.02em",
                }}
              >
                Rp {monthlyCommission.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                Berasal dari <strong>{dailyReceiptsTotal.toLocaleString("id-ID")} struk/hari</strong> × Rp {commissionPerReceipt.toLocaleString("id-ID")} ={" "}
                <span style={{ color: "#FBBF24" }}>Rp {dailyCommission.toLocaleString("id-ID")}/hari</span>.
              </div>
              <div
                style={{
                  marginTop: "1.5rem",
                  paddingTop: "1.25rem",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <Link
                  href="/marketing/daftar"
                  className="btn-primary"
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #10B981, #059669)",
                    padding: "0.85rem",
                    fontSize: "0.95rem",
                    fontWeight: 900,
                    borderRadius: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    textDecoration: "none",
                    color: "#FFF",
                  }}
                >
                  <span>Daftar Sekarang &amp; Amankan Wilayah Anda</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 LANGKAH MUDAH */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3.5rem 1.5rem",
          maxWidth: "1000px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
            3 Langkah Mudah Memulai
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-muted)" }}>
            Proses simpel, cepat, dan bisa langsung action dalam hitungan menit.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: "2rem 1.5rem",
              borderRadius: "18px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34D399",
                fontSize: "1.25rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
                border: "1px solid rgba(16, 185, 129, 0.4)",
              }}
            >
              1
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              Daftar Formulir Online
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Lengkapi nama, kontak WhatsApp, nomor rekening, dan wilayah Anda. Sistem menerbitkan Kode Referral Unik resmi untuk Anda.
            </p>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: "2rem 1.5rem",
              borderRadius: "18px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34D399",
                fontSize: "1.25rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
                border: "1px solid rgba(16, 185, 129, 0.4)",
              }}
            >
              2
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              Ajak Tenant Pasang OKESIH
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Kenalkan sistem kasir pintar &amp; self-order QR OKESIH ke warkop/kafe rekanan. Biaya sewa hanya Rp {saasFeePerReceipt.toLocaleString("id-ID")}/struk yang sangat terjangkau bagi pemilik usaha.
            </p>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: "2rem 1.5rem",
              borderRadius: "18px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#34D399",
                fontSize: "1.25rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
                border: "1px solid rgba(16, 185, 129, 0.4)",
              }}
            >
              3
            </div>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              Nikmati Komisi Pasif Harian
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Setiap struk yang keluar otomatis menghasilkan Rp {commissionPerReceipt.toLocaleString("id-ID")} bagi Anda. Pantau komisi dan terima pencairan rutin langsung ke rekening Anda.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ MITRA MARKETING */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3.5rem 1.5rem",
          maxWidth: "860px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
            Pertanyaan yang Sering Diajukan
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Hal-hal penting seputar keagenan dan kemitraan marketing OKESIH.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="glass-panel"
              style={{
                borderRadius: "14px",
                overflow: "hidden",
                border: openFaq === idx ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border-subtle)",
              }}
            >
              <button
                type="button"
                className="faq-item-button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                style={{
                  width: "100%",
                  padding: "1.15rem 1.25rem",
                  background: "none",
                  border: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  textAlign: "left",
                  color: "var(--text-pure-white)",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    color: openFaq === idx ? "#059669" : "var(--text-pure-white)",
                    transition: "color 0.2s ease",
                  }}
                >
                  {faq.q}
                </span>
                <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "#10B981", marginLeft: "1rem" }}>
                  {openFaq === idx ? "−" : "+"}
                </span>
              </button>

              {openFaq === idx && (
                <div
                  style={{
                    padding: "0 1.25rem 1.25rem",
                    fontSize: "0.875rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: "0.85rem",
                  }}
                >
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* BIG BOTTOM CALL TO ACTION */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "4rem 1.5rem 6rem",
          maxWidth: "920px",
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          className="glass-panel-glow"
          style={{
            padding: "3.5rem 2.25rem",
            borderRadius: "24px",
            border: "1px solid rgba(16, 185, 129, 0.45)",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(13, 13, 14, 0.98) 100%)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.2)",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🚀</div>
          <h2
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.4rem)",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
            }}
          >
            Siap Membangun Aset Pendapatan Pasif Anda?
          </h2>
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--text-muted)",
              maxWidth: "620px",
              margin: "0 auto 2.25rem",
              lineHeight: 1.6,
            }}
          >
            Pendaftaran 100% gratis tanpa dipungut biaya apapun. Isi formulir pendaftaran untuk mendapatkan kode referral unik resmi dan bergabung bersama jaringan mitra kami.
          </p>

          <Link
            href="/marketing/daftar"
            className="btn-primary"
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)",
              padding: "1.1rem 2.5rem",
              fontSize: "1.05rem",
              fontWeight: 900,
              borderRadius: "16px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: "0 8px 30px rgba(16, 185, 129, 0.45)",
              textDecoration: "none",
              color: "#FFF",
            }}
          >
            <span>📝</span>
            <span>Buka Formulir Pendaftaran Mitra Marketing Sekarang</span>
            <span>→</span>
          </Link>

          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              justifyContent: "center",
              gap: "1.5rem",
              flexWrap: "wrap",
              fontSize: "0.8rem",
              color: "var(--text-dim)",
            }}
          >
            <span>✓ 100% Gratis &amp; Tanpa Modal</span>
            <span>✓ Kode Referral Resmi Okesih.com</span>
            <span>✓ Notifikasi WhatsApp Langsung</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "2rem 1.5rem",
          background: "rgba(9, 9, 10, 0.95)",
          fontSize: "0.825rem",
          color: "var(--text-dim)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          © 2026 OKESIH.COM • Program Kemitraan Marketing Resmi Seluruh Indonesia.
        </div>
      </footer>
    </main>
  );
}
