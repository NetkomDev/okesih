"use client";

import { useState } from "react";
import { PwaRoleKind, PWA_ROLE_CONFIGS } from "@/lib/pwa-routing";
import { logoutUserTo } from "@/lib/auth-helpers";

interface PwaRoleMismatchModalProps {
  pwaKind: PwaRoleKind;
  isOpen: boolean;
}

export default function PwaRoleMismatchModal({
  pwaKind,
  isOpen,
}: PwaRoleMismatchModalProps) {
  const [returning, setReturning] = useState(false);

  if (!isOpen) return null;

  const targetName = PWA_ROLE_CONFIGS[pwaKind]?.name || "aplikasi ini";

  const handleBack = async () => {
    setReturning(true);
    await logoutUserTo(`/login?from_pwa=${encodeURIComponent(pwaKind)}`);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="access-denied-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "grid",
        placeItems: "center",
        padding: "1.25rem",
        background: "rgba(3, 7, 18, 0.88)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          width: "min(360px, 100%)",
          padding: "1.5rem",
          border: "1px solid rgba(239, 68, 68, 0.35)",
          borderRadius: "1.25rem",
          background: "#0d1117",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.45)",
          color: "#f8fafc",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            width: 58,
            height: 58,
            margin: "0 auto 1rem",
            borderRadius: "50%",
            border: "2px solid rgba(239, 68, 68, 0.45)",
            background: "rgba(239, 68, 68, 0.14)",
            color: "#f87171",
            fontSize: "1.75rem",
            fontWeight: 800,
          }}
        >
          !
        </div>

        <h2 id="access-denied-title" style={{ margin: 0, fontSize: "1.35rem", fontWeight: 850 }}>
          Akses Ditolak
        </h2>
        <p style={{ margin: "0.65rem 0 1.35rem", color: "#cbd5e1", fontSize: "0.9rem", lineHeight: 1.55 }}>
          Akun ini tidak dapat mengakses {targetName}.
        </p>

        <button
          type="button"
          onClick={handleBack}
          disabled={returning}
          style={{
            width: "100%",
            minHeight: 46,
            border: 0,
            borderRadius: "0.75rem",
            background: "#f4512c",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 800,
            cursor: returning ? "wait" : "pointer",
            opacity: returning ? 0.7 : 1,
          }}
        >
          {returning ? "Kembali..." : "Kembali"}
        </button>
      </div>
    </div>
  );
}
