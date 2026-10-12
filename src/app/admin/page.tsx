"use client";

import { useAuthGuard } from "@/lib/auth-helpers";
import SuperAdminDashboardPage from "../superadmin/page";
import TenantOwnerDashboardPage from "../owner/page";

/**
 * Halaman /admin mendeteksi peran (role) dari akun yang sedang login secara aman:
 * - Jika akun yang login adalah SUPERADMIN -> menampilkan Dashboard Super Admin Pusat
 * - Jika akun yang login adalah OWNER -> menampilkan Dashboard Owner Tenant
 * - Tanpa pintasan manual untuk berpindah peran demi menutup celah keamanan.
 */
export default function AdminDispatcherPage() {
  const { isAuthorized, loading, currentRole } = useAuthGuard(["SUPERADMIN", "OWNER"]);

  if (loading || !isAuthorized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#06090E",
          color: "#F0F6FC",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "2.5rem" }}>🔐</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#38BDF8" }}>
          Memverifikasi Peran Akun Pengguna...
        </div>
        <div style={{ fontSize: "0.85rem", color: "#64748B" }}>
          Mengarahkan otomatis ke dashboard yang diizinkan (Super Admin atau Tenant Owner)
        </div>
      </div>
    );
  }

  // Jika akun login adalah Super Admin
  if (currentRole === "SUPERADMIN") {
    return <SuperAdminDashboardPage />;
  }

  // Jika akun login adalah Owner Tenant
  return <TenantOwnerDashboardPage />;
}
