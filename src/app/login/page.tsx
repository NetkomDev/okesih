"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { extractUserRole } from "@/lib/auth-helpers";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        backgroundColor: "var(--bg-deep-black)",
        color: "#FFF",
        padding: "2rem 1.5rem",
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
            background: "radial-gradient(circle, #FF4500 0%, rgba(255, 69, 0, 0) 70%)",
            opacity: 0.2,
          }}
        />
        <div
          className="organic-shape"
          style={{
            width: "500px",
            height: "500px",
            bottom: "-100px",
            left: "-100px",
            background: "radial-gradient(circle, #D83A00 0%, rgba(216, 58, 0, 0) 70%)",
            opacity: 0.15,
          }}
        />
      </div>

      {/* Navigasi Kembali & Theme Toggle */}
      <div style={{ position: "absolute", top: "2rem", left: "2rem", zIndex: 10 }}>
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
      </div>

      <div style={{ position: "absolute", top: "2rem", right: "2rem", zIndex: 10 }}>
        <ThemeToggle />
      </div>

      {/* Card Login Terpusat */}
      <div
        className="login-modal-card"
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "450px",
        }}
      >
        {/* Header Portal */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-block" }}>
            <img
              src="/logo.svg"
              alt="Logo OKESIH.COM"
              width={72}
              height={72}
              style={{
                width: "72px",
                height: "72px",
                margin: "0 auto 1.25rem",
                objectFit: "contain",
                display: "block",
                filter: "drop-shadow(0 8px 24px rgba(255, 69, 0, 0.35))",
              }}
            />
          </Link>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>
            Portal Operasional OKESIH
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Masuk dengan kredensial Super Admin, Owner, Kasir, atau Tim Dapur.
          </p>
        </div>

        {/* Form Login */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {loginError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #EF4444",
                color: "#FCA5A5",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.825rem",
                fontWeight: 600,
              }}
            >
              ⚠️ {loginError}
            </div>
          )}

          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--text-pure-white)",
                display: "block",
                marginBottom: "0.4rem",
              }}
            >
              Username Akun
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.95rem",
                  color: "var(--text-dim)",
                }}
              >
                👤
              </span>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username akun Anda..."
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem 0.85rem 2.6rem",
                  borderRadius: "12px",
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-pure-white)",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--text-pure-white)",
                display: "block",
                marginBottom: "0.4rem",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <span
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "0.95rem",
                  color: "var(--text-dim)",
                }}
              >
                🔒
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "0.85rem 2.8rem 0.85rem 2.6rem",
                  borderRadius: "12px",
                  background: "var(--bg-surface-1)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-pure-white)",
                  fontSize: "0.95rem",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                style={{
                  position: "absolute",
                  right: "0.85rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94A3B8",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  cursor: "pointer",
                  padding: "0.25rem 0.4rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  borderRadius: "6px",
                }}
              >
                {showPassword ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    <span>Tutup</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <span>Lihat</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{
              width: "100%",
              marginTop: "0.35rem",
              padding: "0.95rem",
              fontWeight: 800,
              fontSize: "0.95rem",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              cursor: "pointer",
              border: "none",
            }}
          >
            {isLoading ? (
              <span>⏳ Memverifikasi Otoritas...</span>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>

        {/* Security Shield Note */}
        <div
          style={{
            marginTop: "1.5rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--text-dim)",
            lineHeight: 1.5,
          }}
        >
          <span>🛡️</span>
          <span>
            Sistem otomatis mendeteksi peran Anda dan mengarahkan langsung ke dashboard resmi yang berwenang.
          </span>
        </div>
      </div>
    </main>
  );
}
