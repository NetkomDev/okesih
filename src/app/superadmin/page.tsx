"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuthGuard, logoutUser } from "@/lib/auth-helpers";

interface MarketingAgent {
  id: string;
  name: string;
  phone: string;
  email?: string;
  area: string;
  referralCode: string;
  commissionPerReceipt: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  totalTenantsAcquired: number;
  totalReceiptsGenerated: number;
  totalCommissionEarned: number;
  commissionPaid: number;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  experienceNotes?: string;
}

interface TenantWarkop {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  phone: string;
  uniqueCodeRange: string;
  marketingAgentId?: string;
  marketingAgentName?: string;
  commissionPerReceipt: number;
  todayTransactions: number;
  totalSaasBilling: number;
  paymentStatus: "PAID" | "UNPAID" | "GRACE_PERIOD";
  status: "ACTIVE" | "SUSPENDED";
  joinedDate: string;
}

export default function SuperAdminDashboardPage() {
  const { isAuthorized, loading, currentUser } = useAuthGuard(["SUPERADMIN"]);

  // Active Tab View di Super Admin
  const [activeTab, setActiveTab] = useState<"tenants" | "marketing" | "qris_billing" | "platform_config">("tenants");

  // State Marketing Lapangan
  const [marketingList, setMarketingList] = useState<MarketingAgent[]>([
    {
      id: "mkt-01",
      name: "Hendra Pratama",
      phone: "081234889900",
      area: "Jakarta Selatan & Depok",
      referralCode: "MKT-JAKSEL",
      commissionPerReceipt: 15,
      bankName: "BCA",
      accountNumber: "8829102931",
      accountName: "Hendra Pratama",
      totalTenantsAcquired: 2,
      totalReceiptsGenerated: 560,
      totalCommissionEarned: 8400,
      commissionPaid: 5000,
      status: "ACTIVE",
    },
    {
      id: "mkt-02",
      name: "Bambang Irawan",
      phone: "085611223344",
      area: "Surabaya & Sidoarjo",
      referralCode: "MKT-JATIM01",
      commissionPerReceipt: 15,
      bankName: "Mandiri",
      accountNumber: "142001928374",
      accountName: "Bambang Irawan",
      totalTenantsAcquired: 1,
      totalReceiptsGenerated: 195,
      totalCommissionEarned: 2925,
      commissionPaid: 0,
      status: "ACTIVE",
    },
  ]);

  // Marketing Filter & Search State
  const [marketingFilterStatus, setMarketingFilterStatus] = useState<"ALL" | "PENDING" | "ACTIVE" | "INACTIVE">("ALL");
  const [marketingSearchQuery, setMarketingSearchQuery] = useState<string>("");

  const loadMarketingPartners = async () => {
    try {
      const res = await fetch("/api/superadmin/marketing");
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        interface RawMarketingPartner {
          id: string;
          full_name: string;
          phone: string;
          email?: string;
          city_area: string;
          referral_code: string;
          commission_rate: number;
          bank_name: string;
          bank_account_number: string;
          bank_account_name: string;
          total_tenants_acquired?: number;
          total_receipts_generated?: number;
          total_commission_earned?: number;
          commission_paid?: number;
          status: "ACTIVE" | "PENDING" | "INACTIVE";
          experience_notes?: string;
        }
        const mapped: MarketingAgent[] = json.data.map((row: RawMarketingPartner) => ({
          id: row.id,
          name: row.full_name,
          phone: row.phone,
          email: row.email,
          area: row.city_area,
          referralCode: row.referral_code,
          commissionPerReceipt: Number(row.commission_rate) || 15,
          bankName: row.bank_name,
          accountNumber: row.bank_account_number,
          accountName: row.bank_account_name,
          totalTenantsAcquired: row.total_tenants_acquired || 0,
          totalReceiptsGenerated: row.total_receipts_generated || 0,
          totalCommissionEarned: Number(row.total_commission_earned) || 0,
          commissionPaid: Number(row.commission_paid) || 0,
          status: row.status,
          experienceNotes: row.experience_notes,
        }));
        setMarketingList(mapped);
      }
    } catch (e) {
      console.error("Gagal memuat marketing partners:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "marketing") {
      loadMarketingPartners();
    }
  }, [activeTab]);

  const handleUpdateMarketingStatus = async (id: string, newStatus: "ACTIVE" | "INACTIVE") => {
    try {
      const res = await fetch("/api/superadmin/marketing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setMarketingList((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
        );
        alert(`✓ Status Marketing berhasil diubah menjadi ${newStatus}!`);
      } else {
        alert("Gagal mengubah status di server.");
      }
    } catch {
      alert("Terjadi kesalahan jaringan.");
    }
  };

  // State Tenant Warkop
  const [tenants, setTenants] = useState<TenantWarkop[]>([
    {
      id: "ten-01",
      name: "Warkop Giras Nusantara",
      slug: "giras-nusantara",
      ownerName: "Haji Rusdi",
      phone: "081234567890",
      uniqueCodeRange: "100 - 199",
      marketingAgentId: "mkt-01",
      marketingAgentName: "Hendra Pratama",
      commissionPerReceipt: 15,
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
      marketingAgentId: "mkt-01",
      marketingAgentName: "Hendra Pratama",
      commissionPerReceipt: 15,
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
      marketingAgentId: "mkt-02",
      marketingAgentName: "Bambang Irawan",
      commissionPerReceipt: 15,
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
      marketingAgentId: "direct",
      marketingAgentName: "Direct HQ (Tanpa Marketing)",
      commissionPerReceipt: 0,
      todayTransactions: 0,
      totalSaasBilling: 0,
      paymentStatus: "UNPAID",
      status: "SUSPENDED",
      joinedDate: "28 Sep 2026",
    },
  ]);

  // Master Platform Settings (SaaS HQ)
  const [globalDismissDuration, setGlobalDismissDuration] = useState<number>(60);
  const [saasFeePerReceipt, setSaasFeePerReceipt] = useState<number>(50);
  const [defaultCommissionRate, setDefaultCommissionRate] = useState<number>(15);

  // State QRIS Pembayaran SaaS Platform (Pusat)
  const [centralQrisMerchant, setCentralQrisMerchant] = useState<string>("OKESIH SAAS PUSAT (BANK CENTRAL ASIA)");
  const [centralBankName, setCentralBankName] = useState<string>("BCA");
  const [centralBankAccountNumber, setCentralBankAccountNumber] = useState<string>("8001928374");
  const [centralBankAccountName, setCentralBankAccountName] = useState<string>("PT OKESIH KARYA DIGITAL");

  // Modal: Daftarkan Tenant Baru
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [newWarkopName, setNewWarkopName] = useState<string>("");
  const [newSlug, setNewSlug] = useState<string>("");
  const [newOwnerName, setNewOwnerName] = useState<string>("");
  const [newPhone, setNewPhone] = useState<string>("");
  const [newCodeRange, setNewCodeRange] = useState<string>("500 - 599");
  const [selectedMarketingId, setSelectedMarketingId] = useState<string>("mkt-01");
  const [tenantCommissionRate, setTenantCommissionRate] = useState<number>(15);
  const [generatedUsername, setGeneratedUsername] = useState<string>("");
  const [generatedPassword, setGeneratedPassword] = useState<string>("");

  // Modal: Daftarkan Marketing Lapangan Baru
  const [isMarketingModalOpen, setIsMarketingModalOpen] = useState<boolean>(false);
  const [newMarketingName, setNewMarketingName] = useState<string>("");
  const [newMarketingPhone, setNewMarketingPhone] = useState<string>("");
  const [newMarketingArea, setNewMarketingArea] = useState<string>("");
  const [newMarketingCode, setNewMarketingCode] = useState<string>("");
  const [newMarketingBank, setNewMarketingBank] = useState<string>("BCA");
  const [newMarketingAccountNo, setNewMarketingAccountNo] = useState<string>("");
  const [newMarketingAccountName, setNewMarketingAccountName] = useState<string>("");
  const [newMarketingCommRate, setNewMarketingCommRate] = useState<number>(15);

  // Search Query
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Buka Modal Registrasi Tenant
  const handleOpenRegisterModal = () => {
    const randomSuffix = Math.floor(Math.random() * 899) + 100;
    setNewWarkopName("");
    setNewSlug("");
    setNewOwnerName("");
    setNewPhone("");
    setNewCodeRange(`${(tenants.length + 1) * 100} - ${(tenants.length + 1) * 100 + 99}`);
    setTenantCommissionRate(defaultCommissionRate);
    setGeneratedUsername(`owner_${randomSuffix}`);
    setGeneratedPassword(`okesih${randomSuffix}!`);
    setIsRegisterModalOpen(true);
  };

  // Simpan Tenant Baru
  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarkopName || !newOwnerName) {
      alert("Harap isi Nama Warkop dan Nama Owner!");
      return;
    }

    const assignedMarketer = marketingList.find((m) => m.id === selectedMarketingId);
    const createdSlug = newSlug.trim() || newWarkopName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const newTenant: TenantWarkop = {
      id: `ten-${Date.now()}`,
      name: newWarkopName,
      slug: createdSlug,
      ownerName: newOwnerName,
      phone: newPhone || "0812xxxxxxx",
      uniqueCodeRange: newCodeRange,
      marketingAgentId: selectedMarketingId,
      marketingAgentName: assignedMarketer ? assignedMarketer.name : "Direct HQ",
      commissionPerReceipt: selectedMarketingId === "direct" ? 0 : tenantCommissionRate,
      todayTransactions: 0,
      totalSaasBilling: 0,
      paymentStatus: "PAID",
      status: "ACTIVE",
      joinedDate: "Hari Ini",
    };

    setTenants((prev) => [newTenant, ...prev]);

    // Update counter marketing jika ada
    if (assignedMarketer) {
      setMarketingList((prev) =>
        prev.map((m) =>
          m.id === assignedMarketer.id ? { ...m, totalTenantsAcquired: m.totalTenantsAcquired + 1 } : m
        )
      );
    }

    setIsRegisterModalOpen(false);

    alert(
      `✓ TENANT BARU BERHASIL DIDAFTARKAN!\n\n` +
      `Nama Warkop: ${newTenant.name}\n` +
      `Slug URL: /menu/${newTenant.slug}\n` +
      `Rentang Kode Unik: ${newTenant.uniqueCodeRange}\n` +
      `Marketing Pengakuisisi: ${newTenant.marketingAgentName}\n` +
      `Bagi Hasil Komisi: Rp ${newTenant.commissionPerReceipt} / struk\n\n` +
      `Kredensial Owner Baru (Bagikan ke Owner):\n` +
      `Username: ${generatedUsername}\n` +
      `Password: ${generatedPassword}`
    );
  };

  // Simpan Marketing Lapangan Baru
  const handleCreateMarketing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketingName || !newMarketingCode) {
      alert("Harap isi Nama Marketing dan Kode Referral!");
      return;
    }

    const newMkt: MarketingAgent = {
      id: `mkt-${Date.now()}`,
      name: newMarketingName,
      phone: newMarketingPhone || "-",
      area: newMarketingArea || "Nasional",
      referralCode: newMarketingCode.toUpperCase().trim(),
      commissionPerReceipt: newMarketingCommRate || 15,
      bankName: newMarketingBank,
      accountNumber: newMarketingAccountNo || "-",
      accountName: newMarketingAccountName || newMarketingName,
      totalTenantsAcquired: 0,
      totalReceiptsGenerated: 0,
      totalCommissionEarned: 0,
      commissionPaid: 0,
      status: "ACTIVE",
    };

    setMarketingList((prev) => [newMkt, ...prev]);
    setIsMarketingModalOpen(false);
    alert(`✓ Marketing Lapangan "${newMkt.name}" (${newMkt.referralCode}) berhasil didaftarkan ke ekosistem OKESIH!`);
  };

  const toggleTenantStatus = (id: string) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" } : t
      )
    );
  };

  // Filter Tenant
  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ownerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Global Financial Metrics
  const totalActiveTenants = tenants.filter((t) => t.status === "ACTIVE").length;
  const totalAllTransactions = tenants.reduce((sum, t) => sum + t.todayTransactions, 0);
  const totalGrossSaasBilling = tenants.reduce((sum, t) => sum + t.totalSaasBilling, 0);

  // Total Komisi Marketing yang dialokasikan dari transaksi hari ini
  const totalMarketingCommission = tenants.reduce(
    (sum, t) => sum + t.todayTransactions * t.commissionPerReceipt,
    0
  );

  // Net Revenue Platform SaaS Pusat (Gross - Komisi Marketing)
  const netPlatformRevenue = totalGrossSaasBilling - totalMarketingCommission;

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
          <img
            src="/logo.svg"
            alt="Logo OKESIH.COM"
            width={46}
            height={46}
            style={{ width: "46px", height: "46px", objectFit: "contain", display: "block", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
              OKESIH<span style={{ color: "#38BDF8" }}> HQ</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#7DD3FC", fontWeight: 700 }}>
              SUPER ADMIN SAAS COMMAND CENTER
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
            ● Mode Pusat / Multi-Tenant SaaS
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
            onClick={() => {
              const codeSuffix = Math.floor(Math.random() * 89) + 10;
              setNewMarketingName("");
              setNewMarketingPhone("");
              setNewMarketingArea("");
              setNewMarketingCode(`MKT-${codeSuffix}`);
              setNewMarketingAccountNo("");
              setNewMarketingCommRate(defaultCommissionRate);
              setIsMarketingModalOpen(true);
            }}
            className="btn-primary"
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
              padding: "0.55rem 1.1rem",
              fontSize: "0.85rem",
              fontWeight: 800,
            }}
          >
            + Daftarkan Marketing
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

      {/* Main Container */}
      <main style={{ maxWidth: "1320px", margin: "1.5rem auto 3rem", padding: "0 1.5rem" }}>
        {/* RESUME FINANSIAL & EKOSISTEM SAAS GLOBAL */}
        <section style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
                Resume Ekosistem Platform SaaS OKESIH
              </h1>
              <p style={{ fontSize: "0.85rem", color: "#94A3B8" }}>
                Monitoring performa seluruh tenant warkop, bagi hasil komisi marketing lapangan, dan net revenue platform.
              </p>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
              Sinkronisasi: {new Date().toLocaleTimeString("id-ID")}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Card 1: Total Tenant Aktif */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(14, 165, 233, 0.25)",
                background: "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.35rem" }}>
                TOTAL TENANT WARKOP
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "#38BDF8" }}>
                {totalActiveTenants} <span style={{ fontSize: "0.95rem", color: "#64748B" }}>/ {tenants.length} Warkop</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#34D399", marginTop: "0.4rem", fontWeight: 600 }}>
                ✓ {totalActiveTenants} Tenant beroperasi aktif
              </div>
            </div>

            {/* Card 2: Total Struk Ekosistem */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.35rem" }}>
                TOTAL STRUK TRANSAKSI HARI INI
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "#10B981" }}>
                {totalAllTransactions.toLocaleString("id-ID")}{" "}
                <span style={{ fontSize: "0.95rem", color: "#64748B" }}>Struk</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", marginTop: "0.4rem" }}>
                Dari seluruh pesanan meja &amp; kasir
              </div>
            </div>

            {/* Card 3: Gross Billing Platform */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                background: "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.35rem" }}>
                GROSS BILLING SAAS (@ Rp {saasFeePerReceipt})
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "#FBBF24" }}>
                Rp {totalGrossSaasBilling.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#FCD34D", marginTop: "0.4rem", fontWeight: 600 }}>
                Total tagihan sewa harian platform
              </div>
            </div>

            {/* Card 4: Bagi Hasil Komisi Marketing */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                background: "linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.35rem" }}>
                BAGI HASIL MARKETING LAPANGAN
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "#C084FC" }}>
                Rp {totalMarketingCommission.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#E9D5FF", marginTop: "0.4rem" }}>
                Komisi dari {marketingList.length} mitra sales lapangan
              </div>
            </div>

            {/* Card 5: Net Revenue Platform */}
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(14, 165, 233, 0.4)",
                background: "linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(6, 9, 14, 0.7) 100%)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#38BDF8", fontWeight: 700, marginBottom: "0.35rem" }}>
                NET PENDAPATAN OKESIH HQ
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "#FFF" }}>
                Rp {netPlatformRevenue.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#7DD3FC", marginTop: "0.4rem", fontWeight: 700 }}>
                Gross dikurangi komisi marketing
              </div>
            </div>
          </div>
        </section>

        {/* TAB NAVIGATION VIEW */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            marginBottom: "1.75rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            paddingBottom: "0.75rem",
            overflowX: "auto",
          }}
        >
          <button
            onClick={() => setActiveTab("tenants")}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              background: activeTab === "tenants" ? "rgba(14, 165, 233, 0.2)" : "transparent",
              color: activeTab === "tenants" ? "#38BDF8" : "#94A3B8",
              border: activeTab === "tenants" ? "1px solid #0EA5E9" : "1px solid transparent",
            }}
          >
            🏢 Daftar Tenant &amp; Kode Unik ({tenants.length})
          </button>

          <button
            onClick={() => setActiveTab("marketing")}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              background: activeTab === "marketing" ? "rgba(16, 185, 129, 0.2)" : "transparent",
              color: activeTab === "marketing" ? "#34D399" : "#94A3B8",
              border: activeTab === "marketing" ? "1px solid #10B981" : "1px solid transparent",
            }}
          >
            🤝 Marketing Lapangan &amp; Bagi Hasil ({marketingList.length})
          </button>

          <button
            onClick={() => setActiveTab("qris_billing")}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              background: activeTab === "qris_billing" ? "rgba(245, 158, 11, 0.2)" : "transparent",
              color: activeTab === "qris_billing" ? "#FBBF24" : "#94A3B8",
              border: activeTab === "qris_billing" ? "1px solid #F59E0B" : "1px solid transparent",
            }}
          >
            💳 QRIS Pembayaran SaaS Platform
          </button>

          <button
            onClick={() => setActiveTab("platform_config")}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "8px",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              background: activeTab === "platform_config" ? "rgba(168, 85, 247, 0.2)" : "transparent",
              color: activeTab === "platform_config" ? "#C084FC" : "#94A3B8",
              border: activeTab === "platform_config" ? "1px solid #A855F7" : "1px solid transparent",
            }}
          >
            ⚙️ Parameter Master Global
          </button>
        </div>

        {/* TAB CONTENT 1: DAFTAR TENANT WARKOP & ALOKASI KODE UNIK */}
        {activeTab === "tenants" && (
          <section
            className="glass-panel"
            style={{
              padding: "1.75rem",
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
                  Kelola status aktivasi, penetapan rentang kode unik pembayaran, serta asosiasi marketing lapangan.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari warkop, slug, owner..."
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
                <button
                  onClick={handleOpenRegisterModal}
                  className="btn-primary"
                  style={{
                    background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                    padding: "0.55rem 1rem",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                  }}
                >
                  + Daftarkan Tenant
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(56, 189, 248, 0.2)", color: "#7DD3FC", fontSize: "0.75rem", textTransform: "uppercase" }}>
                    <th style={{ padding: "0.85rem 1rem" }}>Tenant Warkop &amp; Slug</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Owner &amp; Kontak</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Rentang Kode Unik</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Marketing Akuisisi</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Komisi Sales</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Struk Hari Ini</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Tagihan Sewa</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Status</th>
                    <th style={{ padding: "0.85rem 1rem", textAlign: "right" }}>Aksi Pusat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ fontWeight: 800, color: "#FFF" }}>{t.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#38BDF8", marginTop: "2px" }}>
                          🔗 /menu/{t.slug}
                        </div>
                      </td>

                      <td style={{ padding: "1rem" }}>
                        <div style={{ fontWeight: 700, color: "#E2E8F0" }}>{t.ownerName}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748B" }}>{t.phone}</div>
                      </td>

                      <td style={{ padding: "1rem" }}>
                        <span
                          style={{
                            background: "rgba(14, 165, 233, 0.1)",
                            border: "1px solid rgba(14, 165, 233, 0.3)",
                            color: "#38BDF8",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "4px",
                            fontWeight: 800,
                            fontSize: "0.75rem",
                          }}
                        >
                          {t.uniqueCodeRange}
                        </span>
                      </td>

                      <td style={{ padding: "1rem" }}>
                        <div style={{ fontWeight: 700, color: "#34D399" }}>
                          {t.marketingAgentName || "Direct HQ"}
                        </div>
                      </td>

                      <td style={{ padding: "1rem" }}>
                        <span style={{ color: "#C084FC", fontWeight: 800 }}>
                          Rp {t.commissionPerReceipt} / struk
                        </span>
                      </td>

                      <td style={{ padding: "1rem" }}>
                        <div style={{ fontWeight: 800 }}>{t.todayTransactions} Struk</div>
                      </td>

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
                          {t.paymentStatus === "PAID" ? "● Lunas" : t.paymentStatus === "GRACE_PERIOD" ? "● Grace Period" : "● Menunggak"}
                        </span>
                      </td>

                      <td style={{ padding: "1rem" }}>
                        {t.status === "ACTIVE" ? (
                          <span className="badge badge-ready">AKTIF</span>
                        ) : (
                          <span style={{ background: "rgba(239, 68, 68, 0.2)", border: "1px solid #EF4444", color: "#FCA5A5", padding: "0.25rem 0.6rem", borderRadius: "var(--radius-pill)", fontSize: "0.75rem", fontWeight: 800 }}>
                            SUSPEND
                          </span>
                        )}
                      </td>

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
        )}

        {/* TAB CONTENT 2: MARKETING LAPANGAN & BAGI HASIL KOMISI */}
        {activeTab === "marketing" && (
          <section
            className="glass-panel"
            style={{
              padding: "1.75rem",
              border: "1px solid rgba(16, 185, 129, 0.2)",
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
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Manajemen Marketing Lapangan &amp; Bagi Hasil Komisi</h2>
                <div style={{ fontSize: "0.825rem", color: "#94A3B8" }}>
                  Kelola pendaftar mitra marketing dari landing page, setujui aktivasi per wilayah, dan tetapkan komisi bagi hasil per struk transaksi.
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={loadMarketingPartners}
                  className="btn-secondary"
                  style={{ padding: "0.55rem 0.95rem", fontSize: "0.85rem", fontWeight: 700 }}
                >
                  🔄 Refresh Data
                </button>

                <button
                  onClick={() => {
                    const codeSuffix = Math.floor(Math.random() * 89) + 10;
                    setNewMarketingName("");
                    setNewMarketingPhone("");
                    setNewMarketingArea("");
                    setNewMarketingCode(`MKT-${codeSuffix}`);
                    setNewMarketingAccountNo("");
                    setNewMarketingCommRate(defaultCommissionRate);
                    setIsMarketingModalOpen(true);
                  }}
                  className="btn-primary"
                  style={{
                    background: "linear-gradient(135deg, #10B981, #059669)",
                    padding: "0.55rem 1.1rem",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                  }}
                >
                  + Daftarkan Marketing Lapangan
                </button>
              </div>
            </div>

            {/* Filter & Pemetaan Wilayah Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                padding: "0.85rem 1.15rem",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                marginBottom: "1.25rem",
              }}
            >
              {/* Filter Status Pills */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "#94A3B8", fontWeight: 700 }}>Status:</span>
                {[
                  { key: "ALL", label: `Semua (${marketingList.length})` },
                  { key: "PENDING", label: `⏳ Pendaftar Baru (${marketingList.filter((m) => m.status === "PENDING").length})` },
                  { key: "ACTIVE", label: `● Aktif (${marketingList.filter((m) => m.status === "ACTIVE").length})` },
                  { key: "INACTIVE", label: `✕ Nonaktif (${marketingList.filter((m) => m.status === "INACTIVE").length})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setMarketingFilterStatus(tab.key as any)}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      border: "none",
                      background:
                        marketingFilterStatus === tab.key
                          ? tab.key === "PENDING"
                            ? "#F59E0B"
                            : tab.key === "ACTIVE"
                            ? "#10B981"
                            : "#0EA5E9"
                          : "rgba(255, 255, 255, 0.06)",
                      color: marketingFilterStatus === tab.key ? "#FFF" : "#94A3B8",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search & Map Wilayah Input */}
              <div style={{ minWidth: "260px" }}>
                <input
                  type="text"
                  placeholder="🔍 Cari Kota / Wilayah / Nama..."
                  value={marketingSearchQuery}
                  onChange={(e) => setMarketingSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.85rem",
                    borderRadius: "6px",
                    background: "#0F172A",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#FFF",
                    fontSize: "0.8rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(16, 185, 129, 0.2)", color: "#34D399", fontSize: "0.75rem", textTransform: "uppercase" }}>
                    <th style={{ padding: "0.85rem 1rem" }}>Nama Marketing &amp; Kode</th>
                    <th style={{ padding: "0.85rem 1rem" }}>No. WhatsApp &amp; Wilayah Pemetaan</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Status Akun</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Tarif Komisi</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Tenant Diakuisisi</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Struk Dihasilkan</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Total Komisi Berhak</th>
                    <th style={{ padding: "0.85rem 1rem" }}>Rekening Pencairan</th>
                    <th style={{ padding: "0.85rem 1rem", textAlign: "right" }}>Aksi Manajemen</th>
                  </tr>
                </thead>
                <tbody>
                  {marketingList
                    .filter((m) => {
                      const matchStatus = marketingFilterStatus === "ALL" || m.status === marketingFilterStatus;
                      const q = marketingSearchQuery.toLowerCase();
                      const matchQuery =
                        !q ||
                        m.name.toLowerCase().includes(q) ||
                        m.area.toLowerCase().includes(q) ||
                        m.referralCode.toLowerCase().includes(q);
                      return matchStatus && matchQuery;
                    })
                    .map((m) => {
                      const sisaKomisi = m.totalCommissionEarned - m.commissionPaid;
                      return (
                        <tr key={m.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                          <td style={{ padding: "1rem" }}>
                            <div style={{ fontWeight: 800, color: "#FFF" }}>{m.name}</div>
                            <span
                              style={{
                                background: "rgba(16, 185, 129, 0.15)",
                                border: "1px solid rgba(16, 185, 129, 0.4)",
                                color: "#34D399",
                                padding: "0.15rem 0.5rem",
                                borderRadius: "4px",
                                fontWeight: 800,
                                fontSize: "0.7rem",
                                display: "inline-block",
                                marginTop: "3px",
                              }}
                            >
                              {m.referralCode}
                            </span>
                            {m.experienceNotes && (
                              <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "4px" }}>
                                💡 {m.experienceNotes}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "1rem" }}>
                            <div style={{ color: "#E2E8F0" }}>{m.phone}</div>
                            <div style={{ fontSize: "0.75rem", color: "#38BDF8", fontWeight: 700, marginTop: "2px" }}>
                              📍 {m.area}
                            </div>
                          </td>

                          <td style={{ padding: "1rem" }}>
                            {m.status === "PENDING" && (
                              <span
                                style={{
                                  background: "rgba(245, 158, 11, 0.15)",
                                  border: "1px solid #F59E0B",
                                  color: "#FBBF24",
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "var(--radius-pill)",
                                  fontSize: "0.7rem",
                                  fontWeight: 800,
                                }}
                              >
                                ⏳ Pendaftar Baru
                              </span>
                            )}
                            {m.status === "ACTIVE" && (
                              <span
                                style={{
                                  background: "rgba(16, 185, 129, 0.15)",
                                  border: "1px solid #10B981",
                                  color: "#34D399",
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "var(--radius-pill)",
                                  fontSize: "0.7rem",
                                  fontWeight: 800,
                                }}
                              >
                                ● Aktif
                              </span>
                            )}
                            {m.status === "INACTIVE" && (
                              <span
                                style={{
                                  background: "rgba(239, 68, 68, 0.15)",
                                  border: "1px solid #EF4444",
                                  color: "#FCA5A5",
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "var(--radius-pill)",
                                  fontSize: "0.7rem",
                                  fontWeight: 800,
                                }}
                              >
                                ✕ Nonaktif
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "1rem" }}>
                            <span style={{ fontWeight: 800, color: "#FBBF24" }}>
                              Rp {m.commissionPerReceipt} / struk
                            </span>
                          </td>

                          <td style={{ padding: "1rem" }}>
                            <span style={{ fontWeight: 800, color: "#38BDF8" }}>
                              {m.totalTenantsAcquired} Tenant
                            </span>
                          </td>

                          <td style={{ padding: "1rem" }}>
                            <div style={{ fontWeight: 800 }}>{m.totalReceiptsGenerated} Struk</div>
                          </td>

                          <td style={{ padding: "1rem" }}>
                            <div style={{ fontWeight: 900, color: "#34D399" }}>
                              Rp {m.totalCommissionEarned.toLocaleString("id-ID")}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                              Dicairkan: Rp {m.commissionPaid.toLocaleString("id-ID")}
                            </div>
                            {sisaKomisi > 0 && (
                              <div style={{ fontSize: "0.75rem", color: "#F87171", fontWeight: 700 }}>
                                Sisa: Rp {sisaKomisi.toLocaleString("id-ID")}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "1rem" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.8rem" }}>
                              {m.bankName} - {m.accountNumber}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#64748B" }}>a/n {m.accountName}</div>
                          </td>

                          <td style={{ padding: "1rem", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                              {m.status === "PENDING" ? (
                                <>
                                  <button
                                    onClick={() => handleUpdateMarketingStatus(m.id, "ACTIVE")}
                                    className="btn-primary"
                                    style={{
                                      background: "linear-gradient(135deg, #10B981, #059669)",
                                      padding: "0.35rem 0.75rem",
                                      fontSize: "0.75rem",
                                      fontWeight: 800,
                                    }}
                                  >
                                    ✓ Setujui
                                  </button>
                                  <button
                                    onClick={() => handleUpdateMarketingStatus(m.id, "INACTIVE")}
                                    className="btn-secondary"
                                    style={{
                                      padding: "0.35rem 0.65rem",
                                      fontSize: "0.75rem",
                                      color: "#F87171",
                                    }}
                                  >
                                    ✕ Tolak
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      alert(`Pencairan komisi untuk ${m.name} sebesar Rp ${sisaKomisi.toLocaleString("id-ID")} telah diproses ke ${m.bankName} ${m.accountNumber}`);
                                      setMarketingList((prev) =>
                                        prev.map((item) =>
                                          item.id === m.id ? { ...item, commissionPaid: item.totalCommissionEarned } : item
                                        )
                                      );
                                    }}
                                    disabled={sisaKomisi <= 0}
                                    className="btn-secondary"
                                    style={{
                                      padding: "0.4rem 0.75rem",
                                      fontSize: "0.75rem",
                                      opacity: sisaKomisi <= 0 ? 0.5 : 1,
                                    }}
                                  >
                                    Cairkan Komisi
                                  </button>
                                  {m.status === "ACTIVE" ? (
                                    <button
                                      onClick={() => handleUpdateMarketingStatus(m.id, "INACTIVE")}
                                      className="btn-secondary"
                                      style={{ padding: "0.4rem 0.55rem", fontSize: "0.75rem", color: "#94A3B8" }}
                                      title="Nonaktifkan Kemitraan"
                                    >
                                      Suspend
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateMarketingStatus(m.id, "ACTIVE")}
                                      className="btn-secondary"
                                      style={{ padding: "0.4rem 0.55rem", fontSize: "0.75rem", color: "#34D399" }}
                                      title="Aktifkan Kembali"
                                    >
                                      Aktifkan
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* TAB CONTENT 3: QRIS PEMBAYARAN SAAS PLATFORM (PUSAT) */}
        {activeTab === "qris_billing" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
            {/* Card Pasang QRIS Pusat */}
            <section
              className="glass-panel"
              style={{
                padding: "1.75rem",
                border: "1px solid rgba(245, 158, 11, 0.25)",
              }}
            >
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FBBF24", marginBottom: "0.5rem" }}>
                💳 Pasang QRIS Pembayaran Sewa SaaS Platform (Pusat OKESIH)
              </h2>
              <p style={{ fontSize: "0.825rem", color: "#94A3B8", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                QRIS inilah yang otomatis dimunculkan kepada seluruh Tenant / Owner Warkop saat mereka melakukan penutupan toko/shift untuk menyetorkan biaya sewa Rp 50/struk + nominal kode unik alokasi mereka.
              </p>

              <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", marginBottom: "1.5rem" }}>
                <div
                  style={{
                    width: "140px",
                    height: "140px",
                    background: "#FFF",
                    borderRadius: "10px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.4)",
                  }}
                >
                  <div style={{ color: "#000", fontSize: "9px", fontWeight: 900, marginBottom: "4px" }}>
                    QRIS RESMI OKESIH HQ
                  </div>
                  <div style={{ width: "85px", height: "85px", background: "#000", borderRadius: "4px", margin: "auto" }} />
                  <div style={{ color: "#555", fontSize: "8px", fontWeight: 700, marginTop: "4px" }}>
                    NMID: ID1029384756520
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: "0.75rem" }}>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.25rem" }}>
                      Nama Merchant Rekening Pusat
                    </label>
                    <input
                      type="text"
                      value={centralQrisMerchant}
                      onChange={(e) => setCentralQrisMerchant(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.85rem",
                        borderRadius: "6px",
                        background: "rgba(15, 23, 42, 0.8)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        color: "#FFF",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.25rem" }}>
                        Bank Tujuan
                      </label>
                      <input
                        type="text"
                        value={centralBankName}
                        onChange={(e) => setCentralBankName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.85rem",
                          borderRadius: "6px",
                          background: "rgba(15, 23, 42, 0.8)",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          color: "#FFF",
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.25rem" }}>
                        Nomor Rekening
                      </label>
                      <input
                        type="text"
                        value={centralBankAccountNumber}
                        onChange={(e) => setCentralBankAccountNumber(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.85rem",
                          borderRadius: "6px",
                          background: "rgba(15, 23, 42, 0.8)",
                          border: "1px solid rgba(245, 158, 11, 0.4)",
                          color: "#FFF",
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "#94A3B8", fontWeight: 700, marginBottom: "0.25rem" }}>
                      Atas Nama Rekening
                    </label>
                    <input
                      type="text"
                      value={centralBankAccountName}
                      onChange={(e) => setCentralBankAccountName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.85rem",
                        borderRadius: "6px",
                        background: "rgba(15, 23, 42, 0.8)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        color: "#FFF",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => alert("Silakan unggah gambar QRIS resmi baru dari komputer Anda untuk dipasang ke sistem pusat.")}
                  className="btn-secondary"
                  style={{ flex: 1, fontSize: "0.85rem" }}
                >
                  📷 Upload Gambar QRIS Pusat Baru
                </button>
                <button
                  onClick={() => alert("✓ Pengaturan QRIS dan Rekening Pusat OKESIH berhasil disimpan dan aktif secara global!")}
                  className="btn-primary"
                  style={{
                    flex: 1,
                    background: "linear-gradient(135deg, #F59E0B, #D97706)",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                  }}
                >
                  Simpan Konfigurasi QRIS Pusat
                </button>
              </div>
            </section>

            {/* Rekonsiliasi Setoran & AI OCR Log */}
            <section
              className="glass-panel"
              style={{
                padding: "1.75rem",
                border: "1px solid rgba(56, 189, 248, 0.2)",
              }}
            >
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#38BDF8", marginBottom: "0.5rem" }}>
                🤖 Log Verifikasi Setoran Sewa (OCR AI)
              </h2>
              <p style={{ fontSize: "0.825rem", color: "#94A3B8", marginBottom: "1rem" }}>
                Pemeriksaan bukti transfer bank warkop yang dicocokkan otomatis dengan kode unik alokasi.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "6px",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 800 }}>
                    <span style={{ color: "#FFF" }}>Warkop Giras Nusantara</span>
                    <span style={{ color: "#34D399" }}>✓ Valid (Rp 12.545)</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "3px" }}>
                    Kode Unik 145 klop • BCA Transfer • OCR Confidence: 98%
                  </div>
                </div>

                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "6px",
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 800 }}>
                    <span style={{ color: "#FFF" }}>Warkop Barokah 24 Jam</span>
                    <span style={{ color: "#FBBF24" }}>⏳ Masa Tenggang (Grace)</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "3px" }}>
                    Batas waktu pembayaran: 23:59 WIB malam ini (Kode Unik: 215)
                  </div>
                </div>

                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "6px",
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 800 }}>
                    <span style={{ color: "#FFF" }}>Warkop Pojok Stadion</span>
                    <span style={{ color: "#34D399" }}>✓ Valid (Rp 10.088)</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#94A3B8", marginTop: "3px" }}>
                    Kode Unik 338 klop • Mandiri Transfer • OCR Confidence: 99%
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB CONTENT 4: PARAMETER MASTER GLOBAL */}
        {activeTab === "platform_config" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Auto-Dismiss TV */}
            <div
              className="glass-panel"
              style={{
                padding: "1.75rem",
                border: "1px solid rgba(56, 189, 248, 0.2)",
              }}
            >
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38BDF8", marginBottom: "0.5rem" }}>
                ⏱️ Parameter Master: Auto-Dismiss Antrean TV
              </h3>
              <p style={{ fontSize: "0.825rem", color: "#94A3B8", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                Berapa lama nomor antrean yang telah berstatus HIJAU (siap diantar) akan bertahan di seluruh Smart TV sebelum otomatis menghilang.
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

            {/* Tarif Pokok SaaS Platform */}
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
                <span style={{ fontSize: "0.85rem", color: "#94A3B8" }}>/ struk bon tercetak</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.85rem", color: "#94A3B8" }}>Default Komisi Marketing:</span>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: "#C084FC" }}>Rp</span>
                <input
                  type="number"
                  value={defaultCommissionRate}
                  onChange={(e) => setDefaultCommissionRate(parseInt(e.target.value) || 15)}
                  style={{
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(168, 85, 247, 0.4)",
                    borderRadius: "8px",
                    padding: "0.4rem 0.65rem",
                    fontSize: "1rem",
                    fontWeight: 900,
                    color: "#C084FC",
                    width: "90px",
                  }}
                />
                <span style={{ fontSize: "0.8rem", color: "#94A3B8" }}>/ struk</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: DAFTARKAN TENANT WARKOP BARU */}
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
              maxWidth: "580px",
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
                  Tetapkan alokasi kode unik, marketing lapangan, dan kredensial owner instan
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
                    Tetapkan Rentang Kode Unik
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

              {/* Marketing Lapangan & Komisi Bagi Hasil */}
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#34D399", marginBottom: "0.35rem" }}>
                    Marketing Lapangan yang Mengakuisisi
                  </label>
                  <select
                    value={selectedMarketingId}
                    onChange={(e) => setSelectedMarketingId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#FFF",
                      fontSize: "0.85rem",
                      outline: "none",
                    }}
                  >
                    <option value="direct">Direct HQ (Tanpa Marketing Lapangan)</option>
                    {marketingList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.referralCode} - {m.area})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#C084FC", marginBottom: "0.35rem" }}>
                    Komisi Bagi Hasil (Rp/Struk)
                  </label>
                  <input
                    type="number"
                    value={tenantCommissionRate}
                    onChange={(e) => setTenantCommissionRate(parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(168, 85, 247, 0.4)",
                      color: "#C084FC",
                      fontWeight: 800,
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
                    Nomor WhatsApp Owner
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

              {/* Kredensial Owner Otomatis (No OTP / Email) */}
              <div
                style={{
                  background: "rgba(14, 165, 233, 0.1)",
                  border: "1px dashed rgba(14, 165, 233, 0.4)",
                  borderRadius: "8px",
                  padding: "1rem",
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

      {/* MODAL 2: DAFTARKAN MARKETING LAPANGAN BARU */}
      {isMarketingModalOpen && (
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
              maxWidth: "520px",
              width: "100%",
              padding: "2rem",
              background: "#090E17",
              border: "2px solid #10B981",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#34D399" }}>
                  Daftarkan Marketing Lapangan
                </h2>
                <div style={{ fontSize: "0.8rem", color: "#94A3B8" }}>
                  Tetapkan wilayah, kode referral, rekening pencairan, dan komisi per struk
                </div>
              </div>
              <button
                onClick={() => setIsMarketingModalOpen(false)}
                className="btn-secondary"
                style={{ width: "32px", height: "32px", padding: 0 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMarketing} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                  Nama Lengkap Marketing Sales
                </label>
                <input
                  type="text"
                  required
                  value={newMarketingName}
                  onChange={(e) => setNewMarketingName(e.target.value)}
                  placeholder="Contoh: Rian Wahyudi"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#FFF",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                    Nomor WhatsApp
                  </label>
                  <input
                    type="text"
                    required
                    value={newMarketingPhone}
                    onChange={(e) => setNewMarketingPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#FFF",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                    Wilayah / Area Penugasan
                  </label>
                  <input
                    type="text"
                    value={newMarketingArea}
                    onChange={(e) => setNewMarketingArea(e.target.value)}
                    placeholder="Contoh: Bandung & Cimahi"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#FFF",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                    Kode Referral Unik Marketing
                  </label>
                  <input
                    type="text"
                    required
                    value={newMarketingCode}
                    onChange={(e) => setNewMarketingCode(e.target.value.toUpperCase())}
                    placeholder="MKT-BDG01"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#34D399",
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#94A3B8", marginBottom: "0.35rem" }}>
                    Komisi (Rp / Struk)
                  </label>
                  <input
                    type="number"
                    value={newMarketingCommRate}
                    onChange={(e) => setNewMarketingCommRate(parseInt(e.target.value) || 15)}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#FBBF24",
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Data Rekening Pencairan Komisi */}
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px dashed rgba(16, 185, 129, 0.3)",
                  borderRadius: "8px",
                  padding: "1rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#34D399", marginBottom: "0.5rem" }}>
                  🏦 Rekening Bank / E-Wallet Pencairan Komisi:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "0.75rem", marginBottom: "0.5rem" }}>
                  <input
                    type="text"
                    value={newMarketingBank}
                    onChange={(e) => setNewMarketingBank(e.target.value)}
                    placeholder="Bank (BCA/BRI/Mandiri)"
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#FFF",
                      fontSize: "0.85rem",
                    }}
                  />
                  <input
                    type="text"
                    value={newMarketingAccountNo}
                    onChange={(e) => setNewMarketingAccountNo(e.target.value)}
                    placeholder="Nomor Rekening / HP E-Wallet"
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      background: "rgba(15, 23, 42, 0.8)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#FFF",
                      fontSize: "0.85rem",
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={newMarketingAccountName}
                  onChange={(e) => setNewMarketingAccountName(e.target.value)}
                  placeholder="Atas Nama Pemilik Rekening"
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    background: "rgba(15, 23, 42, 0.8)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#FFF",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "0.9rem",
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  marginTop: "0.5rem",
                }}
              >
                ✓ SIMPAN MARKETING LAPANGAN
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
