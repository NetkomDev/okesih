import Link from "next/link";
import Image from "next/image";
import LandingHeader from "@/components/landing/LandingHeader";
import LoginModal from "@/components/landing/LoginModal";
import FaqAccordion from "@/components/landing/FaqAccordion";
import MobileBottomBar from "@/components/landing/MobileBottomBar";
import LoginTriggerButton from "@/components/landing/LoginTriggerButton";
import { getPlatformSettings } from "@/lib/platform-settings";

export default async function HomePage() {
  const settings = await getPlatformSettings();
  const saasFeePerReceipt = settings.saasFeePerReceipt;
  const marketingCommission = settings.defaultMarketingCommission;

  const faqs = [
    {
      q: "Bagaimana sistem OKESIH membebankan biaya sewa flat?",
      a: `OKESIH tidak mengenakan biaya langganan bulanan jutaan rupiah ataupun komisi persentase omzet. Biaya sewa hanya dihitung flat Rp ${saasFeePerReceipt.toLocaleString("id-ID")} untuk setiap struk transaksi sah yang tercetak oleh kasir/pelanggan. Jika toko tutup atau sepi, Anda tidak membayar biaya sewa membengkak.`,
    },
    {
      q: "Apakah uang pembayaran pelanggan (Cash & QRIS) ditahan oleh OKESIH?",
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
      q: `Bagaimana cara kerja pembayaran sewa Rp ${saasFeePerReceipt.toLocaleString("id-ID")} per transaksi?`,
      a: `Setiap kali Anda menutup shift/toko di penghujung hari, sistem menghitung total struk tercetak hari itu berdasarkan tarif aktif Rp ${saasFeePerReceipt.toLocaleString("id-ID")} per struk, lalu menambahkan nominal kode unik tenant.`,
    },
  ];

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
      "price": String(saasFeePerReceipt),
      "priceCurrency": "IDR",
      "description": `Biaya sewa platform flat Rp ${saasFeePerReceipt.toLocaleString("id-ID")} per transaksi tercetak tanpa biaya bulanan jutaan.`,
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
          backgroundColor: "var(--bg-deep-black)",
          color: "var(--text-pure-white)",
        }}
      >
        {/* Background Ambient Glows (Isolated, never affects main scroll container) */}
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
        </div>

        <LandingHeader
          saasFeePerReceipt={saasFeePerReceipt}
          marketingCommission={marketingCommission}
        />

        {/* HERO SECTION */}
        <section className="hero-container hero-split">
          <div className="hero-copy">
            <div className="hero-badge">
              ⚡ Solusi POS, Self-Order &amp; Antrean untuk Segala Usaha Penjualan
            </div>

            <h1 className="hero-heading">
              Kelola Pesanan Kilat, <span>Operasional Bebas Hambatan.</span>
            </h1>

            <p className="hero-subtitle">
              Ekosistem kasir modern terintegrasi: POS offline-first, KDS dapur, QR meja, dan antrean TV. Cukup pakai gadget yang ada, tanpa mesin mahal, mulai Rp {saasFeePerReceipt.toLocaleString("id-ID")}/transaksi.
            </p>

            <div className="hero-cta-group">
              <Link href="/menu/giras-nusantara?table=01" target="_blank" className="btn-primary">
                📱 Coba Demo QR Menu
              </Link>
              <LoginTriggerButton className="btn-secondary">
                <span>🔑 Masuk Portal Operasional</span>
              </LoginTriggerButton>
            </div>

            <div className="hero-social-proof" aria-label="Pengguna OKESIH di Indonesia">
              <span className="hero-social-proof-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <p>Telah digunakan dan dipercaya lebih dari <strong>1000</strong> pelaku usaha F&amp;B di seluruh Indonesia.</p>
            </div>

            <div className="hero-trust-row" aria-label="Keunggulan utama">
              <span>✓ Offline-first</span>
              <span>✓ Tanpa mesin mahal</span>
              <span>✓ Mulai Rp {saasFeePerReceipt.toLocaleString("id-ID")}/transaksi</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="Tablet kasir OKESIH di kafe modern">
            <Image
              src="/images/hero-pos-cafe-v2.png"
              alt="Tablet kasir modern dengan aplikasi POS, printer struk, dan es kopi di meja kasir sebuah kafe"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 58vw"
              className="hero-visual-image"
            />
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
              Hanya <span style={{ color: "var(--brand-orange-light)" }}>Rp {saasFeePerReceipt.toLocaleString("id-ID")}</span> per Struk Bon Transaksi
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
                <div style={{ fontSize: "0.825rem", color: "var(--text-pure-white)", lineHeight: 1.6 }}>
                  • Biaya perangkat awal Rp 0 (pakai HP sendiri)<br />
                  • Bayar hanya Rp {saasFeePerReceipt.toLocaleString("id-ID")} per transaksi tercetak<br />
                  • 100 struk sehari hanya bayar sewa Rp {(100 * saasFeePerReceipt).toLocaleString("id-ID")}<br />
                  • 100% uang QRIS langsung ke rekening Anda
                </div>
              </div>
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              *Setoran sewa dibayarkan harian saat tutup toko dengan kode unik alokasi untuk rekonsiliasi transfer otomatis via OCR.
            </div>
          </div>
        </section>

        {/* BANNER AJAKAN: PROGRAM KEMITRAAN MARKETING RESMI (AKSES HALAMAN KHUSUS) */}
        <section
          id="rekrutmen-marketing"
          className="section-container"
          style={{
            padding: "3.5rem 1.5rem",
            maxWidth: "1080px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            className="glass-panel-glow mobile-compact-panel"
            style={{
              padding: "3.5rem 2.5rem",
              borderRadius: "24px",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(13, 13, 14, 0.98) 100%)",
              boxShadow: "0 18px 50px rgba(0, 0, 0, 0.7), 0 0 35px rgba(16, 185, 129, 0.15)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "1.25rem",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 1.15rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#34D399",
                fontSize: "0.8rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              💼 PROGRAM KEMITRAAN MARKETING RESMI
            </div>

            <h2
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.4rem)",
                fontWeight: 900,
                letterSpacing: "-0.025em",
                lineHeight: 1.25,
                color: "var(--text-pure-white)",
                maxWidth: "780px",
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
            </h2>

            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-muted)",
                maxWidth: "680px",
                lineHeight: 1.6,
                margin: "0 auto",
              }}
            >
              Daftarkan warkop, kafe, resto, dan pedagang kuliner di wilayah Anda. Nikmati komisi bagi hasil otomatis{" "}
              <strong style={{ color: "#34D399" }}>Rp {marketingCommission.toLocaleString("id-ID")} per struk transaksi</strong> seumur hidup yang dicairkan langsung ke rekening bank atau e-wallet Anda.
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                flexWrap: "wrap",
                marginTop: "0.75rem",
              }}
            >
              <Link
                href="/marketing"
                className="btn-primary"
                style={{
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  padding: "1rem 2.25rem",
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  borderRadius: "14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  boxShadow: "0 6px 24px rgba(16, 185, 129, 0.4)",
                  textDecoration: "none",
                  color: "#FFF",
                }}
              >
                <span>Pelajari Detail Program &amp; Simulasi Komisi</span>
                <span>→</span>
              </Link>

              <Link
                href="/marketing/daftar"
                className="btn-secondary"
                style={{
                  padding: "1rem 1.75rem",
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  borderRadius: "14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  textDecoration: "none",
                }}
              >
                <span>📝 Buka Formulir Pendaftaran</span>
              </Link>
            </div>

            <div
              style={{
                marginTop: "0.75rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "1.5rem",
                flexWrap: "wrap",
                fontSize: "0.78rem",
                color: "var(--text-dim)",
              }}
            >
              <span>✓ 100% Gratis &amp; Tanpa Modal</span>
              <span>✓ Kode Referral Resmi Okesih.com</span>
              <span>✓ Rekap Struk Otomatis</span>
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

          <FaqAccordion items={faqs} />
        </section>

        {/* SECTION: CLOSING CTA / PORTAL AKSES KELOLA RESMI */}
        <section
          id="akses-sistem"
          className="section-container"
          style={{
            padding: "5rem 2rem 6rem",
            maxWidth: "1140px",
            margin: "0 auto",
            width: "100%",
            position: "relative",
          }}
        >
          {/* Ambient Glow */}
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
                width: "500px",
                height: "500px",
                bottom: "-100px",
                right: "10%",
                background: "radial-gradient(circle, #FF4500 0%, rgba(255, 69, 0, 0) 70%)",
                opacity: 0.12,
              }}
            />
          </div>

          <div
            className="glass-panel-glow mobile-compact-panel"
            style={{
              padding: "4rem 2.5rem",
              textAlign: "center",
              borderRadius: "28px",
              position: "relative",
              overflow: "hidden",
              border: "1px solid rgba(255, 69, 0, 0.25)",
              background: "linear-gradient(180deg, rgba(28, 28, 33, 0.95) 0%, rgba(18, 18, 22, 0.98) 100%)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 1.15rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "rgba(255, 69, 0, 0.12)",
                border: "1px solid rgba(255, 69, 0, 0.3)",
                color: "var(--brand-orange-light)",
                fontSize: "0.825rem",
                fontWeight: 800,
                marginBottom: "1.5rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              🔒 Akses Aman Ekosistem OKESIH
            </div>

            <h2
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.75rem)",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                marginBottom: "1rem",
                lineHeight: 1.2,
              }}
            >
              Kelola Usaha Kuliner Anda dalam Satu Sentuhan
            </h2>

            <p
              style={{
                fontSize: "1.05rem",
                color: "var(--text-muted)",
                maxWidth: "680px",
                margin: "0 auto 2.5rem",
                lineHeight: 1.65,
              }}
            >
              Sudah memiliki akun resmi?
              Masuk melalui portal terenkripsi untuk mengelola transaksi, memantau omzet, dan memperbarui menu secara real-time.
            </p>

            {/* Tombol Akses & Kemitraan */}
            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: "2.5rem",
              }}
            >
              <LoginTriggerButton
                className="btn-primary"
                style={{
                  padding: "0.95rem 2rem",
                  fontSize: "1rem",
                  fontWeight: 900,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  cursor: "pointer",
                  borderRadius: "var(--radius-pill)",
                  boxShadow: "0 4px 20px rgba(255, 69, 0, 0.4)",
                  border: "none",
                }}
              >
                <span>🔐 Masuk ke Portal Operasional</span>
                <span>→</span>
              </LoginTriggerButton>

              <a
                href="#rekrutmen-marketing"
                className="marketing-pill-btn"
                style={{
                  padding: "0.95rem 1.75rem",
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span>💼 Peluang Mitra Marketing</span>
              </a>
            </div>

            {/* Trust Badges Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "2rem",
                flexWrap: "wrap",
                fontSize: "0.825rem",
                color: "var(--text-dim)",
                borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                paddingTop: "2rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>🛡️</span>
                <span>Role-Based Access Control (RBAC)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>⚡</span>
                <span>Sinkronisasi Offline-First Cloud</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>🔐</span>
                <span>Enkripsi Kredensial Berstandar Industri</span>
              </div>
            </div>
          </div>
        </section>

        <LoginModal />

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
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <Image
                src="/logo.svg?v=2"
                alt="Logo OKESIH.COM"
                width={42}
                height={42}
                style={{ width: "42px", height: "42px", objectFit: "contain", display: "block", flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--text-pure-white)", marginBottom: "0.25rem" }}>
                  OKESIH<span style={{ color: "var(--brand-orange-light)" }}>.COM</span>
                </div>
                <div>Platform Operasional POS &amp; Self-Order Cerdas untuk Usaha Kuliner Indonesia</div>
              </div>
            </div>

            <div className="footer-links" style={{ display: "flex", gap: "1.5rem" }}>
              <a href="#solusi" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Solusi Usaha</a>
              <a href="#fitur" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Fitur Modul</a>
              <a href="#tarif" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Skema Sewa</a>
              <Link href="/marketing" style={{ color: "#34D399", textDecoration: "none", fontWeight: 700 }}>Mitra Marketing</Link>
              <a href="#faq" style={{ color: "var(--text-muted)", textDecoration: "none" }}>Bantuan FAQ</a>
            </div>

            <div>
              © 2026 OKESIH.COM • All Rights Reserved.
            </div>
          </div>
        </footer>

        <MobileBottomBar />
      </main>
    </>
  );
}
