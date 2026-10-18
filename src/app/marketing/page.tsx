import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import CommissionCalculator from "@/components/marketing/CommissionCalculator";
import MarketingFaq from "@/components/marketing/MarketingFaq";
import { getPlatformSettings } from "@/lib/platform-settings";

export default async function MarketingProgramPage() {
  const settings = await getPlatformSettings();
  const commissionPerReceipt = settings.defaultMarketingCommission;
  const saasFeePerReceipt = settings.saasFeePerReceipt;

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

      <MarketingHeader />

      {/* HERO SECTION */}
      <section
        className="mkt-hero-section"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3.5rem 1.25rem 2.5rem",
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
            padding: "0.35rem 1.15rem",
            borderRadius: "var(--radius-pill)",
            backgroundColor: "var(--accent-emerald-bg)",
            border: "1px solid var(--accent-emerald-border)",
            color: "var(--accent-emerald)",
            fontSize: "0.78rem",
            fontWeight: 800,
            marginBottom: "1.25rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          💼 PROGRAM KEMITRAAN MARKETING RESMI
        </div>

        <h1
          style={{
            fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.18,
            marginBottom: "1rem",
          }}
        >
          Raih Komisi Pasif Harian Bersama OKESIH
        </h1>

        <p
          style={{
            fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
            color: "var(--text-muted)",
            maxWidth: "720px",
            margin: "0 auto 2rem",
            lineHeight: 1.6,
          }}
        >
          Ajak warkop, kafe, dan resto di wilayah Anda pakai OKESIH. Dapatkan bagi hasil otomatis{" "}
          <strong style={{ color: "var(--accent-emerald)" }}>Rp {commissionPerReceipt.toLocaleString("id-ID")} per struk transaksi</strong> seumur hidup yang dicairkan langsung ke rekening bank atau e-wallet Anda!
        </p>

        {/* CTA Button Group */}
        <div
          className="mkt-hero-cta-group"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.85rem",
            flexWrap: "wrap",
            marginBottom: "2.5rem",
          }}
        >
          <Link
            href="/marketing/daftar"
            className="btn-primary mkt-hero-cta-btn"
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)",
              padding: "0.95rem 2rem",
              fontSize: "0.95rem",
              fontWeight: 900,
              borderRadius: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 6px 24px rgba(16, 185, 129, 0.4)",
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
            className="btn-secondary mkt-hero-cta-btn"
            style={{
              padding: "0.95rem 1.6rem",
              fontSize: "0.9rem",
              fontWeight: 700,
              borderRadius: "14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              textDecoration: "none",
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
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.75rem",
            padding: "1.25rem",
            borderRadius: "18px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--border-subtle)",
            textAlign: "center",
          }}
          className="mkt-stats-grid"
        >
          <div style={{ padding: "0.5rem" }}>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.6rem)", fontWeight: 900, color: "var(--accent-emerald)" }}>
              Rp {commissionPerReceipt.toLocaleString("id-ID")} / Struk
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Bagi Hasil Real-Time
            </div>
          </div>
          <div style={{ padding: "0.5rem" }}>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.6rem)", fontWeight: 900, color: "var(--accent-amber)" }}>
              Rp 0 (Gratis)
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Tanpa Modal Awal
            </div>
          </div>
          <div style={{ padding: "0.5rem" }}>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.6rem)", fontWeight: 900, color: "var(--accent-blue)" }}>
              100% Fleksibel
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Tanpa Target Bulanan
            </div>
          </div>
          <div style={{ padding: "0.5rem" }}>
            <div style={{ fontSize: "clamp(1.25rem, 3.5vw, 1.6rem)", fontWeight: 900, color: "var(--accent-purple)" }}>
              Seumur Hidup
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
              Selama Toko Beroperasi
            </div>
          </div>
        </div>
      </section>

      {/* 4 KEUNGGULAN UTAMA MENJADI MITRA */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3rem 1.25rem",
          maxWidth: "1100px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
          <h2 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
            Keuntungan Menjadi Mitra OKESIH
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto" }}>
            Peluang penghasilan pasif transparan dengan pencairan komisi langsung ke rekening.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
          }}
        >
          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "1.5rem",
              borderRadius: "16px",
              border: "1px solid var(--accent-emerald-border)",
            }}
          >
            <div style={{ fontSize: "1.85rem", marginBottom: "0.5rem" }}>📈</div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem", color: "var(--accent-emerald)" }}>
              Komisi Pasif Berulang
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Setiap kali tenant binaan mencetak struk pesanan, pundi komisi bertambah otomatis tanpa Anda harus menjaga toko.
            </p>
          </div>

          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "1.5rem",
              borderRadius: "16px",
              border: "1px solid var(--accent-emerald-border)",
            }}
          >
            <div style={{ fontSize: "1.85rem", marginBottom: "0.5rem" }}>🗺️</div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem", color: "var(--accent-emerald)" }}>
              Wilayah &amp; Referral Resmi
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Kode referral resmi mengunci tenant binaan Anda aman, tidak dapat direbut oleh pihak lain.
            </p>
          </div>

          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "1.5rem",
              borderRadius: "16px",
              border: "1px solid var(--accent-emerald-border)",
            }}
          >
            <div style={{ fontSize: "1.85rem", marginBottom: "0.5rem" }}>⏱️</div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem", color: "var(--accent-emerald)" }}>
              100% Bebas &amp; Fleksibel
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Tanpa jam kerja kaku dan tanpa target bulanan. Sangat fleksibel untuk mahasiswa, pekerja, atau komunitas kuliner.
            </p>
          </div>

          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "1.5rem",
              borderRadius: "16px",
              border: "1px solid var(--accent-emerald-border)",
            }}
          >
            <div style={{ fontSize: "1.85rem", marginBottom: "0.5rem" }}>💳</div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem", color: "var(--accent-emerald)" }}>
              Pencairan Cepat Langsung
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Rekapitulasi struk transparan. Dana komisi ditransfer langsung ke rekening bank atau dompet digital pilihan Anda.
            </p>
          </div>
        </div>
      </section>

      <CommissionCalculator initialCommissionPerReceipt={commissionPerReceipt} />

      {/* 3 LANGKAH MUDAH */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3rem 1.25rem",
          maxWidth: "1000px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
          <h2 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
            3 Langkah Mudah Memulai
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Proses simpel, cepat, dan bisa langsung action hari ini.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.25rem",
          }}
        >
          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "1.75rem 1.25rem",
              borderRadius: "16px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "var(--accent-emerald-bg)",
                color: "var(--accent-emerald)",
                fontSize: "1.15rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
                border: "1px solid var(--accent-emerald-border)",
              }}
            >
              1
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem" }}>
              Daftar Formulir Online
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Lengkapi data diri, nomor rekening, dan wilayah Anda untuk menerima Kode Referral Resmi Okesih.com.
            </p>
          </div>

          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "1.75rem 1.25rem",
              borderRadius: "16px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "var(--accent-emerald-bg)",
                color: "var(--accent-emerald)",
                fontSize: "1.15rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
                border: "1px solid var(--accent-emerald-border)",
              }}
            >
              2
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem" }}>
              Ajak Tenant Pasang OKESIH
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Kenalkan sistem kasir &amp; self-order QR hemat (hanya Rp {saasFeePerReceipt.toLocaleString("id-ID")}/struk) ke warkop/resto di area Anda.
            </p>
          </div>

          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "1.75rem 1.25rem",
              borderRadius: "16px",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "var(--accent-emerald-bg)",
                color: "var(--accent-emerald)",
                fontSize: "1.15rem",
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
                border: "1px solid var(--accent-emerald-border)",
              }}
            >
              3
            </div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem" }}>
              Nikmati Komisi Pasif Harian
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
              Setiap struk yang keluar otomatis menghasilkan Rp {commissionPerReceipt.toLocaleString("id-ID")} bagi Anda seumur hidup langsung ke rekening Anda.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ MITRA MARKETING */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3rem 1.25rem",
          maxWidth: "860px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
            Pertanyaan yang Sering Diajukan
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Hal-hal penting seputar kemitraan marketing resmi OKESIH.
          </p>
        </div>

        <MarketingFaq faqs={faqs} />
      </section>

      {/* BIG BOTTOM CALL TO ACTION */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "3.5rem 1.25rem 5rem",
          maxWidth: "920px",
          margin: "0 auto",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          className="glass-panel-glow mobile-compact-panel mkt-container-card"
          style={{
            padding: "3rem 1.75rem",
            borderRadius: "22px",
            border: "1px solid var(--accent-emerald-border)",
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(13, 13, 14, 0.98) 100%)",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(16, 185, 129, 0.15)",
          }}
        >
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🚀</div>
          <h2
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              marginBottom: "0.75rem",
            }}
          >
            Siap Bangun Aset Pendapatan Pasif?
          </h2>
          <p
            style={{
              fontSize: "0.925rem",
              color: "var(--text-muted)",
              maxWidth: "600px",
              margin: "0 auto 2rem",
              lineHeight: 1.55,
            }}
          >
            Pendaftaran 100% gratis tanpa dipungut biaya apapun. Isi formulir sekarang untuk mendapatkan kode referral resmi dan amankan wilayah Anda.
          </p>

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
              gap: "0.5rem",
              boxShadow: "0 6px 24px rgba(16, 185, 129, 0.4)",
              textDecoration: "none",
              color: "#FFF",
            }}
          >
            <span>📝</span>
            <span>Buka Formulir Pendaftaran Mitra Sekarang</span>
            <span>→</span>
          </Link>

          <div
            style={{
              marginTop: "1.75rem",
              display: "flex",
              justifyContent: "center",
              gap: "1.25rem",
              flexWrap: "wrap",
              fontSize: "0.78rem",
              color: "var(--text-dim)",
            }}
          >
            <span>✓ 100% Gratis Tanpa Modal</span>
            <span>✓ Kode Referral Resmi</span>
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
