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

      <CommissionCalculator initialCommissionPerReceipt={commissionPerReceipt} />

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

        <MarketingFaq faqs={faqs} />
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
