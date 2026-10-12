"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SuperAdminDashboardPage from "../superadmin/page";
import TenantOwnerDashboardPage from "../owner/page";
import { createClient } from "@/lib/supabase/client";

export default function AdminHubPage() {
  const [activeTab, setActiveTab] = useState<"superadmin" | "owner">("superadmin");
  const [currentUser, setCurrentUser] = useState<string>("");

  useEffect(() => {
    // Cek session login untuk otomatis memilih tab default yang sesuai
    const checkUser = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          const email = data.user.email || "";
          setCurrentUser(email);
          if (email.startsWith("owner")) {
            setActiveTab("owner");
          } else if (email.startsWith("superadmin")) {
            setActiveTab("superadmin");
          }
        }
      } catch {
        // Fallback default
      }
    };
    checkUser();
  }, []);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#06090E" }}>
      {/* Top Banner Pemilih Dashboard (Super Admin vs Tenant Owner) */}
      <div
        style={{
          background: "linear-gradient(90deg, #0B132B 0%, #1C2541 50%, #1F1D2B 100%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          padding: "0.65rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#94A3B8",
            }}
          >
            PILIH MODE DASHBOARD:
          </span>

          <div
            style={{
              display: "flex",
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              padding: "3px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            {/* Tab 1: Super Admin Pusat */}
            <button
              onClick={() => setActiveTab("superadmin")}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 800,
                cursor: "pointer",
                transition: "all 0.2s ease",
                background:
                  activeTab === "superadmin"
                    ? "linear-gradient(135deg, #0EA5E9, #0284C7)"
                    : "transparent",
                color: activeTab === "superadmin" ? "#FFF" : "#94A3B8",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                boxShadow:
                  activeTab === "superadmin"
                    ? "0 2px 10px rgba(14, 165, 233, 0.4)"
                    : "none",
              }}
            >
              <span>🛡️</span>
              <span>Super Admin Pusat (HQ)</span>
            </button>

            {/* Tab 2: Tenant / Owner Warkop */}
            <button
              onClick={() => setActiveTab("owner")}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: "6px",
                fontSize: "0.8rem",
                fontWeight: 800,
                cursor: "pointer",
                transition: "all 0.2s ease",
                background:
                  activeTab === "owner"
                    ? "linear-gradient(135deg, #FF5722, #FF4500)"
                    : "transparent",
                color: activeTab === "owner" ? "#FFF" : "#94A3B8",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                boxShadow:
                  activeTab === "owner"
                    ? "0 2px 10px rgba(255, 69, 0, 0.4)"
                    : "none",
              }}
            >
              <span>☕</span>
              <span>Owner Warkop (Tenant)</span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.78rem" }}>
          <div style={{ color: "#94A3B8" }}>
            Direct Link:{" "}
            <Link
              href="/superadmin"
              style={{
                color: "#38BDF8",
                fontWeight: 700,
                textDecoration: "underline",
                marginRight: "0.5rem",
              }}
            >
              /superadmin
            </Link>
            |
            <Link
              href="/owner"
              style={{
                color: "var(--brand-orange-light)",
                fontWeight: 700,
                textDecoration: "underline",
                marginLeft: "0.5rem",
              }}
            >
              /owner
            </Link>
          </div>

          {currentUser && (
            <span
              style={{
                background: "rgba(255, 255, 255, 0.08)",
                padding: "0.25rem 0.6rem",
                borderRadius: "4px",
                color: "#E2E8F0",
                fontSize: "0.75rem",
              }}
            >
              👤 {currentUser}
            </span>
          )}

          <Link
            href="/"
            style={{
              color: "#EF4444",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Keluar
          </Link>
        </div>
      </div>

      {/* Render Dashboard Sesuai Pilihan */}
      {activeTab === "superadmin" ? (
        <SuperAdminDashboardPage />
      ) : (
        <TenantOwnerDashboardPage />
      )}
    </div>
  );
}
