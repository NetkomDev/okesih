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
        setLoginError(error.message === "Invalid login credentials"
          ? "Username atau password salah!"
          : error.message);
        setIsLoading(false);
        return;
      }

      // Deteksi peran pengguna secara andal untuk mencegah celah keamanan
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

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setLoginError("");
  };
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "var(--bg-deep-black)",
      }}
    >
      {/* Background Organic Glowing Gradients */}
      <div
        className="organic-shape"
        style={{
          width: "600px",
          height: "600px",
          top: "-200px",
          right: "-150px",
          background: "radial-gradient(circle, #FF4500 0%, rgba(255, 69, 0, 0) 70%)",
        }}
      />
      <div
        className="organic-shape"
        style={{
          width: "500px",
          height: "500px",
          bottom: "-150px",
          left: "-100px",
          background: "radial-gradient(circle, #D83A00 0%, rgba(216, 58, 0, 0) 70%)",
          opacity: 0.15,
        }}
      />

      {/* Top Navigation */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2rem",
          borderBottom: "1px solid var(--border-subtle)",
          position: "relative",
          zIndex: 10,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
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
              fontSize: "1.2rem",
              color: "#FFF",
            }}
          >
            ☕
          </div>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              OKESIH<span style={{ color: "var(--brand-orange-light)" }}>.COM</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 500 }}>
              Sistem Operasional Warkop Modern
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span className="badge badge-ready" style={{ display: "none" }}>
            ● PWA Ready
          </span>
          <Link href="/api/health" className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            Status Server
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section
        style={{
          padding: "3.5rem 2rem 2rem",
          maxWidth: "1200px",
          margin: "0 auto",
          width: "100%",
          position: "relative",
          zIndex: 5,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "780px", margin: "0 auto 3.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.35rem 1rem",
              borderRadius: "var(--radius-pill)",
              backgroundColor: "var(--brand-orange-subtle)",
              border: "1px solid rgba(255, 69, 0, 0.3)",
              color: "var(--brand-orange-light)",
              fontSize: "0.825rem",
              fontWeight: 700,
              marginBottom: "1.5rem",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            ⚡ Ekosistem High-Throughput Warkop
          </div>

          <h1
            style={{
              fontSize: "clamp(2.2rem, 5vw, 3.75rem)",
              fontWeight: 900,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              marginBottom: "1.25rem",
            }}
          >
            Pesanan Ngalir Cepat,{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #FF6A00 0%, #FF4500 50%, #FFA07A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Warkop Anti-Macet.
            </span>
          </h1>

          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: 1.6,
              color: "var(--text-muted)",
              marginBottom: "2rem",
            }}
          >
            POS Kasir Offline-First, Kitchen Display System instan, dan Layar Antrean TV otomatis.
            Bawa HP & Smart TV sendiri, bayar sewa hanya <strong style={{ color: "#FFF" }}>Rp 50 per struk</strong>.
          </p>
        </div>

        {/* 5 Portals Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1.25rem",
            marginBottom: "3rem",
          }}
        >
          {/* Card 1: Kasir POS */}
          <Link href="/pos" className="glass-panel" style={{ padding: "1.75rem", display: "block", transition: "all 0.2s ease" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
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
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Modul Kasir (POS)</h3>
              <span className="badge badge-ready">Offline Ready</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              UI tap-tap super cepat di tablet/HP kasir. Tetap bisa transaksi saat internet mati, sync otomatis saat online.
            </p>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--brand-orange-light)" }}>
              Buka Layar Kasir →
            </div>
          </Link>

          {/* Card 2: Dapur KDS */}
          <Link href="/kds" className="glass-panel" style={{ padding: "1.75rem", display: "block", transition: "all 0.2s ease" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
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
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Dapur (KDS)</h3>
              <span className="badge badge-cooking">Real-Time</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              Tiket pesanan muncul instan &lt; 1 detik via WebSockets. Dilengkapi indikator waktu SLA agar barista gak kelupaan.
            </p>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#FBBF24" }}>
              Buka Layar Dapur →
            </div>
          </Link>

          {/* Card 3: Layar Antrean TV */}
          <Link href="/tv" className="glass-panel" style={{ padding: "1.75rem", display: "block", transition: "all 0.2s ease" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
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
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Layar Antrean TV</h3>
              <span className="badge badge-new">TTS Voice</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              Tampilan fullscreen untuk Smart TV. Memanggil suara robot &quot;Nomor 12 silakan diambil&quot; saat barista selesai.
            </p>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#34D399" }}>
              Buka Layar TV →
            </div>
          </Link>

          {/* Card 4: QR Menu Pelanggan */}
          <Link href="/menu/demo-warkop" className="glass-panel" style={{ padding: "1.75rem", display: "block", transition: "all 0.2s ease" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
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
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>QR Menu Meja</h3>
              <span className="badge badge-new">Self-Order</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              Katalog digital pelanggan dari scan meja. Hasilkan QR pesanan untuk di-scan kasir tanpa bolak-balik antre.
            </p>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#A78BFA" }}>
              Lihat Contoh Menu →
            </div>
          </Link>

          {/* Card 5: Portal Owner Warkop */}
          <Link href="/owner" className="glass-panel" style={{ padding: "1.75rem", display: "block", transition: "all 0.2s ease" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
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
              ☕
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Portal Owner Warkop</h3>
              <span className="badge badge-ready">Tenant Portal</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              Kelola sistem bisnis warkop Anda: buat akun staf kasir, daftar waiters, QRIS toko, katalog menu, dan omzet harian.
            </p>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--brand-orange-light)" }}>
              Buka Dashboard Owner →
            </div>
          </Link>

          {/* Card 6: Super Admin Pusat HQ */}
          <Link href="/superadmin" className="glass-panel" style={{ padding: "1.75rem", display: "block", transition: "all 0.2s ease", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                marginBottom: "1.25rem",
                boxShadow: "0 6px 16px rgba(14, 165, 233, 0.3)",
              }}
            >
              🛡️
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Super Admin Pusat</h3>
              <span className="badge" style={{ background: "rgba(14, 165, 233, 0.2)", color: "#38BDF8" }}>
                SaaS HQ
              </span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              Daftarkan tenant warkop baru, pantau seluruh resume ekosistem SaaS, dan kelola konfigurasi global pusat.
            </p>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#38BDF8" }}>
              Buka Command Center HQ →
            </div>
          </Link>
        </div>

        {/* Quick Staff Login Portal */}
        <div
          className="glass-panel-glow"
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            Masuk Cepat Staf Warkop
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
            Gak perlu email atau kode OTP ribet. Cukup masukkan username dan password yang diberikan oleh Owner warkop Anda.
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
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                Username Staf (Atau Email)
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="superadmin, kasir1, atau dapur..."
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
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
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
              style={{ width: "100%", marginTop: "0.5rem", padding: "0.9rem", fontWeight: 800 }}
            >
              {isLoading ? "Memverifikasi..." : "Masuk ke Sistem OKESIH"}
            </button>

            {/* Quick Demo Credentials Box for Reviewer */}
            <div
              style={{
                marginTop: "1.25rem",
                padding: "1rem",
                background: "var(--bg-surface-2)",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border-subtle)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.6rem", fontWeight: 700 }}>
                💡 Klik Cepat Akun Demo (Untuk Reviewer):
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => fillCredentials("superadmin", "adminokesih2026!")}
                  style={{
                    background: "rgba(14, 165, 233, 0.15)",
                    border: "1px solid rgba(14, 165, 233, 0.4)",
                    color: "#38BDF8",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "0.35rem 0.75rem",
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                  }}
                >
                  🛡️ superadmin
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials("owner1", "owner123!")}
                  style={{
                    background: "rgba(255, 69, 0, 0.15)",
                    border: "1px solid rgba(255, 69, 0, 0.4)",
                    color: "var(--brand-orange-light)",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "0.35rem 0.75rem",
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                  }}
                >
                  ☕ owner1
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials("kasir1", "kasir123!")}
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#34D399",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "0.35rem 0.75rem",
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                  }}
                >
                  ⚡ kasir1
                </button>
                <button
                  type="button"
                  onClick={() => fillCredentials("dapur", "dapur123!")}
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    color: "#FBBF24",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "0.35rem 0.75rem",
                    borderRadius: "var(--radius-pill)",
                    cursor: "pointer",
                  }}
                >
                  🍳 dapur
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: "auto",
          padding: "2rem",
          borderTop: "1px solid var(--border-subtle)",
          textAlign: "center",
          fontSize: "0.85rem",
          color: "var(--text-dim)",
          position: "relative",
          zIndex: 5,
        }}
      >
        <p>OKESIH.COM — Micro-SaaS B2B Operasional Warkop High-Throughput &copy; 2026.</p>
        <p style={{ marginTop: "0.25rem" }}>
          Infrastruktur: Next.js PWA + Supabase Postgres BaaS + Vercel Serverless.
        </p>
      </footer>
    </main>
  );
}
