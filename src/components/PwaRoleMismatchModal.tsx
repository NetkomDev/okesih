"use client";

import Image from "next/image";
import { PwaRoleKind, PWA_ROLE_CONFIGS, getRoleDisplayName } from "@/lib/pwa-routing";
import { logoutUser } from "@/lib/auth-helpers";

interface PwaRoleMismatchModalProps {
  pwaKind: PwaRoleKind;
  userRole: string;
  isOpen: boolean;
  onClose?: () => void;
}

export default function PwaRoleMismatchModal({
  pwaKind,
  userRole,
  isOpen,
  onClose,
}: PwaRoleMismatchModalProps) {
  if (!isOpen) return null;

  const config = PWA_ROLE_CONFIGS[pwaKind];
  const targetName = config ? config.name : `PWA ${pwaKind.toUpperCase()}`;
  const userRoleName = getRoleDisplayName(userRole);
  const allowedNames = config
    ? config.allowedRoles.map((r) => getRoleDisplayName(r)).join(", ")
    : pwaKind;

  const handleLogout = async () => {
    if (onClose) onClose();
    await logoutUser();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        backgroundColor: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "pwaFadeIn 0.25s ease-out forwards",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#0d1117",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: "1.25rem",
          padding: "1.75rem 1.5rem",
          boxShadow: "0 25px 50px -12px rgba(239, 68, 68, 0.25), 0 0 0 1px rgba(255,255,255,0.05)",
          textAlign: "center",
          color: "#f3f4f6",
        }}
      >
        {/* Warning Icon Badge */}
        <div
          style={{
            width: "68px",
            height: "68px",
            margin: "0 auto 1.25rem",
            borderRadius: "50%",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "2px solid rgba(239, 68, 68, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ef4444",
          }}
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Header */}
        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "#ffffff",
            marginBottom: "0.5rem",
            letterSpacing: "-0.01em",
          }}
        >
          Akses Ditolak: Aplikasi Tidak Sesuai
        </h3>

        <p
          style={{
            fontSize: "0.875rem",
            color: "#9ca3af",
            lineHeight: 1.55,
            marginBottom: "1.25rem",
          }}
        >
          Aplikasi ini adalah <strong>{targetName}</strong> yang dikhususkan untuk peran <strong>{allowedNames}</strong>.
        </p>

        {/* Role Comparison Card */}
        <div
          style={{
            backgroundColor: "rgba(17, 24, 39, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "0.875rem",
            padding: "0.875rem 1rem",
            marginBottom: "1.25rem",
            textAlign: "left",
            fontSize: "0.825rem",
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
            <span style={{ color: "#9ca3af" }}>Peran Akun Anda:</span>
            <span style={{ color: "#f87171", fontWeight: 700 }}>{userRoleName}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#9ca3af" }}>Aplikasi Terbuka:</span>
            <span style={{ color: "#38bdf8", fontWeight: 700 }}>{targetName}</span>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "0.75rem",
            padding: "0.65rem 0.85rem",
            marginBottom: "1.5rem",
            fontSize: "0.78rem",
            color: "#fca5a5",
            lineHeight: 1.45,
          }}
        >
          Role Anda tidak memiliki kewenangan pada aplikasi ini. Sesi login telah dibatalkan demi keamanan.
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleLogout}
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.8rem 1.25rem",
            backgroundColor: "#ef4444",
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "0.9rem",
            borderRadius: "0.75rem",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 10px 20px -5px rgba(239, 68, 68, 0.4)",
            transition: "all 0.15s ease",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Keluar &amp; Coba Akun Lain</span>
        </button>
      </div>
    </div>
  );
}
