"use client";

import { useAuthGuard } from "@/lib/auth-helpers";
import SuperAdminDashboardPage from "../superadmin/page";

/**
 * Alias /admin hanya tersedia bagi Super Admin pada admin.okesih.com.
 */
export default function AdminDispatcherPage() {
  const { isAuthorized, loading } = useAuthGuard(["SUPERADMIN"]);

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
          Memastikan akses khusus Super Admin
        </div>
      </div>
    );
  }

  return <SuperAdminDashboardPage />;
}
