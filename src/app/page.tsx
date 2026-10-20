import Link from "next/link";
import Image from "next/image";
import LandingHeader from "@/components/landing/LandingHeader";
import LoginModal from "@/components/landing/LoginModal";
import FaqAccordion from "@/components/landing/FaqAccordion";
import MobileBottomBar from "@/components/landing/MobileBottomBar";
import LoginTriggerButton from "@/components/landing/LoginTriggerButton";
import StandaloneLauncher from "@/components/StandaloneLauncher";
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

      {/* Auto-redirect installed standalone app to scanner */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            try {
              var isStandalone = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || !!(navigator && navigator.standalone);
              var search = window.location.search || '';
              if (isStandalone && !search.includes('view=landing') && !search.includes('from=scanner')) {
                var role = localStorage.getItem('okesih_installed_pwa_role') || '';
                if (role === 'owner') { window.location.replace('/owner'); }
                else if (role === 'superadmin') { window.location.replace('/superadmin'); }
                else if (role === 'marketing') { window.location.replace('/marketing/dashboard'); }
                else if (role === 'pos') { window.location.replace('/pos'); }
                else if (role === 'kds') { window.location.replace('/kds'); }
                else { window.location.replace('/scan'); }
              }
            } catch(e) {}
          })();`,
        }}
      />
      <StandaloneLauncher />

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
              ⚡ POS, Self-Order &amp; Antrean TV Tanpa Mesin Mahal
            </div>

            <h1 className="hero-heading">
              Kelola Pesanan Kilat, <span>Operasional Bebas Hambatan.</span>
            </h1>

            <p className="hero-subtitle">
              Sistem kasir offline-first, KDS dapur, antrean Smart TV, dan QR menu meja. Pakai HP atau tablet sendiri, tanpa beli mesin mahal, mulai Rp {saasFeePerReceipt.toLocaleString("id-ID")}/struk.
            </p>

            <div className="hero-cta-group">
              <Link href="/menu/demo?table=01" target="_blank" className="btn-primary">
                📱 Coba Demo QR Menu
              </Link>
              <LoginTriggerButton className="btn-secondary">
                <span>🔑 Masuk Akun Toko</span>
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
              <p>Dipercaya lebih dari <strong>1.000+</strong> pelaku usaha F&amp;B di seluruh Indonesia.</p>
            </div>

            <div className="hero-trust-row" aria-label="Keunggulan utama">
              <span>✓ Offline-First</span>
              <span>✓ Bawa HP Sendiri</span>
              <span>✓ Rp {saasFeePerReceipt.toLocaleString("id-ID")}/struk (Tanpa Bulanan)</span>
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
            padding: "3.5rem 1.5rem",
            maxWidth: "1240px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
              Cocok untuk Segala Usaha Kuliner
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto" }}>
              Fleksibel untuk warung kopi sederhana hingga resto berkapasitas ratusan meja.
            </p>
          </div>

          <div className="solusi-grid">
            {/* Card 1: Warkop & Kedai Kopi */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.15rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.85rem", marginBottom: "0.4rem" }}>☕</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Warkop &amp; Kedai Kopi</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Catat pesanan cepat, panggil nomor antrean di TV otomatis tanpa teriak.
              </p>
            </div>

            {/* Card 2: Rumah Makan & Warteg */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.15rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.85rem", marginBottom: "0.4rem" }}>🍽️</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Rumah Makan &amp; Warteg</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Nomor meja akurat, cetak struk bon instan, dan kas laci anti-selisih.
              </p>
            </div>

            {/* Card 3: Kafe & Bistro Modern */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.15rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.85rem", marginBottom: "0.4rem" }}>🍰</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Kafe &amp; Resto Modern</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Pesan mandiri via scan QR meja, bayar QRIS langsung masuk ke rekening Anda.
              </p>
            </div>

            {/* Card 4: Kedai Mie, Bakso & Soto */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.15rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.85rem", marginBottom: "0.4rem" }}>🍜</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Mie, Bakso &amp; Soto</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Hemat tempat, cukup 1 smartphone untuk kasir dan layar dapur.
              </p>
            </div>

            {/* Card 5: Stand Minuman & Boba */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.15rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.85rem", marginBottom: "0.4rem" }}>🧋</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Stand Minuman &amp; Boba</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Gerak cepat take-away, urai antrean panjang, dan rekap cup harian.
              </p>
            </div>

            {/* Card 6: Food Court & Franchise */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.15rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.85rem", marginBottom: "0.4rem" }}>🍔</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Food Court &amp; Franchise</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Panggilan suara robot TTS di Smart TV, koordinasi multi-tenant tetap rapi.
              </p>
            </div>

            {/* Card 7: Bakery & Toko Roti */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.15rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.85rem", marginBottom: "0.4rem" }}>🥐</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Bakery &amp; Toko Roti</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Kelola etalase varian rasa dengan update stok dan struk praktis.
              </p>
            </div>

            {/* Card 8: Angkringan & Street Food */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.15rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.85rem", marginBottom: "0.4rem" }}>🍢</div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, marginBottom: "0.25rem" }}>Angkringan &amp; Street Food</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.45, margin: 0 }}>
                Kasir mobile di meja, tetap lancar offline walau sinyal internet minim.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: 4 PILAR MODUL OPERASIONAL */}
        <section
          id="fitur"
          className="section-container"
          style={{
            padding: "3.5rem 1.5rem",
            maxWidth: "1240px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
              4 Modul Terpadu Siap Pakai
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto" }}>
              Semua modul otomatis terhubung secara real-time langsung dari browser HP, tablet, atau laptop.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Fitur 1 */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #FF5722, #FF4500)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  marginBottom: "1rem",
                  boxShadow: "0 4px 14px var(--brand-orange-glow)",
                }}
              >
                ⚡
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Modul Kasir (POS)</h3>
                <span className="badge badge-ready">Offline-First</span>
              </div>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1rem" }}>
                UI tap-tap kilat. Tetap bisa catat transaksi dan cetak struk bluetooth saat internet mati, otomatis sinkron saat online.
              </p>
              <div style={{ fontSize: "0.8rem", color: "var(--brand-orange-text)", fontWeight: 700 }}>
                ✓ Rekonsiliasi kas laci anti-selisih
              </div>
            </div>

            {/* Fitur 2 */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  marginBottom: "1rem",
                }}
              >
                🍳
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Kitchen Display (KDS)</h3>
                <span className="badge badge-cooking">Real-Time</span>
              </div>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1rem" }}>
                Tiket pesanan muncul instan &lt; 1 detik di layar tablet dapur dengan timer SLA warna. Bebas resiko nota kertas hilang.
              </p>
              <div style={{ fontSize: "0.8rem", color: "var(--accent-amber)", fontWeight: 700 }}>
                ✓ Pesanan tersaji tepat waktu
              </div>
            </div>

            {/* Fitur 3 */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  marginBottom: "1rem",
                }}
              >
                📺
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Antrean Smart TV</h3>
                <span className="badge badge-new">TTS Voice Robot</span>
              </div>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1rem" }}>
                Buka di browser Smart TV. Otomatis memanggil suara robot &quot;Nomor 12 silakan diambil&quot; saat pesanan selesai disiapkan.
              </p>
              <div style={{ fontSize: "0.8rem", color: "var(--accent-emerald)", fontWeight: 700 }}>
                ✓ Panggilan otomatis tanpa teriak
              </div>
            </div>

            {/* Fitur 4 */}
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  marginBottom: "1rem",
                }}
              >
                📱
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>QR Menu Meja</h3>
                <span className="badge badge-new">Self-Order</span>
              </div>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1rem" }}>
                Pelanggan scan QR di meja pakai HP sendiri untuk melihat menu, memesan, dan bayar QRIS langsung tanpa antre berdiri.
              </p>
              <div style={{ fontSize: "0.8rem", color: "var(--accent-purple)", fontWeight: 700 }}>
                ✓ 100% uang QRIS ke rekening Anda
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: KEUNGGULAN UTAMA (MENGAPA MEMILIH OKESIH) */}
        <section
          id="keunggulan"
          className="section-container"
          style={{
            padding: "3.5rem 1.5rem",
            maxWidth: "1140px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
              Keuntungan Nyata Menggunakan OKESIH
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto" }}>
              Efisiensi maksimal tanpa beban modal awal dan tanpa potongan komisi omzet.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.25rem" }} className="feature-split-grid">
            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>📱</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem" }}>
                Bawa HP Sendiri (Nol Biaya Mesin)
              </h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                Tidak perlu beli mesin kasir Rp 3–7 juta. Aplikasi berjalan langsung di HP Android, iPhone, tablet murah, maupun laptop yang sudah ada.
              </p>
            </div>

            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>💳</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem" }}>
                100% Uang Penjualan Milik Anda
              </h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                Uang pembayaran QRIS dari pelanggan langsung masuk 100% ke rekening bank/QRIS milik Anda. OKESIH tidak menahan ataupun memotong hasil penjualan Anda.
              </p>
            </div>

            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>👥</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem" }}>
                Kas Laci Anti-Selisih &amp; Roster
              </h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                Catat jam kerja staf dan cocokkan total tagihan struk bertanda tunai dengan uang fisik di laci kasir saat pergantian shift.
              </p>
            </div>

            <div className="glass-panel mobile-compact-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.4rem" }}>🔒</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "0.35rem" }}>
                Akun Staf Praktis Tanpa OTP/Email
              </h3>
              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                Owner membuat username &amp; password staf dari dashboard. Staf kasir dan dapur bisa langsung login bekerja tanpa ribet OTP di lapangan.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION: SIMULASI BIAYA & TARIF SEWA HEMAT */}
        <section
          id="tarif"
          className="section-container"
          style={{
            padding: "3.5rem 1.5rem",
            maxWidth: "960px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            className="glass-panel mobile-compact-panel"
            style={{
              padding: "2.5rem 1.75rem",
              textAlign: "center",
              border: "2px solid rgba(255, 69, 0, 0.4)",
              background: "linear-gradient(135deg, rgba(255, 69, 0, 0.08) 0%, rgba(13, 13, 14, 0.95) 100%)",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "var(--brand-orange-text)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
              SKEMA HARGA PALING ADIL
            </div>
            <h2 style={{ fontSize: "clamp(1.75rem, 4vw, 2.3rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.75rem" }}>
              Hanya <span style={{ color: "var(--brand-orange-text)" }}>Rp {saasFeePerReceipt.toLocaleString("id-ID")}</span> per Struk Transaksi
            </h2>
            <p style={{ fontSize: "0.925rem", color: "var(--text-muted)", maxWidth: "560px", margin: "0 auto 1.75rem", lineHeight: 1.5 }}>
              Tanpa biaya bulanan jutaan rupiah. Jika toko libur atau sepi, Anda tidak membayar biaya sewa membengkak!
            </p>

            {/* Perbandingan Grid */}
            <div
              className="price-compare-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1.25rem",
                maxWidth: "680px",
                margin: "0 auto 1.5rem",
                textAlign: "left",
              }}
            >
              <div style={{ padding: "1.25rem", borderRadius: "12px", background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ color: "#EF4444", fontWeight: 800, marginBottom: "0.5rem", fontSize: "0.95rem" }}>❌ Software POS Konvensional</div>
                <div style={{ fontSize: "0.825rem", lineHeight: 1.6 }}>
                  • Beli mesin kasir Rp 3.000.000+<br />
                  • Langganan Rp 250.000 – Rp 500.000/bln<br />
                  • Toko sepi tetap wajib bayar bulanan<br />
                  • Uang QRIS dipotong komisi omzet
                </div>
              </div>

              <div style={{ padding: "1.25rem", borderRadius: "12px", background: "var(--accent-emerald-bg)", border: "1px solid var(--accent-emerald-border)" }}>
                <div style={{ color: "var(--accent-emerald)", fontWeight: 800, marginBottom: "0.5rem", fontSize: "0.95rem" }}>✓ Platform OKESIH.COM</div>
                <div style={{ fontSize: "0.825rem", lineHeight: 1.6, fontWeight: 600 }}>
                  • Nol modal mesin (pakai HP sendiri)<br />
                  • Flat Rp {saasFeePerReceipt.toLocaleString("id-ID")} per struk tercetak<br />
                  • 100 struk sehari hanya sewa Rp {(100 * saasFeePerReceipt).toLocaleString("id-ID")}<br />
                  • 100% uang QRIS langsung ke rekening Anda
                </div>
              </div>
            </div>

            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              *Setoran sewa harian dibayar saat tutup toko dengan kode unik otomatis via transfer bank.
            </div>
          </div>
        </section>

        {/* BANNER AJAKAN: PROGRAM KEMITRAAN MARKETING RESMI (AKSES HALAMAN KHUSUS) */}
        <section
          id="rekrutmen-marketing"
          className="section-container"
          style={{
            padding: "3rem 1.5rem",
            maxWidth: "1080px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            className="glass-panel-glow mobile-compact-panel mkt-container-card"
            style={{
              padding: "2.75rem 2rem",
              borderRadius: "22px",
              border: "1px solid var(--accent-emerald-border)",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(13, 13, 14, 0.98) 100%)",
              boxShadow: "0 18px 50px rgba(0, 0, 0, 0.5), 0 0 35px rgba(16, 185, 129, 0.12)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "1.1rem",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.35rem 1rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "var(--accent-emerald-bg)",
                border: "1px solid var(--accent-emerald-border)",
                color: "var(--accent-emerald)",
                fontSize: "0.78rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              💼 PROGRAM KEMITRAAN MARKETING RESMI
            </div>

            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)",
                fontWeight: 900,
                letterSpacing: "-0.025em",
                lineHeight: 1.25,
                color: "inherit",
                maxWidth: "760px",
              }}
            >
              Raih Komisi Pasif Harian Bersama OKESIH
            </h2>

            <p
              style={{
                fontSize: "0.925rem",
                color: "var(--text-muted)",
                maxWidth: "640px",
                lineHeight: 1.55,
                margin: "0 auto",
              }}
            >
              Daftarkan warkop, kafe, dan resto di wilayah Anda. Nikmati bagi hasil otomatis{" "}
              <strong style={{ color: "var(--accent-emerald)" }}>Rp {marketingCommission.toLocaleString("id-ID")} per struk transaksi</strong> seumur hidup yang dicairkan langsung ke rekening bank atau e-wallet Anda.
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.85rem",
                flexWrap: "wrap",
                marginTop: "0.5rem",
              }}
            >
              <Link
                href="/marketing"
                className="btn-primary"
                style={{
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  padding: "0.85rem 1.85rem",
                  fontSize: "0.9rem",
                  fontWeight: 900,
                  borderRadius: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 6px 20px rgba(16, 185, 129, 0.35)",
                  textDecoration: "none",
                  color: "#FFF",
                }}
              >
                <span>Pelajari Detail &amp; Simulasi Komisi</span>
                <span>→</span>
              </Link>

              <Link
                href="/marketing/daftar"
                className="btn-secondary"
                style={{
                  padding: "0.85rem 1.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  borderRadius: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  textDecoration: "none",
                }}
              >
                <span>📝 Formulir Pendaftaran</span>
              </Link>
            </div>

            <div
              style={{
                marginTop: "0.5rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "1.25rem",
                flexWrap: "wrap",
                fontSize: "0.775rem",
                color: "var(--text-dim)",
              }}
            >
              <span>✓ 100% Gratis Tanpa Modal</span>
              <span>✓ Kode Referral Resmi</span>
              <span>✓ Rekap Struk Otomatis</span>
            </div>
          </div>
        </section>

        {/* SECTION: PERTANYAAN UMUM (FAQ) */}
        <section
          id="faq"
          className="section-container"
          style={{
            padding: "3.5rem 1.5rem",
            maxWidth: "880px",
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 3.5vw, 2rem)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
              Pertanyaan yang Sering Diajukan (FAQ)
            </h2>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
              Jawaban cepat seputar sistem kasir dan skema sewa OKESIH.
            </p>
          </div>

          <FaqAccordion items={faqs} />
        </section>

        {/* SECTION: CLOSING CTA / PORTAL AKSES KELOLA RESMI */}
        <section
          id="akses-sistem"
          className="section-container"
          style={{
            padding: "3.5rem 1.5rem 5rem",
            maxWidth: "1080px",
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
                width: "450px",
                height: "450px",
                bottom: "-80px",
                right: "10%",
                background: "radial-gradient(circle, #FF4500 0%, rgba(255, 69, 0, 0) 70%)",
                opacity: 0.12,
              }}
            />
          </div>

          <div
            className="glass-panel-glow mobile-compact-panel"
            style={{
              padding: "3rem 1.75rem",
              textAlign: "center",
              borderRadius: "24px",
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
                padding: "0.35rem 1rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "rgba(255, 69, 0, 0.12)",
                border: "1px solid rgba(255, 69, 0, 0.3)",
                color: "var(--brand-orange-text)",
                fontSize: "0.78rem",
                fontWeight: 800,
                marginBottom: "1rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              🔒 Akses Ekosistem OKESIH
            </div>

            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.3rem)",
                fontWeight: 900,
                letterSpacing: "-0.025em",
                marginBottom: "0.75rem",
                lineHeight: 1.25,
              }}
            >
              Kelola Usaha Kuliner dalam Satu Sentuhan
            </h2>

            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-muted)",
                maxWidth: "620px",
                margin: "0 auto 2rem",
                lineHeight: 1.55,
              }}
            >
              Sudah memiliki akun toko? Masuk untuk mengelola pesanan, pantau omzet kas, dan perbarui katalog menu secara real-time.
            </p>

            {/* Tombol Akses & Kemitraan */}
            <div
              style={{
                display: "flex",
                gap: "0.85rem",
                justifyContent: "center",
                flexWrap: "wrap",
                marginBottom: "2rem",
              }}
            >
              <LoginTriggerButton
                className="btn-primary"
                style={{
                  padding: "0.85rem 1.85rem",
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  borderRadius: "var(--radius-pill)",
                  boxShadow: "0 4px 18px rgba(255, 69, 0, 0.35)",
                  border: "none",
                }}
              >
                <span>🔐 Masuk Portal Operasional</span>
                <span>→</span>
              </LoginTriggerButton>

              <a
                href="#rekrutmen-marketing"
                className="marketing-pill-btn"
                style={{
                  padding: "0.85rem 1.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
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
                gap: "1.5rem",
                flexWrap: "wrap",
                fontSize: "0.8rem",
                color: "var(--text-dim)",
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: "1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span>🛡️</span>
                <span>Role-Based Access (RBAC)</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span>⚡</span>
                <span>Sinkronisasi Offline-First</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <span>🔐</span>
                <span>Enkripsi Kredensial Aman</span>
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
