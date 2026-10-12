"use client";

import Link from "next/link";
import { useState } from "react";

export default function MarketingRegisterPage() {
  const [mktFullName, setMktFullName] = useState("");
  const [mktPhone, setMktPhone] = useState("");
  const [mktEmail, setMktEmail] = useState("");
  const [mktCityArea, setMktCityArea] = useState("");
  const [mktBankName, setMktBankName] = useState("BCA");
  const [mktBankAccountNo, setMktBankAccountNo] = useState("");
  const [mktBankAccountName, setMktBankAccountName] = useState("");
  const [mktNotes, setMktNotes] = useState("");
  const [mktSubmitting, setMktSubmitting] = useState(false);
  const [mktSuccess, setMktSuccess] = useState<{ referralCode: string; fullName: string; cityArea: string } | null>(null);
  const [mktError, setMktError] = useState("");

  const handleMarketingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMktSubmitting(true);
    setMktError("");
    setMktSuccess(null);

    try {
      const res = await fetch("/api/marketing/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: mktFullName,
          phone: mktPhone,
          email: mktEmail,
          cityArea: mktCityArea,
          bankName: mktBankName,
          bankAccountNumber: mktBankAccountNo,
          bankAccountName: mktBankAccountName,
          experienceNotes: mktNotes,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal memproses pendaftaran.");
      }

      setMktSuccess(result.data);
      setMktFullName("");
      setMktPhone("");
      setMktEmail("");
      setMktCityArea("");
      setMktBankAccountNo("");
      setMktBankAccountName("");
      setMktNotes("");
    } catch (err: unknown) {
      setMktError(err instanceof Error ? err.message : "Terjadi kesalahan sistem saat mengirim pendaftaran.");
    } finally {
      setMktSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        backgroundColor: "var(--bg-deep-black)",
        color: "#FFF",
        padding: "2rem 1.5rem 5rem",
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
            width: "550px",
            height: "550px",
            top: "-150px",
            right: "-100px",
            background: "radial-gradient(circle, #10B981 0%, rgba(16, 185, 129, 0) 70%)",
            opacity: 0.15,
          }}
        />
        <div
          className="organic-shape"
          style={{
            width: "500px",
            height: "500px",
            bottom: "-100px",
            left: "-100px",
            background: "radial-gradient(circle, #059669 0%, rgba(5, 150, 105, 0) 70%)",
            opacity: 0.12,
          }}
        />
      </div>

      {/* Header Bar */}
      <div
        style={{
          maxWidth: "860px",
          width: "100%",
          margin: "0 auto 2.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--text-muted)",
            fontSize: "0.875rem",
            fontWeight: 700,
            textDecoration: "none",
            padding: "0.5rem 1rem",
            borderRadius: "var(--radius-pill)",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-subtle)",
            transition: "all 0.2s ease",
          }}
        >
          <span>←</span>
          <span>Kembali ke Beranda</span>
        </Link>

        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #FF5722, #FF4500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
              }}
            >
              ☕
            </div>
            <span style={{ fontWeight: 900, fontSize: "1.1rem" }}>
              OKESIH<span style={{ color: "var(--brand-orange-light)" }}>.COM</span>
            </span>
          </div>
        </Link>
      </div>

      {/* Container Formulir Pendaftaran */}
      <div
        className="glass-panel-glow mobile-compact-panel"
        style={{
          padding: "3rem 2.25rem",
          borderRadius: "24px",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 13, 14, 0.98) 100%)",
          boxShadow: "0 16px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.15)",
          maxWidth: "840px",
          width: "100%",
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
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
              fontSize: "0.825rem",
              fontWeight: 800,
              marginBottom: "1rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            💼 PROGRAM KEMITRAAN MARKETING RESMI
          </div>

          <h1
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.25rem)",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              marginBottom: "0.75rem",
            }}
          >
            Formulir Pendaftaran Mitra Marketing Lapangan
          </h1>

          <p style={{ fontSize: "0.925rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.6 }}>
            Dapatkan kode referral eksklusif terdaftar resmi di Okesih.com. Nikmati bagi hasil otomatis{" "}
            <strong style={{ color: "#34D399" }}>Rp 15 per struk transaksi</strong> seumur hidup untuk setiap warkop/resto yang Anda daftarkan!
          </p>
        </div>

        {/* Notifikasi Pendaftaran Berhasil */}
        {mktSuccess && (
          <div
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid #10B981",
              borderRadius: "16px",
              padding: "2rem",
              marginBottom: "2.5rem",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#34D399", marginBottom: "0.5rem" }}>
              Pendaftaran Anda Berhasil Diterima!
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#E2E8F0", marginBottom: "1.25rem" }}>
              Terima kasih <strong>{mktSuccess.fullName}</strong>. Data Anda telah masuk ke sistem antrean verifikasi Super Admin untuk wilayah <strong>{mktSuccess.cityArea}</strong>.
            </p>

            <div
              style={{
                display: "inline-block",
                background: "rgba(0, 0, 0, 0.6)",
                border: "2px dashed #10B981",
                borderRadius: "12px",
                padding: "1rem 2rem",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#A0AEC0", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Kode Referral Resmi Anda
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#FBBF24", letterSpacing: "0.05em", marginTop: "0.25rem" }}>
                {mktSuccess.referralCode}
              </div>
            </div>

            <div>
              <a
                href={`https://wa.me/6281234567890?text=${encodeURIComponent(`Halo Super Admin OKESIH, saya baru saja mendaftar sebagai Mitra Marketing atas nama ${mktSuccess.fullName} (Kode: ${mktSuccess.referralCode}) untuk area ${mktSuccess.cityArea}. Mohon bantuan aktivasi kemitraan saya.`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{
                  background: "#25D366",
                  color: "#FFF",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.85rem 1.6rem",
                  borderRadius: "var(--radius-pill)",
                  textDecoration: "none",
                }}
              >
                <span>💬 Konfirmasi via WhatsApp Okesih.com Sekarang</span>
                <span>→</span>
              </a>
            </div>
          </div>
        )}

        {/* Notifikasi Error */}
        {mktError && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #EF4444",
              color: "#FCA5A5",
              padding: "1rem",
              borderRadius: "12px",
              fontSize: "0.875rem",
              fontWeight: 600,
              marginBottom: "1.5rem",
            }}
          >
            ⚠️ {mktError}
          </div>
        )}

        {/* Form Pendaftaran */}
        <form onSubmit={handleMarketingSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
            <div>
              <label style={{ fontSize: "0.825rem", fontWeight: 700, color: "#E2E8F0", display: "block", marginBottom: "0.4rem" }}>
                Nama Lengkap <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={mktFullName}
                onChange={(e) => setMktFullName(e.target.value)}
                placeholder="Contoh: Rian Ardiansyah"
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-subtle)",
                  color: "#FFF",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.825rem", fontWeight: 700, color: "#E2E8F0", display: "block", marginBottom: "0.4rem" }}>
                Nomor WhatsApp / HP <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="tel"
                required
                value={mktPhone}
                onChange={(e) => setMktPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-subtle)",
                  color: "#FFF",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
            <div>
              <label style={{ fontSize: "0.825rem", fontWeight: 700, color: "#E2E8F0", display: "block", marginBottom: "0.4rem" }}>
                Kota / Wilayah Jangkauan Anda <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <input
                type="text"
                required
                value={mktCityArea}
                onChange={(e) => setMktCityArea(e.target.value)}
                placeholder="Contoh: Surabaya &amp; Sidoarjo / Jakarta Selatan"
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-subtle)",
                  color: "#FFF",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.3rem" }}>
                Digunakan Super Admin untuk memetakan distribusi materi stiker &amp; tenant.
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.825rem", fontWeight: 700, color: "#E2E8F0", display: "block", marginBottom: "0.4rem" }}>
                Email (Opsional)
              </label>
              <input
                type="email"
                value={mktEmail}
                onChange={(e) => setMktEmail(e.target.value)}
                placeholder="nama@email.com"
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-subtle)",
                  color: "#FFF",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Data Rekening Pencairan Komisi */}
          <div
            style={{
              padding: "1.5rem",
              borderRadius: "14px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "1.1rem",
            }}
          >
            <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "#34D399" }}>
              🏦 Rekening Bank / E-Wallet Pencairan Komisi
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Nama Bank / E-Wallet <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  value={mktBankName}
                  onChange={(e) => setMktBankName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.85rem 1rem",
                    borderRadius: "10px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    outline: "none",
                  }}
                >
                  <option value="BCA">BCA (Bank Central Asia)</option>
                  <option value="BRI">BRI (Bank Rakyat Indonesia)</option>
                  <option value="Mandiri">Bank Mandiri</option>
                  <option value="BNI">BNI (Bank Negara Indonesia)</option>
                  <option value="BSI">BSI (Bank Syariah Indonesia)</option>
                  <option value="CIMB">CIMB Niaga</option>
                  <option value="Bank Jago">Bank Jago</option>
                  <option value="SeaBank">SeaBank</option>
                  <option value="Dana">DANA</option>
                  <option value="GoPay">GoPay</option>
                  <option value="ShopeePay">ShopeePay</option>
                  <option value="OVO">OVO</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Nomor Rekening / HP E-Wallet <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mktBankAccountNo}
                  onChange={(e) => setMktBankAccountNo(e.target.value)}
                  placeholder="Nomor rekening Anda..."
                  style={{
                    width: "100%",
                    padding: "0.85rem 1rem",
                    borderRadius: "10px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Nama Pemilik Rekening <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mktBankAccountName}
                  onChange={(e) => setMktBankAccountName(e.target.value)}
                  placeholder="Nama sesuai buku tabungan..."
                  style={{
                    width: "100%",
                    padding: "0.85rem 1rem",
                    borderRadius: "10px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.825rem", fontWeight: 700, color: "#E2E8F0", display: "block", marginBottom: "0.35rem" }}>
              Catatan Pengalaman / Target Usaha di Area Anda (Opsional)
            </label>
            <textarea
              rows={3}
              value={mktNotes}
              onChange={(e) => setMktNotes(e.target.value)}
              placeholder="Misal: Sudah memiliki kenalan 8 warkop &amp; 3 kafe di kawasan kampus..."
              style={{
                width: "100%",
                padding: "0.85rem 1rem",
                borderRadius: "10px",
                background: "var(--bg-surface-1)",
                border: "1px solid var(--border-subtle)",
                color: "#FFF",
                outline: "none",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={mktSubmitting}
            className="btn-primary"
            style={{
              width: "100%",
              padding: "1.1rem",
              fontSize: "1rem",
              fontWeight: 900,
              background: "linear-gradient(135deg, #10B981, #059669)",
              boxShadow: "0 6px 24px rgba(16, 185, 129, 0.4)",
              cursor: mktSubmitting ? "not-allowed" : "pointer",
              borderRadius: "12px",
              border: "none",
            }}
          >
            {mktSubmitting ? "Memproses Pendaftaran..." : "🚀 Kirim Pendaftaran Mitra Marketing Sekarang"}
          </button>

          <div style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--text-dim)" }}>
            Pendaftaran 100% Gratis tanpa dipungut biaya apapun. Tim Super Admin OKESIH akan memvalidasi data Anda maksimal 1x24 jam kerja.
          </div>
        </form>
      </div>
    </main>
  );
}
