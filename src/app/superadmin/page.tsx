"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthGuard, logoutUser } from "@/lib/auth-helpers";

interface TenantWarkop {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  phone: string;
  uniqueCodeRange: string;
  todayTransactions: number;
  totalSaasBilling: number;
  paymentStatus: "PAID" | "UNPAID" | "GRACE_PERIOD";
  status: "ACTIVE" | "SUSPENDED";
  joinedDate: string;
}

export default function SuperAdminDashboardPage() {
  const { isAuthorized, loading, currentUser } = useAuthGuard(["SUPERADMIN"]);
  const [tenants, setTenants] = useState<TenantWarkop[]>([
    {
      id: "ten-01",
      name: "Warkop Giras Nusantara",
      slug: "giras-nusantara",
      ownerName: "Haji Rusdi",
      phone: "081234567890",
      uniqueCodeRange: "100 - 199",
      todayTransactions: 248,
      totalSaasBilling: 12400,
      paymentStatus: "PAID",
      status: "ACTIVE",
      joinedDate: "10 Okt 2026",
    },
    {
      id: "ten-02",
      name: "Warkop Barokah 24 Jam",
      slug: "barokah-24jam",
      ownerName: "Bambang Sutrisno",
      phone: "081987654321",
      uniqueCodeRange: "200 - 299",
      todayTransactions: 312,
      totalSaasBilling: 15600,
      paymentStatus: "GRACE_PERIOD",
      status: "ACTIVE",
      joinedDate: "05 Okt 2026",
    },
    {
      id: "ten-03",
      name: "Warkop Pojok Stadion",
      slug: "pojok-stadion",
      ownerName: "Dedi Supriyadi",
      phone: "082133445566",
      uniqueCodeRange: "300 - 399",
      todayTransactions: 195,
      totalSaasBilling: 9750,
      paymentStatus: "PAID",
      status: "ACTIVE",
      joinedDate: "01 Okt 2026",
    },
    {
      id: "ten-04",
      name: "Kedai Kopi Klotok Senja",
      slug: "klotok-senja",
      ownerName: "Rian Prasetyo",
      phone: "085611223344",
      uniqueCodeRange: "400 - 499",
      todayTransactions: 0,
      totalSaasBilling: 0,
      paymentStatus: "UNPAID",
      status: "SUSPENDED",
      joinedDate: "28 Sep 2026",
    },
  ]);

  // Global Config State
  const [globalDismissDuration, setGlobalDismissDuration] = useState<number>(60);
  const [saasFeePerReceipt, setSaasFeePerReceipt] = useState<number>(50);

  // Modal Daftarkan Tenant Baru
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [newWarkopName, setNewWarkopName] = useState<string>("");
  const [newSlug, setNewSlug] = useState<string>("");
  const [newOwnerName, setNewOwnerName] = useState<string>("");
  const [newPhone, setNewPhone] = useState<string>("");
  const [newCodeRange, setNewCodeRange] = useState<string>("500 - 599");
  const [generatedUsername, setGeneratedUsername] = useState<string>("");
  const [generatedPassword, setGeneratedPassword] = useState<string>("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleOpenRegisterModal = () => {
    const randomSuffix = Math.floor(Math.random() * 899) + 100;
    setNewWarkopName("");
    setNewSlug("");
    setNewOwnerName("");
    setNewPhone("");
    setGeneratedUsername(`owner_${randomSuffix}`);
    setGeneratedPassword(`okesih${randomSuffix}!`);
    setIsRegisterModalOpen(true);
  };

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarkopName || !newOwnerName) {
      alert("Harap isi Nama Warkop dan Nama Owner!");
      return;
    }

    const createdSlug = newSlug.trim() || newWarkopName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const newTenant: TenantWarkop = {
      id: `ten-${Date.now()}`,
      name: newWarkopName,
      slug: createdSlug,
      ownerName: newOwnerName,
      phone: newPhone || "0812xxxxxxx",
      uniqueCodeRange: newCodeRange,
      todayTransactions: 0,
      totalSaasBilling: 0,
      paymentStatus: "PAID",
      status: "ACTIVE",
      joinedDate: "Hari Ini",
    };

    setTenants((prev) => [newTenant, ...prev]);
    setIsRegisterModalOpen(false);

    alert(
      `✓ TENANT BARU BERHASIL DIDAFTARKAN!\n\n` +
      `Nama Warkop: ${newTenant.name}\n` +
      `Slug URL: /menu/${newTenant.slug}\n` +
      `Rentang Kode Unik: ${newTenant.uniqueCodeRange}\n\n` +
      `Kredensial Owner Baru (Bagikan ke Owner):\n` +
      `Username: ${generatedUsername}\n` +
      `Password: ${generatedPassword}`
    );
  };

  const toggleTenantStatus = (id: string) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } : t
      )
    );
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Global aggregate metrics
  const totalActiveTenants = tenants.filter((t) => t.status === "ACTIVE").length;
  const totalAllTransactions = tenants.reduce((sum, t) => sum + t.todayTransactions, 0);
  const totalSaasRevenue = tenants.reduce((sum, t) => sum + t.totalSaasBilling, 0);

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
        <div style={{ fontSize: "2.5rem" }}>🛡️</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#38BDF8" }}>
          Memverifikasi Otoritas Super Admin Pusat...
        </div>
        <div style={{ fontSize: "0.85rem", color: "#64748B" }}>
          Pemeriksaan token peran &amp; hak akses ekosistem OKESIH
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#06090E", color: "#F0F6FC" }}>
      {/* Super Admin Top Navigation */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2rem",
          borderBottom: "1px solid rgba(56, 189, 248, 0.2)",
          background: "linear-gradient(180deg, rgba(8, 20, 36, 0.95) 0%, rgba(6, 9, 14, 0.95) 100%)",
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "1.2rem",
              boxShadow: "0 0 15px rgba(14, 165, 233, 0.4)",
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
              OKESIH<span style={{ color: "#38BDF8" }}> HQ</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#7DD3FC", fontWeight: 700 }}>
              DASHBOARD SUPER ADMIN PUSAT (SAAS OPERATOR)
            </div>
          </div>
          <span
            style={{
              background: "rgba(14, 165, 233, 0.15)",
              border: "1px solid rgba(14, 165, 233, 0.4)",
              color: "#38BDF8",
              fontSize: "0.75rem",
              fontWeight: 800,
              padding: "0.25rem 0.65rem",
              borderRadius: "var(--radius-pill)",
            }}
          >
            ● Mode Pusat / Multi-Tenant
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {currentUser && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "#7DD3FC",
                background: "rgba(14, 165, 233, 0.1)",
                border: "1px solid rgba(14, 165, 233, 0.3)",
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                fontWeight: 700,
              }}
            >
              👤 {currentUser.email || "superadmin"}
            </span>
          )}

          <button
            onClick={handleOpenRegisterModal}
            className="btn-primary"
            style={{
              background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
              boxShadow: "0 4px 14px rgba(14, 165, 233, 0.35)",
              padding: "0.55rem 1.1rem",
              fontSize: "0.85rem",
              fontWeight: 800,
            }}
          >
            + Daftarkan Tenant Warkop
          </button>

          <button
            onClick={logoutUser}
            className="btn-secondary"
            style={{
              padding: "0.5rem 0.85rem",
              fontSize: "0.8rem",
              color: "#F87171",
              borderColor: "rgba(239, 68, 68, 0.4)",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Command Center Body */}
      <main style={{ maxWidth: "1280px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* SECTION 1: GLOBAL ECOSYSTEM RESUME (METRIK SELURUH TENANT) */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
                Resume Ekosistem Seluruh Tenant Warkop
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#94A3B8" }}>
                Monitoring performa seluruh klien warkop, volume transaksi, dan arus penerimaan SaaS OKESIH secara real-time.
              </p>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
              Diperbarui: {new Date().toLocaleTimeString("id-ID")}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Metric 1 */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(14, 165, 233, 0.25)",
                background: "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.35rem" }}>
                TOTAL TENANT WARKOP AKTIF
              </div>
              <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#38BDF8" }}>
                {totalActiveTenants} <span style={{ fontSize: "1rem", color: "#64748B" }}>/ {tenants.length} Warkop</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#34D399", marginTop: "0.4rem", fontWeight: 600 }}>
                ✓ {totalActiveTenants} Tenant beroperasi normal
              </div>
            </div>

            {/* Metric 2 */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.35rem" }}>
                TRANSAKSI SELURUH EKOSISTEM
              </div>
              <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#10B981" }}>
                {totalAllTransactions.toLocaleString("id-ID")}{" "}
                <span style={{ fontSize: "1rem", color: "#64748B" }}>Struk</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.4rem" }}>
                Dari seluruh pesanan meja &amp; kasir hari ini
              </div>
            </div>

            {/* Metric 3 */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.35rem" }}>
                PENDAPATAN SAAS PUSAT (@ Rp {saasFeePerReceipt})
              </div>
              <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#FBBF24" }}>
                Rp {totalSaasRevenue.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#FCD34D", marginTop: "0.4rem", fontWeight: 600 }}>
                Akumulasi tagihan sewa harian platform
              </div>
            </div>

            {/* Metric 4 */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(139, 92, 246, 0.25)",
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.35rem" }}>
                STATUS PENAGIHAN SEWA WARKOP
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#A78BFA", marginTop: "0.5rem" }}>
                2 Lunas • 1 Grace • 1 Pending
              </div>
              <div style={{ fontSize: "0.75rem", color: "#C4B5FD", marginTop: "0.6rem" }}>
                Validasi bukti setoran otomatis via OCR
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: TABEL MANAJEMEN SEMUA TENANT WARKOP */}
        <section
          className="glass-panel"
          style={{
            padding: "1.75rem",
            marginBottom: "2rem",
            border: "1px solid rgba(56, 189, 248, 0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Daftar Klien Tenant Warkop Terdaftar</h2>
              <div style={{ fontSize: "0.825rem", color: "#94A3B8" }}>
                Kelola status aktivasi, alokasi kode unik QRIS, dan akses akun owner.
              </div>
            </div>

            {/* Search Box */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama warkop, slug, atau owner..."
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  borderRadius: "8px",
                  padding: "0.55rem 1rem",
                  fontSize: "0.85rem",
                  color: "#FFF",
                  width: "280px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(56, 189, 248, 0.2)", color: "#7DD3FC", fontSize: "0.8rem", textTransform: "uppercase" }}>
                  <th style={{ padding: "0.85rem 1rem" }}>Tenant Warkop &amp; Slug</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Owner &amp; Kontak</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Rentang Kode Unik</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Transaksi Hari Ini</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Tagihan Sewa (@Rp 50)</th>
                  <th style={{ padding: "0.85rem 1rem" }}>Status Tenant</th>
                  <th style={{ padding: "0.85rem 1rem", textAlign: "right" }}>Aksi Pusat</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((t) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                      transition: "background 0.2s ease",
                    }}
                  >
                    {/* Warkop & Slug */}
                    <td style={{ padding: "1rem" }}>
                      <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#FFF" }}>{t.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#38BDF8", marginTop: "2px" }}>
                        🔗 /menu/{t.slug}
                      </div>
                    </td>

                    {/* Owner */}
                    <td style={{ padding: "1rem" }}>
                      <div style={{ fontWeight: 700, color: "#E2E8F0" }}>{t.ownerName}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{t.phone}</div>
                    </td>

                    {/* Unique Code Range */}
                    <td style={{ padding: "1rem" }}>
                      <span
                        style={{
                          background: "rgba(14, 165, 233, 0.1)",
                          border: "1px solid rgba(14, 165, 233, 0.3)",
                          color: "#38BDF8",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                          fontWeight: 800,
                          fontSize: "0.75rem",
                        }}
                      >
                        {t.uniqueCodeRange}
                      </span>
                    </td>

                    {/* Transaksi */}
                    <td style={{ padding: "1rem" }}>
                      <div style={{ fontWeight: 800 }}>{t.todayTransactions} Struk</div>
                      <div style={{ fontSize: "0.72rem", color: "#64748B" }}>Tergabung {t.joinedDate}</div>
                    </td>

                    {/* Tagihan Sewa */}
                    <td style={{ padding: "1rem" }}>
                      <div style={{ fontWeight: 900, color: "#FBBF24" }}>
                        Rp {t.totalSaasBilling.toLocaleString("id-ID")}
                      </div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: t.paymentStatus === "PAID" ? "#34D399" : t.paymentStatus === "GRACE_PERIOD" ? "#FBBF24" : "#F87171",
                        }}
                      >
                        {t.paymentStatus === "PAID" ? "● Lunas" : t.paymentStatus === "GRACE_PERIOD" ? "● Masa Tenggang" : "● Menunggak"}
                      </span>
                    </td>

                    {/* Status Tenant */}
                    <td style={{ padding: "1rem" }}>
                      {t.status === "ACTIVE" ? (
                        <span className="badge badge-ready">AKTIF</span>
                      ) : (
                        <span
                          style={{
                            background: "rgba(239, 68, 68, 0.2)",
                            border: "1px solid #EF4444",
                            color: "#FCA5A5",
                            padding: "0.25rem 0.6rem",
                            borderRadius: "var(--radius-pill)",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                          }}
                        >
                          DITANGGUHKAN
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <Link
                          href={`/menu/${t.slug}?table=01`}
                          target="_blank"
                          className="btn-secondary"
                          style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                        >
                          Cek QR Menu
                        </Link>
                        <button
                          onClick={() => toggleTenantStatus(t.id)}
                          style={{
                            background: t.status === "ACTIVE" ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            border: t.status === "ACTIVE" ? "1px solid #EF4444" : "1px solid #10B981",
                            color: t.status === "ACTIVE" ? "#FCA5A5" : "#34D399",
                            padding: "0.35rem 0.65rem",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          {t.status === "ACTIVE" ? "Suspend" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3: KONFIGURASI GLOBAL PUSAT & OCR AUDIT LOG */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "3rem" }}>
          {/* Card 1: Konfigurasi Parameter Antrean TV Pusat */}
          <div
            className="glass-panel"
            style={{
              padding: "1.75rem",
              border: "1px solid rgba(56, 189, 248, 0.2)",
            }}
          >
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38BDF8", marginBottom: "0.5rem" }}>
              ⏱️ Parameter Pusat: Auto-Dismiss Antrean TV
            </h3>
            <p style={{ fontSize: "0.825rem", color: "#94A3B8", marginBottom: "1.25rem", lineHeight: 1.5 }}>
              Konfigurasi master durasi berapa lama nomor antrean yang telah berstatus HIJAU (siap diantar) akan bertahan di seluruh Smart TV sebelum otomatis menghilang.
            </p>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
              {[30, 45, 60, 90, 120].map((sec) => (
                <button
                  key={sec}
                  onClick={() => setGlobalDismissDuration(sec)}
                  style={{
                    padding: "0.5rem 0.85rem",
                    borderRadius: "6px",
                    fontWeight: 800,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    background: globalDismissDuration === sec ? "#0EA5E9" : "rgba(15, 23, 42, 0.6)",
                    color: globalDismissDuration === sec ? "#FFF" : "#94A3B8",
                    border: globalDismissDuration === sec ? "1px solid #38BDF8" : "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  {sec} Detik
                </button>
              ))}
            </div>

            <div style={{ fontSize: "0.75rem", color: "#34D399", fontWeight: 600 }}>
              ✓ Durasi aktif saat ini: {globalDismissDuration} detik (Berlaku untuk seluruh warkop)
            </div>
          </div>

          {/* Card 2: Pengaturan Biaya Sewa SaaS Pokok */}
          <div
            className="glass-panel"
            style={{
              padding: "1.75rem",
              border: "1px solid rgba(56, 189, 248, 0.2)",
            }}
          >
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#FBBF24", marginBottom: "0.5rem" }}>
              💰 Tarif Sewa Pokok Platform SaaS
            </h3>
            <p style={{ fontSize: "0.825rem", color: "#94A3B8", marginBottom: "1rem", lineHeight: 1.5 }}>
              Tarif sewa per-struk transaksi yang ditagihkan harian saat warkop tutup toko.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#94A3B8" }}>Rp</span>
              <input
                type="number"
                value={saasFeePerReceipt}
                onChange={(e) => setSaasFeePerReceipt(parseInt(e.target.value) || 50)}
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  fontSize: "1.1rem",
                  fontWeight: 900,
                  color: "#FBBF24",
                  width: "120px",
                }}
              />
              <span style={{ fontSize: "0.85rem", color: "#94A3B8" }}>/ struk tercetak</span>
            </div>

            <div style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
              Setiap penutupan shift warkop otomatis menambahkan kode unik permanen untuk rekonsiliasi transfer bank.
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: DAFTARKAN TENANT / OWNER WARKOP BARU */}
      {isRegisterModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "560px",
              width: "100%",
              padding: "2rem",
              background: "#090E17",
              border: "2px solid #0EA5E9",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#38BDF8" }}>
                  Daftarkan Tenant Warkop Baru
                </h2>
                <div style={{ fontSize: "0.8rem", color: "#94A3B8" }}>
                  Mendaftarkan warkop ke ekosistem OKESIH &amp; buat akun owner langsung
                </div>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="btn-secondary"
                style={{ width: "32px", height: "32px", padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTenant} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                  Nama Warkop (Contoh: Warkop Nusantara Jaya)
                </label>
                <input
                  type="text"
                  required
                  value={newWarkopName}
                  onChange={(e) => {
                    setNewWarkopName(e.target.value);
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                  }}
                  placeholder="Ketik nama warkop..."
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#FFF",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                    Slug URL Katalog Menu
                  </label>
                  <input
                    type="text"
                    required
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="nusantara-jaya"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#38BDF8",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                    Alokasi Kode Unik Permanen
                  </label>
                  <input
                    type="text"
                    value={newCodeRange}
                    onChange={(e) => setNewCodeRange(e.target.value)}
                    placeholder="500 - 599"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#FFF",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                    Nama Pemilik / Owner Warkop
                  </label>
                  <input
                    type="text"
                    required
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="Nama Lengkap Owner..."
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#FFF",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                    Nomor WhatsApp
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="081234567890"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      color: "#FFF",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Box Kredensial Owner Otomatis (No OTP / Email) */}
              <div
                style={{
                  background: "rgba(14, 165, 233, 0.1)",
                  border: "1px dashed rgba(14, 165, 233, 0.4)",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginTop: "0.5rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#7DD3FC", marginBottom: "0.5rem" }}>
                  🔑 Kredensial Login Owner yang Di-generate Sistem:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                  <div>
                    <span style={{ color: "#94A3B8" }}>Username: </span>
                    <strong style={{ color: "#FFF" }}>{generatedUsername}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#94A3B8" }}>Password: </span>
                    <strong style={{ color: "#38BDF8" }}>{generatedPassword}</strong>
                  </div>
                </div>
                <div style={{ fontSize: "0.7rem", color: "#94A3B8", marginTop: "0.5rem" }}>
                  *Owner dapat langsung login menggunakan kredensial ini tanpa verifikasi email ataupun OTP.
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "0.9rem",
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                  marginTop: "0.5rem",
                }}
              >
                ✓ DAFTARKAN TENANT &amp; SIMPAN
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
