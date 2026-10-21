"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // State Pengajuan Reset Password Khusus Owner & Marketing
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotRole, setForgotRole] = useState<"OWNER" | "MARKETING">("OWNER");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotResult, setForgotResult] = useState<{
    success: boolean;
    message: string;
    whatsappUrl: string;
    account: {
      role: string;
      roleLabel: string;
      name: string;
      username: string;
      phone: string;
      businessName?: string;
    };
  } | null>(null);

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingForgot(true);
    setForgotError("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          role: forgotRole,
          identifier: forgotIdentifier,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Gagal memproses pengajuan reset password.");
      }
      setForgotResult(payload);
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmittingForgot(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err === "unauthorized") {
        setLoginError("Akses Ditolak: Anda tidak memiliki izin untuk halaman tersebut.");
      } else if (err === "login_required") {
        setLoginError("Sesi Anda telah berakhir. Silakan masuk kembali.");
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError("");

    try {
      const response = await fetch("/api/auth/handoff/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setLoginError(payload.error || "Login tidak dapat diproses.");
        setIsLoading(false);
        return;
      }
      window.location.assign(payload.redirectTo);
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
        color: "var(--text-pure-white)",
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
          href="/?view=landing"
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
          <svg
            width="20"
            height="20"
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
              src="/logo.svg?v=2"
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
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0" }}>
            Masuk ke OKESIH
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Sistem akan membuka portal sesuai hak akses akun Anda.
          </p>
        </div>

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
              Username
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

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-0.25rem" }}>
            <button
              type="button"
              onClick={() => {
                setIsForgotModalOpen(true);
                setForgotError("");
                setForgotResult(null);
                setForgotIdentifier("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--brand-orange-light, #FF6A00)",
                fontSize: "0.825rem",
                fontWeight: 700,
                cursor: "pointer",
                padding: "0.2rem 0",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Lupa Password
            </button>
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
      </div>

      {/* Modal Pengajuan Reset Password Khusus Owner & Marketing */}
      {isForgotModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.25rem",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(10px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsForgotModalOpen(false);
          }}
        >
          <div
            className="login-modal-card"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "470px",
              background: "var(--bg-surface-1, #151518)",
              border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
              borderRadius: "20px",
              padding: "1.85rem",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.65)",
              color: "var(--text-pure-white, #FFFFFF)",
            }}
          >
            {/* Header Modal */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>
                  Pengajuan Reset Password
                </h2>
                <p style={{ color: "var(--text-dim, #71717A)", fontSize: "0.825rem", marginTop: "0.35rem", marginBottom: 0 }}>
                  Khusus akun Owner Bisnis dan Mitra Marketing OKESIH.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted, #A0A0AA)",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "6px",
                  lineHeight: 1,
                }}
                title="Tutup Modal"
              >
                ✕
              </button>
            </div>

            {forgotResult ? (
              /* State Sukses: Terkirim ke Sistem + Tombol WhatsApp Super Admin */
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.12)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    borderRadius: "14px",
                    padding: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.85rem",
                  }}
                >
                  <span style={{ fontSize: "1.75rem" }}>✓</span>
                  <div>
                    <strong style={{ color: "#34D399", fontSize: "0.95rem", display: "block" }}>
                      Tercatat di Sistem!
                    </strong>
                    <span style={{ color: "var(--text-pure-white, #FFFFFF)", fontSize: "0.825rem" }}>
                      Pengajuan reset password telah diverifikasi dan tersimpan di database sistem.
                    </span>
                  </div>
                </div>

                {/* Ringkasan Akun */}
                <div
                  style={{
                    background: "var(--bg-surface-2, #1C1C21)",
                    borderRadius: "14px",
                    padding: "1rem",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
                    fontSize: "0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim, #71717A)" }}>Peran Akun:</span>
                    <strong style={{ color: "var(--brand-orange-light, #FF6A00)" }}>{forgotResult.account.roleLabel}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim, #71717A)" }}>Nama Pengguna:</span>
                    <strong>{forgotResult.account.name}</strong>
                  </div>
                  {forgotResult.account.businessName && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-dim, #71717A)" }}>Nama Usaha:</span>
                      <strong>{forgotResult.account.businessName}</strong>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim, #71717A)" }}>Username:</span>
                    <code style={{ background: "rgba(255, 255, 255, 0.08)", padding: "2px 6px", borderRadius: "4px" }}>
                      {forgotResult.account.username}
                    </code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-dim, #71717A)" }}>No. WhatsApp:</span>
                    <span>+{forgotResult.account.phone}</span>
                  </div>
                </div>

                <p style={{ color: "var(--text-dim, #71717A)", fontSize: "0.825rem", margin: 0, lineHeight: 1.45 }}>
                  Lanjutkan dengan mengirimkan rincian pengajuan ke WhatsApp resmi Super Admin agar password baru segera diproses dan diaktifkan.
                </p>

                {/* Tombol Utama: Kirim ke WhatsApp Super Admin */}
                <a
                  href={forgotResult.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.6rem",
                    background: "#25D366",
                    color: "#FFFFFF",
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    padding: "0.95rem",
                    borderRadius: "12px",
                    textDecoration: "none",
                    boxShadow: "0 6px 20px rgba(37, 211, 102, 0.35)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                  <span>Kirim ke WhatsApp Super Admin ↗</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotModalOpen(false);
                    setForgotResult(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))",
                    color: "var(--text-muted, #A0A0AA)",
                    padding: "0.75rem",
                    borderRadius: "12px",
                    fontWeight: 700,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  Tutup / Kembali ke Login
                </button>
              </div>
            ) : (
              /* State Form Input Pengajuan */
              <form onSubmit={handleForgotPasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
                {forgotError && (
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
                    ⚠️ {forgotError}
                  </div>
                )}

                {/* Pemilih Peran Akun */}
                <div>
                  <label
                    style={{
                      fontSize: "0.825rem",
                      fontWeight: 700,
                      color: "var(--text-pure-white, #FFFFFF)",
                      display: "block",
                      marginBottom: "0.45rem",
                    }}
                  >
                    Pilih Peran Akun Anda
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    <button
                      type="button"
                      onClick={() => setForgotRole("OWNER")}
                      style={{
                        padding: "0.75rem 0.6rem",
                        borderRadius: "12px",
                        border: forgotRole === "OWNER"
                          ? "2px solid var(--brand-orange-primary, #FF4500)"
                          : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
                        background: forgotRole === "OWNER"
                          ? "rgba(255, 69, 0, 0.15)"
                          : "var(--bg-surface-2, #1C1C21)",
                        color: forgotRole === "OWNER" ? "#FFFFFF" : "var(--text-muted, #A0A0AA)",
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span>🏢</span>
                      <span>Owner Bisnis</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForgotRole("MARKETING")}
                      style={{
                        padding: "0.75rem 0.6rem",
                        borderRadius: "12px",
                        border: forgotRole === "MARKETING"
                          ? "2px solid #0D9488"
                          : "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
                        background: forgotRole === "MARKETING"
                          ? "rgba(13, 148, 136, 0.2)"
                          : "var(--bg-surface-2, #1C1C21)",
                        color: forgotRole === "MARKETING" ? "#FFFFFF" : "var(--text-muted, #A0A0AA)",
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span>💼</span>
                      <span>Mitra Marketing</span>
                    </button>
                  </div>
                </div>

                {/* Input Identifier (Username / No WhatsApp) */}
                <div>
                  <label
                    style={{
                      fontSize: "0.825rem",
                      fontWeight: 700,
                      color: "var(--text-pure-white, #FFFFFF)",
                      display: "block",
                      marginBottom: "0.45rem",
                    }}
                  >
                    Username atau No. WhatsApp Terdaftar
                  </label>
                  <div style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: "1rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "0.95rem",
                        color: "var(--text-dim, #71717A)",
                      }}
                    >
                      🔍
                    </span>
                    <input
                      type="text"
                      required
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder={forgotRole === "OWNER" ? "Contoh: owner_berkah atau 08123456789" : "Contoh: marketing_jkt atau 08123456789"}
                      style={{
                        width: "100%",
                        padding: "0.85rem 1rem 0.85rem 2.6rem",
                        borderRadius: "12px",
                        background: "var(--bg-surface-2, #1C1C21)",
                        border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))",
                        color: "var(--text-pure-white, #FFFFFF)",
                        fontSize: "0.95rem",
                        outline: "none",
                      }}
                    />
                  </div>
                  <small style={{ display: "block", color: "var(--text-dim, #71717A)", fontSize: "0.75rem", marginTop: "0.35rem" }}>
                    {forgotRole === "OWNER"
                      ? "Masukkan username akun Owner atau nomor WhatsApp Owner yang terdaftar di warkop Anda."
                      : "Masukkan username akun Marketing atau nomor WhatsApp yang didaftarkan ke tim OKESIH."}
                  </small>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingForgot || !forgotIdentifier.trim()}
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
                  {isSubmittingForgot ? (
                    <span>⏳ Memverifikasi ke Sistem...</span>
                  ) : (
                    <>
                      <span>Ajukan Reset Password</span>
                      <span>→</span>
                    </>
                  )}
                </button>

                <p style={{ textAlign: "center", color: "var(--text-dim, #71717A)", fontSize: "0.775rem", margin: 0, lineHeight: 1.4 }}>
                  🛡️ Sistem akan mencatat riwayat permohonan ke database audit dan menyiapkan pesan langsung ke WhatsApp Super Admin.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
