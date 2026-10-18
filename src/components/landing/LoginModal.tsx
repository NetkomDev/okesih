"use client";

import { useState, useEffect } from "react";

export default function LoginModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleOpen = () => setIsOpen(true);
      window.addEventListener("okesih:open-login", handleOpen);

      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      const shouldOpenLogin = err === "login_required" || err === "unauthorized" || window.location.hash === "#login";
      if (shouldOpenLogin) {
        queueMicrotask(() => {
          if (err === "unauthorized") {
            setLoginError("Akses Ditolak: Anda tidak memiliki izin untuk halaman tersebut.");
          }
          setIsOpen(true);
        });
      }

      const handleHashChange = () => {
        if (window.location.hash === "#login") setIsOpen(true);
      };
      window.addEventListener("hashchange", handleHashChange);

      return () => {
        window.removeEventListener("okesih:open-login", handleOpen);
        window.removeEventListener("hashchange", handleHashChange);
      };
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div
      className="login-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div className="login-modal-card" role="dialog" aria-modal="true">
        {/* Tombol Tutup ✕ */}
        <button
          type="button"
          className="login-close-btn"
          onClick={() => setIsOpen(false)}
          aria-label="Tutup Portal Login"
        >
          ✕
        </button>

        {/* Header Modal */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #FF5722, #FF4500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontSize: "26px",
              boxShadow: "0 6px 20px rgba(255, 69, 0, 0.4)",
            }}
          >
            🔐
          </div>
          <h3 style={{ fontSize: "1.45rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0" }}>
            Masuk ke OKESIH
          </h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: "0.45rem" }}>
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
            <input
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username atau email"
              style={{
                width: "100%",
                padding: "0.85rem 1rem",
                borderRadius: "12px",
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-surface-1)",
                color: "var(--text-pure-white)",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "var(--text-pure-white)",
                }}
              >
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--brand-orange-light)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "0",
                }}
              >
                {showPassword ? "Sembunyikan" : "Tampilkan"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "0.85rem 1rem",
                borderRadius: "12px",
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-surface-1)",
                color: "var(--text-pure-white)",
                fontSize: "0.95rem",
                outline: "none",
              }}
            />
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
    </div>
  );
}
