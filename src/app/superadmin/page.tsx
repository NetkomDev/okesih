"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuthGuard, logoutUser } from "@/lib/auth-helpers";
import ThemeToggle from "@/components/ThemeToggle";
import { INDONESIA_PROVINCES } from "@/lib/indonesia-regions";

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
  province: string;
  cityRegency: string;
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

interface ToastNotification {
  id: number;
  title: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmModalData {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: "danger" | "primary" | "success";
  onConfirm: () => void;
}

interface NewTenantCredentials {
  name: string;
  slug: string;
  uniqueCodeRange: string;
  marketingAgentName: string;
  commissionPerReceipt: number;
  username: string;
  password: string;
}

type AnalyticsPeriod = "today" | "week" | "month" | "year";

interface AnalyticsData {
  activeTenants: number;
  newTenants: number;
  receipts: number;
  grossBilling: number;
  marketingCommission: number;
  netRevenue: number;
  startAt: string;
  endAt: string;
  regions: Array<{ province: string; total: number; active: number }>;
  series: Array<{ day: string; receipts: number; gross: number; commission: number }>;
}

export default function SuperAdminDashboardPage() {
  const { isAuthorized, loading } = useAuthGuard(["SUPERADMIN"]);

  // Dynamic Theme State (Dark / Light)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const active = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
      setTheme(active);

      const handleThemeChange = () => {
        const t = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
        setTheme(t);
      };

      window.addEventListener("theme-change", handleThemeChange);
      window.addEventListener("storage", handleThemeChange);
      return () => {
        window.removeEventListener("theme-change", handleThemeChange);
        window.removeEventListener("storage", handleThemeChange);
      };
    }
  }, []);

  const isDark = theme === "dark";

  // Active Tab View di Super Admin
  const [activeTab, setActiveTab] = useState<"overview" | "tenants" | "marketing" | "qris_billing" | "platform_config">("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [autoHideEnabled, setAutoHideEnabled] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>("today");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("okesih-superadmin-sidebar");
      if (saved === "collapsed") setSidebarCollapsed(true);
      const savedAutoHide = window.localStorage.getItem("okesih-superadmin-autohide");
      if (savedAutoHide === "1") setAutoHideEnabled(true);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("okesih-superadmin-sidebar", next ? "collapsed" : "expanded");
      }
      return next;
    });
  };

  const toggleAutoHide = () => {
    setAutoHideEnabled((cur) => {
      const next = !cur;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("okesih-superadmin-autohide", next ? "1" : "0");
      }
      return next;
    });
  };

  const openDashboardView = (view: typeof activeTab) => {
    setActiveTab(view);
    setMobileSidebarOpen(false);
  };

  // Toast Notification System
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const showToast = (title: string, message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ id: Date.now(), title, message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Modal Konfirmasi Modern
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Modal Kredensial Owner Tenant Baru
  const [newTenantCredentials, setNewTenantCredentials] = useState<NewTenantCredentials | null>(null);

  // State Marketing Lapangan
  const [marketingList, setMarketingList] = useState<MarketingAgent[]>([]);

  // Marketing Filter & Search State
  const [marketingFilterStatus, setMarketingFilterStatus] = useState<"ALL" | "PENDING" | "ACTIVE" | "INACTIVE">("ALL");
  const [marketingSearchQuery, setMarketingSearchQuery] = useState<string>("");

  const loadMarketingPartners = async () => {
    try {
      const res = await fetch("/api/superadmin/marketing");
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
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
        showToast(
          "Status Marketing Diperbarui",
          `Status mitra marketing berhasil diubah menjadi ${newStatus}.`,
          "success"
        );
      } else {
        showToast("Gagal Memperbarui", "Server tidak dapat mengubah status mitra.", "error");
      }
    } catch {
      showToast("Koneksi Bermasalah", "Terjadi kesalahan jaringan ke server.", "error");
    }
  };

  // State Tenant Warkop
  const [tenants, setTenants] = useState<TenantWarkop[]>([]);

  // Load Tenants dari Supabase API
  const loadTenants = async () => {
    try {
      const res = await fetch("/api/superadmin/tenants");
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) setTenants(json.data);
    } catch (e) {
      console.error("Gagal memuat tenants dari database:", e);
    }
  };

  useEffect(() => {
    loadTenants();
    loadMarketingPartners();
  }, []);

  useEffect(() => {
    if (activeTab === "marketing") {
      loadMarketingPartners();
    } else if (activeTab === "tenants") {
      loadTenants();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isAuthorized) return;
    let active = true;
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const response = await fetch(`/api/superadmin/analytics?period=${analyticsPeriod}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Gagal memuat riwayat pencapaian.");
        if (active) setAnalytics(payload.data);
      } catch (error) {
        if (active) showToast("Analytics Tidak Tersedia", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
      } finally {
        if (active) setAnalyticsLoading(false);
      }
    };
    loadAnalytics();
    return () => { active = false; };
  }, [analyticsPeriod, isAuthorized]);

  // Master Platform Settings (SaaS HQ)
  const [globalDismissDuration, setGlobalDismissDuration] = useState<number>(60);
  const [saasFeePerReceipt, setSaasFeePerReceipt] = useState<number>(50);
  const [defaultCommissionRate, setDefaultCommissionRate] = useState<number>(15);
  const [isSettingsLoading, setIsSettingsLoading] = useState<boolean>(true);
  const [isSettingsSaving, setIsSettingsSaving] = useState<boolean>(false);
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadPlatformSettings = async () => {
      try {
        const response = await fetch("/api/platform-settings", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Gagal memuat parameter global.");
        if (active) {
          setGlobalDismissDuration(payload.data.queueDismissSeconds);
          setSaasFeePerReceipt(payload.data.saasFeePerReceipt);
          setDefaultCommissionRate(payload.data.defaultMarketingCommission);
          setSettingsUpdatedAt(payload.data.updatedAt);
        }
      } catch (error) {
        if (active) showToast("Parameter Belum Dimuat", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
      } finally {
        if (active) setIsSettingsLoading(false);
      }
    };
    loadPlatformSettings();
    return () => { active = false; };
  }, []);

  const handleSavePlatformSettings = async () => {
    setIsSettingsSaving(true);
    try {
      const response = await fetch("/api/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueDismissSeconds: globalDismissDuration,
          saasFeePerReceipt,
          defaultMarketingCommission: defaultCommissionRate,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Parameter global gagal disimpan.");
      setGlobalDismissDuration(payload.data.queueDismissSeconds);
      setSaasFeePerReceipt(payload.data.saasFeePerReceipt);
      setDefaultCommissionRate(payload.data.defaultMarketingCommission);
      setSettingsUpdatedAt(payload.data.updatedAt);
      showToast("Parameter Global Tersimpan", "TV antrean, dashboard owner, dan halaman marketing kini menggunakan konfigurasi terbaru.", "success");
    } catch (error) {
      showToast("Gagal Menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsSettingsSaving(false);
    }
  };

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
  const [newProvince, setNewProvince] = useState<string>("");
  const [newCityRegency, setNewCityRegency] = useState<string>("");
  const [newCodeRange, setNewCodeRange] = useState<string>("500 - 599");
  const [selectedMarketingId, setSelectedMarketingId] = useState<string>("direct");
  const [tenantCommissionRate, setTenantCommissionRate] = useState<string>("");
  const [generatedUsername, setGeneratedUsername] = useState<string>("");
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [isTenantSaving, setIsTenantSaving] = useState<boolean>(false);

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
  const [newMarketingUsername, setNewMarketingUsername] = useState<string>("");
  const [newMarketingPassword, setNewMarketingPassword] = useState<string>("");
  const [isMarketingSaving, setIsMarketingSaving] = useState<boolean>(false);

  const handleOpenMarketingModal = () => {
    const suffix = Math.floor(Math.random() * 9000) + 1000;
    setNewMarketingUsername(`marketing_${suffix}`);
    setNewMarketingPassword(`okesih${suffix}!`);
    setIsMarketingModalOpen(true);
  };

  // Search Query
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tenantRegionFilter, setTenantRegionFilter] = useState<string>("ALL");

  // Buka Modal Registrasi Tenant
  const handleOpenRegisterModal = () => {
    const randomSuffix = Math.floor(Math.random() * 899) + 100;
    setNewWarkopName("");
    setNewSlug("");
    setNewOwnerName("");
    setNewPhone("");
    setNewProvince("");
    setNewCityRegency("");
    setNewCodeRange(`${(tenants.length + 1) * 100} - ${(tenants.length + 1) * 100 + 99}`);
    setSelectedMarketingId("direct");
    setTenantCommissionRate(""); // default kosong (mengikuti standar global komisi)
    setGeneratedUsername(`owner_${randomSuffix}`);
    setGeneratedPassword(`okesih${randomSuffix}!`);
    setIsRegisterModalOpen(true);
  };

  // Simpan Tenant Baru (Persistens ke Supabase)
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarkopName.trim() || !newOwnerName.trim() || !newPhone.trim() || !newProvince || !newCityRegency.trim()) {
      showToast("Form Belum Lengkap", "Nama usaha, owner, nomor WhatsApp, provinsi, dan kota/kabupaten wajib diisi.", "error");
      return;
    }

    const phoneDigits = newPhone.replace(/\D/g, "");
    const normalizedPhone = phoneDigits.startsWith("62")
      ? phoneDigits
      : phoneDigits.startsWith("0")
        ? `62${phoneDigits.slice(1)}`
        : phoneDigits.startsWith("8")
          ? `62${phoneDigits}`
          : phoneDigits;
    if (!/^628\d{8,11}$/.test(normalizedPhone)) {
      showToast("Nomor WhatsApp Tidak Valid", "Gunakan nomor Indonesia aktif, misalnya 081234567890.", "error");
      return;
    }

    setIsTenantSaving(true);

    const assignedMarketer = marketingList.find((m) => m.id === selectedMarketingId);

    // Auto-generate clean slug dari Nama Usaha
    const createdSlug = (newSlug.trim() || newWarkopName.trim())
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `tenant-${Date.now().toString().slice(-6)}`;

    // Penentuan komisi bagi hasil:
    // - Direct HQ -> Rp 0
    // - Jika dikosongkan ("") atau "0" -> mengikuti standar global komisi (defaultCommissionRate)
    // - Jika diisi angka tertentu (misal: 1, 15, dll) -> komisi ditetapkan sesuai angka tersebut
    let finalCommission = 0;
    if (selectedMarketingId === "direct") {
      finalCommission = 0;
    } else if (tenantCommissionRate.trim() === "" || tenantCommissionRate.trim() === "0" || Number(tenantCommissionRate) === 0) {
      finalCommission = defaultCommissionRate;
    } else {
      finalCommission = Math.max(0, parseInt(tenantCommissionRate, 10) || 0);
    }

    const newTenant: TenantWarkop = {
      id: `ten-${Date.now()}`,
      name: newWarkopName.trim(),
      slug: createdSlug,
      ownerName: newOwnerName.trim(),
      phone: `+${normalizedPhone}`,
      province: newProvince,
      cityRegency: newCityRegency.trim(),
      uniqueCodeRange: newCodeRange,
      marketingAgentId: selectedMarketingId,
      marketingAgentName: assignedMarketer ? assignedMarketer.name : "Direct HQ",
      commissionPerReceipt: finalCommission,
      todayTransactions: 0,
      totalSaasBilling: 0,
      paymentStatus: "PAID",
      status: "ACTIVE",
      joinedDate: "Hari Ini",
    };

    // Optimistic UI update
    setTenants((prev) => [newTenant, ...prev]);

    if (assignedMarketer) {
      setMarketingList((prev) =>
        prev.map((m) =>
          m.id === assignedMarketer.id ? { ...m, totalTenantsAcquired: m.totalTenantsAcquired + 1 } : m
        )
      );
    }

    // Simpan ke Supabase via API Route
    try {
      const response = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTenant.name,
          slug: newTenant.slug,
          ownerName: newTenant.ownerName,
          phone: newTenant.phone,
          province: newTenant.province,
          cityRegency: newTenant.cityRegency,
          uniqueCodeRange: newTenant.uniqueCodeRange,
          marketingAgentId: selectedMarketingId,
          commissionPerReceipt: newTenant.commissionPerReceipt,
          username: generatedUsername,
          password: generatedPassword,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Tenant gagal disimpan.");
      await loadTenants();
      setIsRegisterModalOpen(false);
      setNewTenantCredentials({
        name: newTenant.name,
        slug: newTenant.slug,
        uniqueCodeRange: newTenant.uniqueCodeRange,
        marketingAgentName: newTenant.marketingAgentName || "Direct HQ",
        commissionPerReceipt: newTenant.commissionPerReceipt,
        username: generatedUsername,
        password: generatedPassword,
      });
      showToast(
        "Tenant Berhasil Didaftarkan",
        `Pesan selamat datang dan kredensial ${newTenant.name} telah diantrekan ke WhatsApp owner.`,
        "success"
      );
    } catch (err) {
      console.error("Gagal sinkron tenant ke Supabase:", err);
      setTenants((prev) => prev.filter((tenant) => tenant.id !== newTenant.id));
      if (assignedMarketer) {
        setMarketingList((prev) =>
          prev.map((m) =>
            m.id === assignedMarketer.id
              ? { ...m, totalTenantsAcquired: Math.max(0, m.totalTenantsAcquired - 1) }
              : m
          )
        );
      }
      setNewTenantCredentials(null);
      showToast("Tenant Gagal Disimpan", err instanceof Error ? err.message : "Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsTenantSaving(false);
    }
  };

  // Simpan Marketing Lapangan Baru
  const handleCreateMarketing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketingName.trim() || !newMarketingCode.trim()) {
      showToast("Form Belum Lengkap", "Harap isi Nama Marketing dan Kode Referral!", "error");
      return;
    }

    const newMkt: MarketingAgent = {
      id: `mkt-${Date.now()}`,
      name: newMarketingName.trim(),
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

    setIsMarketingSaving(true);
    try {
      const response = await fetch("/api/superadmin/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newMkt, username: newMarketingUsername, password: newMarketingPassword }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Gagal menyimpan marketing.");
      await loadMarketingPartners();
      setIsMarketingModalOpen(false);
      showToast("Marketing Berhasil Didaftarkan", `Kredensial ${newMkt.name} telah diantrekan ke WhatsApp ${newMkt.phone}.`, "success");
    } catch (error) {
      showToast("Gagal Menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsMarketingSaving(false);
    }
  };

  const toggleTenantStatus = (id: string) => {
    const target = tenants.find((t) => t.id === id);
    if (!target) return;
    const isNowActive = target.status !== "ACTIVE";
    const nextStatus = isNowActive ? "ACTIVE" : "SUSPENDED";

    setConfirmModal({
      isOpen: true,
      title: isNowActive ? "Aktifkan Tenant Warkop" : "Suspend Akses Tenant Warkop",
      message: isNowActive
        ? `Aktifkan kembali akses operasional untuk "${target.name}"?`
        : `Tangguhkan (SUSPEND) "${target.name}"? Operasional kasir POS dan QR menu warkop akan dinonaktifkan sementara.`,
      confirmText: isNowActive ? "Ya, Aktifkan" : "Ya, Suspend",
      confirmVariant: isNowActive ? "success" : "danger",
      onConfirm: async () => {
        setTenants((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t))
        );
        setConfirmModal((c) => ({ ...c, isOpen: false }));
        showToast(
          isNowActive ? "Tenant Diaktifkan" : "Tenant Ditangguhkan",
          `Status ${target.name} sekarang: ${nextStatus}`,
          isNowActive ? "success" : "info"
        );

        try {
          await fetch("/api/superadmin/tenants", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, is_active: isNowActive }),
          });
        } catch (e) {
          console.error("Gagal update status warkop ke DB:", e);
        }
      },
    });
  };

  // Filter Tenant
  const filteredTenants = tenants.filter(
    (t) =>
      (tenantRegionFilter === "ALL" || t.province === tenantRegionFilter) &&
      (t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.province.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.cityRegency.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Global Financial Metrics
  const totalActiveTenants = analytics?.activeTenants ?? tenants.filter((t) => t.status === "ACTIVE").length;
  const totalAllTransactions = analytics?.receipts ?? tenants.reduce((sum, t) => sum + t.todayTransactions, 0);
  const totalGrossSaasBilling = analytics?.grossBilling ?? tenants.reduce((sum, t) => sum + t.totalSaasBilling, 0);

  // Total Komisi Marketing yang dialokasikan dari transaksi hari ini
  const totalMarketingCommission = analytics?.marketingCommission ?? tenants.reduce(
    (sum, t) => sum + t.todayTransactions * t.commissionPerReceipt,
    0
  );

  // Net Revenue Platform SaaS Pusat (Gross - Komisi Marketing)
  const netPlatformRevenue = analytics?.netRevenue ?? totalGrossSaasBilling - totalMarketingCommission;
  const periodLabel = { today: "Hari ini", week: "Minggu ini", month: "Bulan ini", year: "Tahun ini" }[analyticsPeriod];

  if (loading || !isAuthorized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "#06090E" : "#F8FAFC",
          color: isDark ? "#F0F6FC" : "#0F172A",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "2.5rem" }}>🛡️</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0284C7" }}>
          Memverifikasi Otoritas Super Admin Pusat...
        </div>
        <div style={{ fontSize: "0.85rem", color: isDark ? "#64748B" : "#94A3B8" }}>
          Pemeriksaan token peran &amp; hak akses ekosistem OKESIH
        </div>
      </div>
    );
  }

  return (
    <div
      className={`superadmin-shell ${sidebarCollapsed ? "is-collapsed" : ""}`}
      style={{
        minHeight: "100vh",
        backgroundColor: isDark ? "#06090E" : "#F8FAFC",
        color: isDark ? "#F0F6FC" : "#0F172A",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      {/* Toast Notification Floating Container */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "1.5rem",
            right: "1.5rem",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            padding: "0.85rem 1.25rem",
            borderRadius: "12px",
            background: isDark ? "#0F172A" : "#FFFFFF",
            color: isDark ? "#FFFFFF" : "#0F172A",
            border:
              toast.type === "success"
                ? "1px solid #10B981"
                : toast.type === "error"
                ? "1px solid #EF4444"
                : "1px solid #0EA5E9",
            boxShadow: isDark
              ? "0 10px 30px rgba(0, 0, 0, 0.6)"
              : "0 10px 30px rgba(0, 0, 0, 0.12)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>
            {toast.type === "success" ? "✅" : toast.type === "error" ? "⚠️" : "ℹ️"}
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.875rem" }}>{toast.title}</div>
            <div style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B" }}>
              {toast.message}
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: isDark ? "#94A3B8" : "#64748B",
              cursor: "pointer",
              fontSize: "1rem",
              marginLeft: "0.5rem",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Super Admin Backdrop for Mobile */}
      <div
        className={`superadmin-sidebar-backdrop ${mobileSidebarOpen ? "is-visible" : ""}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      {/* Collapsible & Auto-Hide Sidebar */}
      <aside
        className={`superadmin-sidebar ${sidebarCollapsed ? "is-collapsed" : "is-expanded"} ${mobileSidebarOpen ? "is-mobile-open" : ""} ${autoHideEnabled ? "is-autohide" : ""} ${isHovered && sidebarCollapsed ? "is-peek" : ""}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Sidebar Header */}
        <div className="superadmin-sidebar-header">
          <div
            className="superadmin-sidebar-brand"
            onClick={() => sidebarCollapsed && toggleSidebar()}
            style={{ cursor: sidebarCollapsed ? "pointer" : "default" }}
            title={sidebarCollapsed ? "Klik untuk memperluas sidebar" : undefined}
          >
            <img src="/logo.svg?v=2" alt="OKESIH Logo" />
            <div className="superadmin-sidebar-brand-text" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "-0.02em", color: isDark ? "#FFFFFF" : "#0F172A", lineHeight: 1.1 }}>
                OKESIH<span style={{ color: "#0284C7" }}> HQ</span>
              </div>
              <div style={{ fontSize: "0.68rem", color: isDark ? "#7DD3FC" : "#0284C7", fontWeight: 800, letterSpacing: "0.04em" }}>
                COMMAND CENTER
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className="superadmin-sidebar-toggle-btn"
            title={sidebarCollapsed ? "Perluas Sidebar" : "Lipat Sidebar (Collapse)"}
            aria-label="Toggle Sidebar"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: sidebarCollapsed ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.25s ease",
              }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="superadmin-sidebar-content">
          <div className="superadmin-sidebar-section-title">PLATFORM SAAS &amp; OPERASIONAL</div>

          <nav className="superadmin-sidebar-menu">
            {/* 1. Overview */}
            <button
              type="button"
              onClick={() => openDashboardView("overview")}
              className={`superadmin-sidebar-item ${activeTab === "overview" ? "is-active" : ""}`}
              title="Overview & Finansial"
            >
              <div className="superadmin-sidebar-item-icon">
                📊
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Overview &amp; Finansial</strong>
                <span>Metrik Global &amp; Wilayah</span>
              </div>
            </button>

            {/* 2. Tenant Warkop */}
            <button
              type="button"
              onClick={() => openDashboardView("tenants")}
              className={`superadmin-sidebar-item ${activeTab === "tenants" ? "is-active" : ""}`}
              title="Daftar Tenant Warkop"
            >
              <div className="superadmin-sidebar-item-icon">
                🏢
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Daftar Tenant Warkop</strong>
                <span>Rentang Kode Unik &amp; Akun</span>
              </div>
              <span className="superadmin-sidebar-item-badge">{tenants.length}</span>
            </button>

            {/* 3. Marketing */}
            <button
              type="button"
              onClick={() => openDashboardView("marketing")}
              className={`superadmin-sidebar-item ${activeTab === "marketing" ? "is-active" : ""}`}
              title="Marketing Lapangan"
            >
              <div className="superadmin-sidebar-item-icon">
                🤝
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Mitra Marketing</strong>
                <span>Referral &amp; Bagi Hasil</span>
              </div>
              <span className="superadmin-sidebar-item-badge" style={{ background: "rgba(16, 185, 129, 0.14)", color: "#10B981" }}>
                {marketingList.length}
              </span>
            </button>

            {/* 4. QRIS Billing */}
            <button
              type="button"
              onClick={() => openDashboardView("qris_billing")}
              className={`superadmin-sidebar-item ${activeTab === "qris_billing" ? "is-active" : ""}`}
              title="Billing QRIS SaaS"
            >
              <div className="superadmin-sidebar-item-icon">
                💳
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Billing &amp; QRIS SaaS</strong>
                <span>Rekening Pusat &amp; Biaya</span>
              </div>
            </button>

            {/* 5. Parameter Master */}
            <button
              type="button"
              onClick={() => openDashboardView("platform_config")}
              className={`superadmin-sidebar-item ${activeTab === "platform_config" ? "is-active" : ""}`}
              title="Parameter Master Global"
            >
              <div className="superadmin-sidebar-item-icon">
                ⚙️
              </div>
              <div className="superadmin-sidebar-item-info">
                <strong>Parameter Master</strong>
                <span>Tarif SaaS &amp; Kuota</span>
              </div>
            </button>
          </nav>

          {/* Quick Actions in Sidebar */}
          <div className="superadmin-sidebar-quick-actions" style={{ marginTop: "0.5rem" }}>
            <div className="superadmin-sidebar-section-title" style={{ marginBottom: "0.5rem" }}>TINDAKAN CEPAT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={handleOpenRegisterModal}
                className="btn-primary"
                style={{
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                }}
              >
                <span>+</span> Daftarkan Warkop
              </button>
              <button
                type="button"
                onClick={() => {
                  const codeSuffix = Math.floor(Math.random() * 89) + 10;
                  setNewMarketingName("");
                  setNewMarketingPhone("");
                  setNewMarketingArea("");
                  setNewMarketingCode(`MKT-${codeSuffix}`);
                  setNewMarketingAccountNo("");
                  setNewMarketingCommRate(defaultCommissionRate);
                  handleOpenMarketingModal();
                }}
                className="btn-primary"
                style={{
                  padding: "0.55rem 0.75rem",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.4rem",
                }}
              >
                <span>+</span> Daftarkan Marketing
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="superadmin-sidebar-footer">
          {/* Expanded Footer Details */}
          <div className="superadmin-sidebar-expanded-footer">
            {/* Auto-Hide Toggle Switch */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.35rem 0.5rem",
                borderRadius: "8px",
                background: isDark ? "rgba(148, 163, 184, 0.08)" : "rgba(0, 0, 0, 0.04)",
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
              onClick={toggleAutoHide}
              title="Bila aktif, sidebar otomatis melipat dan melayang saat mouse mendekat"
            >
              <span style={{ color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700 }}>Auto-Hide (Hover Peek)</span>
              <span style={{ fontWeight: 800, color: autoHideEnabled ? "#10B981" : isDark ? "#64748B" : "#94A3B8" }}>
                {autoHideEnabled ? "ON" : "OFF"}
              </span>
            </div>

            {/* Admin User Card */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(135deg, #0284C7, #0EA5E9)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.75rem" }}>
                  HQ
                </div>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: isDark ? "#fff" : "#0F172A", lineHeight: 1.1 }}>Super Admin</div>
                  <div style={{ fontSize: "0.68rem", color: "#10B981", fontWeight: 700 }}>🟢 Online</div>
                </div>
              </div>
              <button
                onClick={logoutUser}
                className="btn-secondary"
                style={{ padding: "0.35rem 0.65rem", fontSize: "0.72rem", color: "#EF4444", borderColor: "rgba(239, 68, 68, 0.4)", borderRadius: "6px" }}
                title="Keluar dari sesi Super Admin"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mini Collapsed Footer Controls */}
          <div className="superadmin-sidebar-collapsed-footer">
            <button
              type="button"
              onClick={toggleSidebar}
              style={{
                background: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(0, 0, 0, 0.06)",
                border: isDark ? "1px solid rgba(148, 163, 184, 0.2)" : "1px solid rgba(0, 0, 0, 0.12)",
                borderRadius: "8px",
                color: isDark ? "#F8FAFC" : "#0F172A",
                width: "36px",
                height: "36px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.18s ease",
              }}
              title="Perluas Sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <polyline points="14 9 17 12 14 15" />
              </svg>
            </button>
            <button
              type="button"
              onClick={logoutUser}
              style={{
                background: "transparent",
                border: "none",
                color: "#EF4444",
                fontSize: "1.15rem",
                padding: "0.25rem",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
              }}
              title="Logout"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="superadmin-workspace">
        {/* Topbar */}
        <header className="superadmin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            {/* Toggle Button (Desktop & Mobile) */}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                  setMobileSidebarOpen((prev) => !prev);
                } else {
                  toggleSidebar();
                }
              }}
              className="superadmin-topbar-toggle"
              style={{ display: "inline-flex" }}
              title={sidebarCollapsed ? "Perluas Sidebar" : "Lipat Sidebar"}
              aria-label="Toggle Sidebar"
            >
              ☰
            </button>

            {/* Breadcrumb */}
            <div className="superadmin-breadcrumb">
              <span style={{ color: isDark ? "#64748B" : "#94A3B8", fontWeight: 700 }}>OKESIH HQ</span>
              <span style={{ color: isDark ? "#475569" : "#CBD5E1" }}>/</span>
              <span style={{ color: isDark ? "#F8FAFC" : "#0F172A", fontWeight: 800 }}>
                {activeTab === "overview" && "Overview & Finansial"}
                {activeTab === "tenants" && "Daftar Tenant Warkop"}
                {activeTab === "marketing" && "Mitra Marketing Lapangan"}
                {activeTab === "qris_billing" && "Billing & QRIS SaaS"}
                {activeTab === "platform_config" && "Parameter Master Global"}
              </span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
                background: isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                fontSize: "0.7rem",
                fontWeight: 800,
                color: "#10B981",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", display: "inline-block", boxShadow: "0 0 8px #10B981" }} />
              HQ Server Online
            </div>
          </div>

          <div className="superadmin-actions" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <ThemeToggle />

            <button
              onClick={handleOpenRegisterModal}
              className="btn-primary"
              style={{
                background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                padding: "0.45rem 0.95rem",
                fontSize: "0.8rem",
                fontWeight: 800,
                borderRadius: "8px",
              }}
            >
              + Tenant
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
                handleOpenMarketingModal();
              }}
              className="btn-primary"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
                padding: "0.45rem 0.95rem",
                fontSize: "0.8rem",
                fontWeight: 800,
                borderRadius: "8px",
              }}
            >
              + Marketing
            </button>
          </div>
        </header>

        {/* Main Container */}
        <main className="superadmin-main">
          {/* RESUME FINANSIAL & EKOSISTEM SAAS GLOBAL */}
          {activeTab === "overview" && (
            <section className="superadmin-overview" style={{ marginBottom: "2rem" }}>
          <div className="superadmin-page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1rem" }}>
            <div>
              <h1
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: isDark ? "#FFFFFF" : "#0F172A",
                }}
              >
                Resume Ekosistem Platform SaaS OKESIH
              </h1>
              <p style={{ fontSize: "0.85rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                Monitoring performa seluruh tenant warkop, bagi hasil komisi marketing lapangan, dan net revenue platform.
              </p>
            </div>
            <div className="superadmin-period-filter" aria-label="Filter periode analytics">
              {([
                ["today", "Hari ini"], ["week", "Minggu"], ["month", "Bulan"], ["year", "Tahun"],
              ] as Array<[AnalyticsPeriod, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={analyticsPeriod === value ? "is-active" : ""}
                  onClick={() => setAnalyticsPeriod(value)}
                  disabled={analyticsLoading}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="superadmin-kpi-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Card 1: Total Tenant Aktif */}
            <div
              className="glass-panel superadmin-kpi-card"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(14, 165, 233, 0.25)" : "1px solid rgba(14, 165, 233, 0.2)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark ? "none" : "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.35rem" }}>
                TENANT AKTIF
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: isDark ? "#38BDF8" : "#0284C7" }}>
                {totalActiveTenants} <span style={{ fontSize: "0.95rem", color: isDark ? "#64748B" : "#94A3B8" }}>/ {tenants.length} Warkop</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#34D399" : "#059669", marginTop: "0.4rem", fontWeight: 600 }}>
                + {analytics?.newTenants ?? 0} tenant baru • {periodLabel}
              </div>
            </div>

            {/* Card 2: Total Struk Ekosistem */}
            <div
              className="glass-panel superadmin-kpi-card"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(16, 185, 129, 0.2)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark ? "none" : "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.35rem" }}>
                TOTAL STRUK • {periodLabel.toUpperCase()}
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: isDark ? "#10B981" : "#059669" }}>
                {totalAllTransactions.toLocaleString("id-ID")}{" "}
                <span style={{ fontSize: "0.95rem", color: isDark ? "#64748B" : "#94A3B8" }}>Struk</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.4rem" }}>
                Dari seluruh pesanan meja &amp; kasir
              </div>
            </div>

            {/* Card 3: Gross Billing Platform */}
            <div
              className="glass-panel superadmin-kpi-card"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(245, 158, 11, 0.2)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark ? "none" : "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.35rem" }}>
                GROSS BILLING • {periodLabel.toUpperCase()}
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: isDark ? "#FBBF24" : "#D97706" }}>
                Rp {totalGrossSaasBilling.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#FCD34D" : "#B45309", marginTop: "0.4rem", fontWeight: 600 }}>
                Total tagihan sewa harian platform
              </div>
            </div>

            {/* Card 4: Bagi Hasil Komisi Marketing */}
            <div
              className="glass-panel superadmin-kpi-card"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(168, 85, 247, 0.25)" : "1px solid rgba(168, 85, 247, 0.2)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark ? "none" : "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.35rem" }}>
                BAGI HASIL MARKETING • {periodLabel.toUpperCase()}
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: isDark ? "#C084FC" : "#7C3AED" }}>
                Rp {totalMarketingCommission.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#E9D5FF" : "#6D28D9", marginTop: "0.4rem" }}>
                Komisi dari {marketingList.length} mitra sales lapangan
              </div>
            </div>

            {/* Card 5: Net Revenue Platform (DENGAN KONTRAST KONSISTEN) */}
            <div
              className="glass-panel superadmin-kpi-card superadmin-kpi-card--net-revenue"
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(14, 165, 233, 0.4)" : "1px solid rgba(14, 165, 233, 0.35)",
                background: isDark
                  ? "linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(6, 9, 14, 0.7) 100%)"
                  : "#FFFFFF",
                boxShadow: isDark
                  ? "0 4px 20px rgba(14, 165, 233, 0.15)"
                  : "0 6px 24px rgba(14, 165, 233, 0.08)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: isDark ? "#38BDF8" : "#0284C7", fontWeight: 800, marginBottom: "0.35rem" }}>
                NET PENDAPATAN OKESIH HQ
              </div>
              <div
                style={{
                  fontSize: "2.1rem",
                  fontWeight: 900,
                  color: isDark ? "#38BDF8" : "#0284C7",
                }}
              >
                Rp {netPlatformRevenue.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.75rem", color: isDark ? "#7DD3FC" : "#0369A1", marginTop: "0.4rem", fontWeight: 700 }}>
                Gross dikurangi komisi marketing
              </div>
            </div>
          </div>

          <div className="superadmin-insights-grid">
            <div className="superadmin-insight-card">
              <div className="superadmin-insight-heading">
                <div>
                  <strong>Riwayat Pencapaian</strong>
                  <span>Rincian harian untuk {periodLabel.toLowerCase()}</span>
                </div>
                {analyticsLoading && <span className="superadmin-loading-label">Memuat…</span>}
              </div>
              <div className="superadmin-history-list">
                {(analytics?.series || []).slice(-8).reverse().map((item) => (
                  <div className="superadmin-history-row" key={item.day}>
                    <time>{new Date(`${item.day}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</time>
                    <span><strong>{Number(item.receipts).toLocaleString("id-ID")}</strong> struk</span>
                    <span>Gross <strong>Rp {Number(item.gross).toLocaleString("id-ID")}</strong></span>
                    <span>Komisi <strong>Rp {Number(item.commission).toLocaleString("id-ID")}</strong></span>
                  </div>
                ))}
                {!analyticsLoading && !(analytics?.series || []).length && (
                  <div className="superadmin-empty-state">Belum ada transaksi pada periode ini.</div>
                )}
              </div>
            </div>

            <div className="superadmin-insight-card">
              <div className="superadmin-insight-heading">
                <div>
                  <strong>Sebaran Tenant per Wilayah</strong>
                  <span>Total tenant berdasarkan provinsi</span>
                </div>
              </div>
              <div className="superadmin-region-list">
                {(analytics?.regions || []).map((region) => {
                  const max = Math.max(...(analytics?.regions || []).map((item) => Number(item.total)), 1);
                  return (
                    <div className="superadmin-region-row" key={region.province}>
                      <div><strong>{region.province}</strong><span>{region.active} aktif</span></div>
                      <div className="superadmin-region-track"><i style={{ width: `${(Number(region.total) / max) * 100}%` }} /></div>
                      <b>{region.total}</b>
                    </div>
                  );
                })}
                {!analyticsLoading && !(analytics?.regions || []).length && (
                  <div className="superadmin-empty-state">Wilayah tenant belum tersedia.</div>
                )}
              </div>
            </div>
          </div>

              {/* Quick Action Shortcuts inside Overview */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "1rem",
                  marginTop: "1.25rem",
                }}
              >
                <div
                  onClick={() => openDashboardView("tenants")}
                  className="glass-panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "14px",
                    border: isDark ? "1px solid rgba(14, 165, 233, 0.25)" : "1px solid rgba(14, 165, 233, 0.2)",
                    background: isDark
                      ? "linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                      : "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "transform 0.18s ease, border-color 0.18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: isDark ? "#FFFFFF" : "#0F172A" }}>
                      🏢 Kelola Tenant Warkop
                    </div>
                    <div style={{ fontSize: "0.78rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.2rem" }}>
                      {tenants.length} warkop terdaftar • Alokasi kode unik POS
                    </div>
                  </div>
                  <span style={{ fontSize: "1.2rem", color: "#0284C7" }}>→</span>
                </div>

                <div
                  onClick={() => openDashboardView("marketing")}
                  className="glass-panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "14px",
                    border: isDark ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(16, 185, 129, 0.2)",
                    background: isDark
                      ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                      : "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "transform 0.18s ease, border-color 0.18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: isDark ? "#FFFFFF" : "#0F172A" }}>
                      🤝 Mitra Marketing Lapangan
                    </div>
                    <div style={{ fontSize: "0.78rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.2rem" }}>
                      {marketingList.length} mitra agen • Komisi &amp; Pencairan
                    </div>
                  </div>
                  <span style={{ fontSize: "1.2rem", color: "#10B981" }}>→</span>
                </div>

                <div
                  onClick={() => openDashboardView("qris_billing")}
                  className="glass-panel"
                  style={{
                    padding: "1.25rem",
                    borderRadius: "14px",
                    border: isDark ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(245, 158, 11, 0.2)",
                    background: isDark
                      ? "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(6, 9, 14, 0.6) 100%)"
                      : "#FFFFFF",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "transform 0.18s ease, border-color 0.18s ease",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: isDark ? "#FFFFFF" : "#0F172A" }}>
                      💳 QRIS &amp; Billing SaaS Platform
                    </div>
                    <div style={{ fontSize: "0.78rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.2rem" }}>
                      Biaya SaaS Rp 100/struk • Verifikasi mutasi
                    </div>
                  </div>
                  <span style={{ fontSize: "1.2rem", color: "#D97706" }}>→</span>
                </div>
              </div>
            </section>
          )}

        {/* TAB CONTENT 1: DAFTAR TENANT WARKOP & ALOKASI KODE UNIK */}
        {activeTab === "tenants" && (
          <section
            className="glass-panel"
            style={{
              padding: "1.75rem",
              borderRadius: "14px",
              border: isDark ? "1px solid rgba(56, 189, 248, 0.2)" : "1px solid rgba(14, 165, 233, 0.2)",
              background: isDark ? undefined : "#FFFFFF",
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
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>
                  Daftar Klien Tenant Warkop Terdaftar
                </h2>
                <div style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                  Kelola status aktivasi, penetapan rentang kode unik pembayaran, serta asosiasi marketing lapangan.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <select
                  value={tenantRegionFilter}
                  onChange={(e) => setTenantRegionFilter(e.target.value)}
                  aria-label="Filter tenant berdasarkan provinsi"
                  style={{
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                    padding: "0.55rem 0.75rem", color: isDark ? "#FFF" : "#0F172A", minWidth: "170px",
                  }}
                >
                  <option value="ALL">Semua wilayah</option>
                  {Array.from(new Set(tenants.map((tenant) => tenant.province))).sort().map((province) => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari warkop, slug, owner..."
                  style={{
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                    borderRadius: "8px",
                    padding: "0.55rem 1rem",
                    fontSize: "0.85rem",
                    color: isDark ? "#FFF" : "#0F172A",
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

            <div className="superadmin-table-container">
              <table style={{ width: "100%", minWidth: "1050px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: isDark ? "1px solid rgba(56, 189, 248, 0.2)" : "1px solid rgba(14, 165, 233, 0.2)",
                      color: isDark ? "#7DD3FC" : "#0284C7",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      background: isDark ? "transparent" : "#F8FAFC",
                    }}
                  >
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Tenant Warkop &amp; Slug</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Owner &amp; Kontak</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Kode Unik POS</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Mitra Marketing</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Struk &amp; Tagihan</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Status</th>
                    <th style={{ padding: "0.85rem 1rem", textAlign: "right", whiteSpace: "nowrap" }}>Aksi Pusat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((t) => (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      <td style={{ padding: "1rem" }}>
                        <div style={{ fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>{t.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#0284C7", marginTop: "2px" }}>
                          🔗 /menu/{t.slug}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "4px" }}>
                          📍 {t.cityRegency}, {t.province}
                        </div>
                      </td>

                      <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, color: isDark ? "#E2E8F0" : "#334155" }}>{t.ownerName}</div>
                        <div style={{ fontSize: "0.75rem", color: isDark ? "#64748B" : "#94A3B8" }}>{t.phone}</div>
                      </td>

                      <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                        <span
                          style={{
                            background: isDark ? "rgba(14, 165, 233, 0.1)" : "rgba(14, 165, 233, 0.08)",
                            border: "1px solid rgba(14, 165, 233, 0.3)",
                            color: "#0284C7",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "4px",
                            fontWeight: 800,
                            fontSize: "0.75rem",
                          }}
                        >
                          {t.uniqueCodeRange}
                        </span>
                      </td>

                      <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, color: isDark ? "#34D399" : "#059669" }}>
                          {t.marketingAgentName || "Direct HQ"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: isDark ? "#C084FC" : "#7C3AED", fontWeight: 700, marginTop: "2px" }}>
                          Rp {t.commissionPerReceipt} / struk
                        </div>
                      </td>

                      <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>
                          {t.todayTransactions} Struk
                        </div>
                        <div style={{ fontSize: "0.75rem", color: isDark ? "#FBBF24" : "#D97706", fontWeight: 800, marginTop: "2px" }}>
                          Rp {t.totalSaasBilling.toLocaleString("id-ID")}
                        </div>
                      </td>

                      <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              color: t.paymentStatus === "PAID" ? (isDark ? "#34D399" : "#059669") : t.paymentStatus === "GRACE_PERIOD" ? (isDark ? "#FBBF24" : "#D97706") : "#EF4444",
                            }}
                          >
                            {t.paymentStatus === "PAID" ? "● Lunas" : t.paymentStatus === "GRACE_PERIOD" ? "● Grace Period" : "● Menunggak"}
                          </span>
                          {t.status === "ACTIVE" ? (
                            <span className="badge badge-ready" style={{ width: "fit-content" }}>AKTIF</span>
                          ) : (
                            <span style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid #EF4444", color: "#EF4444", padding: "0.15rem 0.5rem", borderRadius: "var(--radius-pill)", fontSize: "0.7rem", fontWeight: 800, width: "fit-content" }}>
                              SUSPEND
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "1rem", textAlign: "right", whiteSpace: "nowrap" }}>
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
                              background: t.status === "ACTIVE" ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                              border: t.status === "ACTIVE" ? "1px solid #EF4444" : "1px solid #10B981",
                              color: t.status === "ACTIVE" ? "#EF4444" : "#059669",
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
              borderRadius: "14px",
              border: isDark ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(16, 185, 129, 0.25)",
              background: isDark ? undefined : "#FFFFFF",
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
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>
                  Manajemen Marketing Lapangan &amp; Bagi Hasil Komisi
                </h2>
                <div style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                  Kelola pendaftar mitra marketing dari landing page, setujui aktivasi per wilayah, dan tetapkan komisi bagi hasil per struk transaksi.
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    loadMarketingPartners();
                    showToast("Data Dimuat Ulang", "Daftar mitra marketing telah diperbarui dari server.", "info");
                  }}
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
                    handleOpenMarketingModal();
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
                background: isDark ? "rgba(255, 255, 255, 0.03)" : "#F1F5F9",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(0, 0, 0, 0.06)",
                marginBottom: "1.25rem",
              }}
            >
              {/* Filter Status Pills */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700 }}>Status:</span>
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
                          : isDark
                          ? "rgba(255, 255, 255, 0.06)"
                          : "rgba(0, 0, 0, 0.06)",
                      color: marketingFilterStatus === tab.key ? "#FFF" : isDark ? "#94A3B8" : "#64748B",
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
                    background: isDark ? "#0F172A" : "#FFFFFF",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.12)",
                    color: isDark ? "#FFF" : "#0F172A",
                    fontSize: "0.8rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div className="superadmin-table-container">
              <table style={{ width: "100%", minWidth: "1150px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: isDark ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(16, 185, 129, 0.25)",
                      color: isDark ? "#34D399" : "#059669",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      background: isDark ? "transparent" : "#F8FAFC",
                    }}
                  >
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Nama Marketing &amp; Kode</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>No. WA &amp; Wilayah</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Status Akun</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Tarif Komisi</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Performa Sales</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Total Komisi Berhak</th>
                    <th style={{ padding: "0.85rem 1rem", whiteSpace: "nowrap" }}>Rekening Pencairan</th>
                    <th style={{ padding: "0.85rem 1rem", textAlign: "right", whiteSpace: "nowrap" }}>Aksi Manajemen</th>
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
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.05)",
                          }}
                        >
                          <td style={{ padding: "1rem" }}>
                            <div style={{ fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>{m.name}</div>
                            <span
                              style={{
                                background: isDark ? "rgba(16, 185, 129, 0.15)" : "rgba(16, 185, 129, 0.1)",
                                border: "1px solid rgba(16, 185, 129, 0.4)",
                                color: isDark ? "#34D399" : "#059669",
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
                              <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "4px" }}>
                                💡 {m.experienceNotes}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "1rem" }}>
                            <div style={{ color: isDark ? "#E2E8F0" : "#334155" }}>{m.phone}</div>
                            <div style={{ fontSize: "0.75rem", color: "#0284C7", fontWeight: 700, marginTop: "2px" }}>
                              📍 {m.area}
                            </div>
                          </td>

                          <td style={{ padding: "1rem" }}>
                            {m.status === "PENDING" && (
                              <span
                                style={{
                                  background: "rgba(245, 158, 11, 0.15)",
                                  border: "1px solid #F59E0B",
                                  color: "#D97706",
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
                                  color: "#059669",
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
                                  color: "#EF4444",
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

                          <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 800, color: isDark ? "#FBBF24" : "#D97706" }}>
                              Rp {m.commissionPerReceipt} / struk
                            </span>
                          </td>

                          <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 800, color: "#0284C7" }}>
                              {m.totalTenantsAcquired} Tenant
                            </div>
                            <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginTop: "2px" }}>
                              📊 {m.totalReceiptsGenerated} Struk
                            </div>
                          </td>

                          <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 900, color: isDark ? "#34D399" : "#059669" }}>
                              Rp {m.totalCommissionEarned.toLocaleString("id-ID")}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: isDark ? "#64748B" : "#94A3B8" }}>
                              Dicairkan: Rp {m.commissionPaid.toLocaleString("id-ID")}
                            </div>
                            {sisaKomisi > 0 && (
                              <div style={{ fontSize: "0.75rem", color: "#EF4444", fontWeight: 700 }}>
                                Sisa: Rp {sisaKomisi.toLocaleString("id-ID")}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.8rem", color: isDark ? "#FFF" : "#0F172A" }}>
                              💳 {m.bankName} - {m.accountNumber}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: isDark ? "#64748B" : "#94A3B8" }}>a/n {m.accountName}</div>
                          </td>

                          <td style={{ padding: "1rem", textAlign: "right", whiteSpace: "nowrap" }}>
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
                                      color: "#EF4444",
                                    }}
                                  >
                                    ✕ Tolak
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setConfirmModal({
                                        isOpen: true,
                                        title: "Konfirmasi Pencairan Komisi",
                                        message: `Proses pencairan komisi untuk ${m.name} sebesar Rp ${sisaKomisi.toLocaleString("id-ID")} ke ${m.bankName} ${m.accountNumber} (a/n ${m.accountName})?`,
                                        confirmText: "Ya, Cairkan Sekarang",
                                        confirmVariant: "success",
                                        onConfirm: () => {
                                          setMarketingList((prev) =>
                                            prev.map((item) =>
                                              item.id === m.id ? { ...item, commissionPaid: item.totalCommissionEarned } : item
                                            )
                                          );
                                          setConfirmModal((c) => ({ ...c, isOpen: false }));
                                          showToast(
                                            "Pencairan Berhasil Diproses",
                                            `Komisi Rp ${sisaKomisi.toLocaleString("id-ID")} untuk ${m.name} berhasil dicairkan.`,
                                            "success"
                                          );
                                        },
                                      });
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
                                      style={{ padding: "0.4rem 0.55rem", fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B" }}
                                      title="Nonaktifkan Kemitraan"
                                    >
                                      Suspend
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleUpdateMarketingStatus(m.id, "ACTIVE")}
                                      className="btn-secondary"
                                      style={{ padding: "0.4rem 0.55rem", fontSize: "0.75rem", color: "#059669" }}
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
          <div className="superadmin-billing-grid">
            {/* Card Pasang QRIS Pusat */}
            <section
              className="glass-panel"
              style={{
                padding: "1.75rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(245, 158, 11, 0.25)" : "1px solid rgba(245, 158, 11, 0.2)",
                background: isDark ? undefined : "#FFFFFF",
              }}
            >
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: isDark ? "#FBBF24" : "#D97706", marginBottom: "0.5rem" }}>
                💳 Pasang QRIS Pembayaran Sewa SaaS Platform (Pusat OKESIH)
              </h2>
              <p style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                QRIS inilah yang otomatis dimunculkan kepada seluruh Tenant / Owner Warkop saat mereka melakukan penutupan toko/shift untuk menyetorkan biaya sewa Rp {saasFeePerReceipt}/struk + nominal kode unik alokasi mereka.
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
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.15)",
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
                    <label style={{ display: "block", fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.25rem" }}>
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
                        background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                        border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                        color: isDark ? "#FFF" : "#0F172A",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.25rem" }}>
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
                          background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                          border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                          color: isDark ? "#FFF" : "#0F172A",
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.25rem" }}>
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
                          background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                          border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                          color: isDark ? "#FFF" : "#0F172A",
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.25rem" }}>
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
                        background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                        border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                        color: isDark ? "#FFF" : "#0F172A",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={() => showToast("Upload QRIS Pusat", "Pilih file gambar QRIS resmi dari perangkat Anda untuk diunggah.", "info")}
                  className="btn-secondary"
                  style={{ flex: 1, fontSize: "0.85rem" }}
                >
                  📷 Upload Gambar QRIS Pusat Baru
                </button>
                <button
                  onClick={() => showToast("Konfigurasi Tersimpan", "Pengaturan QRIS dan Rekening Pusat OKESIH berhasil disimpan dan aktif secara global!", "success")}
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
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(56, 189, 248, 0.2)" : "1px solid rgba(14, 165, 233, 0.2)",
                background: isDark ? undefined : "#FFFFFF",
              }}
            >
              <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0284C7", marginBottom: "0.5rem" }}>
                🤖 Log Verifikasi Setoran Sewa (OCR AI)
              </h2>
              <p style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B", marginBottom: "1rem" }}>
                Pemeriksaan bukti transfer bank warkop yang dicocokkan otomatis dengan kode unik alokasi.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "6px",
                    background: isDark ? "rgba(16, 185, 129, 0.1)" : "#ECFDF5",
                    border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #A7F3D0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 800 }}>
                    <span style={{ color: isDark ? "#FFF" : "#0F172A" }}>Warkop Giras Nusantara</span>
                    <span style={{ color: "#059669" }}>✓ Valid (Rp 12.545)</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "3px" }}>
                    Kode Unik 145 klop • BCA Transfer • OCR Confidence: 98%
                  </div>
                </div>

                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "6px",
                    background: isDark ? "rgba(245, 158, 11, 0.1)" : "#FFFBEB",
                    border: isDark ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #FDE68A",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 800 }}>
                    <span style={{ color: isDark ? "#FFF" : "#0F172A" }}>Warkop Barokah 24 Jam</span>
                    <span style={{ color: "#D97706" }}>⏳ Masa Tenggang (Grace)</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "3px" }}>
                    Batas waktu pembayaran: 23:59 WIB malam ini (Kode Unik: 215)
                  </div>
                </div>

                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "6px",
                    background: isDark ? "rgba(16, 185, 129, 0.1)" : "#ECFDF5",
                    border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #A7F3D0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 800 }}>
                    <span style={{ color: isDark ? "#FFF" : "#0F172A" }}>Warkop Pojok Stadion</span>
                    <span style={{ color: "#059669" }}>✓ Valid (Rp 10.088)</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "3px" }}>
                    Kode Unik 338 klop • Mandiri Transfer • OCR Confidence: 99%
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB CONTENT 4: PARAMETER MASTER GLOBAL */}
        {activeTab === "platform_config" && (
          <div className="superadmin-settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Auto-Dismiss TV */}
            <div
              className="glass-panel"
              style={{
                padding: "1.75rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(56, 189, 248, 0.2)" : "1px solid rgba(14, 165, 233, 0.2)",
                background: isDark ? undefined : "#FFFFFF",
              }}
            >
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0284C7", marginBottom: "0.5rem" }}>
                ⏱️ Parameter Master: Auto-Dismiss Antrean TV
              </h3>
              <p style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                Berapa lama nomor antrean yang telah berstatus HIJAU (siap diantar) akan bertahan di seluruh Smart TV sebelum otomatis menghilang.
              </p>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
                {[30, 45, 60, 90, 120].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setGlobalDismissDuration(sec)}
                    disabled={isSettingsLoading || isSettingsSaving}
                    style={{
                      padding: "0.5rem 0.85rem",
                      borderRadius: "6px",
                      fontWeight: 800,
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      background: globalDismissDuration === sec ? "#0EA5E9" : isDark ? "rgba(15, 23, 42, 0.6)" : "#F1F5F9",
                      color: globalDismissDuration === sec ? "#FFF" : isDark ? "#94A3B8" : "#64748B",
                      border: globalDismissDuration === sec ? "1px solid #38BDF8" : isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    {sec} Detik
                  </button>
                ))}
              </div>

              <div style={{ fontSize: "0.75rem", color: isDark ? "#34D399" : "#059669", fontWeight: 600 }}>
                Durasi yang akan diterapkan: {globalDismissDuration} detik untuk seluruh layar TV
              </div>
            </div>

            {/* Tarif Pokok SaaS Platform */}
            <div
              className="glass-panel"
              style={{
                padding: "1.75rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(56, 189, 248, 0.2)" : "1px solid rgba(14, 165, 233, 0.2)",
                background: isDark ? undefined : "#FFFFFF",
              }}
            >
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: isDark ? "#FBBF24" : "#D97706", marginBottom: "0.5rem" }}>
                💰 Tarif Sewa Pokok Platform SaaS
              </h3>
              <p style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B", marginBottom: "1rem", lineHeight: 1.5 }}>
                Tarif sewa per-struk transaksi yang ditagihkan harian saat warkop tutup toko.
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: isDark ? "#94A3B8" : "#64748B" }}>Rp</span>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={saasFeePerReceipt}
                  onChange={(e) => setSaasFeePerReceipt(Number(e.target.value))}
                  style={{
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                    borderRadius: "8px",
                    padding: "0.5rem 0.75rem",
                    fontSize: "1.1rem",
                    fontWeight: 900,
                    color: isDark ? "#FBBF24" : "#D97706",
                    width: "120px",
                  }}
                />
                <span style={{ fontSize: "0.85rem", color: isDark ? "#94A3B8" : "#64748B" }}>/ struk bon tercetak</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.85rem", color: isDark ? "#94A3B8" : "#64748B" }}>Default Komisi Marketing:</span>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: isDark ? "#C084FC" : "#7C3AED" }}>Rp</span>
                <input
                  type="number"
                  min={0}
                  max={saasFeePerReceipt}
                  value={defaultCommissionRate}
                  onChange={(e) => setDefaultCommissionRate(Number(e.target.value))}
                  style={{
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(168, 85, 247, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                    borderRadius: "8px",
                    padding: "0.4rem 0.65rem",
                    fontSize: "1rem",
                    fontWeight: 900,
                    color: isDark ? "#C084FC" : "#7C3AED",
                    width: "90px",
                  }}
                />
                <span style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B" }}>/ struk</span>
              </div>

              <div style={{ paddingTop: "1rem", borderTop: isDark ? "1px solid rgba(255,255,255,.1)" : "1px solid rgba(15,23,42,.1)" }}>
                <button
                  type="button"
                  onClick={handleSavePlatformSettings}
                  disabled={isSettingsLoading || isSettingsSaving}
                  className="btn-primary"
                  style={{ width: "100%", opacity: isSettingsLoading || isSettingsSaving ? 0.65 : 1 }}
                >
                  {isSettingsSaving ? "Menyimpan parameter..." : isSettingsLoading ? "Memuat parameter..." : "Simpan & Terapkan Secara Global"}
                </button>
                <div style={{ marginTop: ".65rem", fontSize: ".72rem", color: isDark ? "#94A3B8" : "#64748B", textAlign: "center" }}>
                  {settingsUpdatedAt
                    ? `Terakhir disimpan ${new Date(settingsUpdatedAt).toLocaleString("id-ID")}`
                    : "Perubahan baru aktif setelah tombol simpan ditekan."}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>

    {/* MODAL 1: DAFTARKAN TENANT WARKOP BARU */}
      {isRegisterModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
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
              background: isDark ? "#090E17" : "#FFFFFF",
              border: isDark ? "2px solid #0EA5E9" : "2px solid #0284C7",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.3)",
              borderRadius: "16px",
              maxHeight: "calc(100vh - 2rem)",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#0284C7" }}>
                  Daftarkan Tenant Baru
                </h2>
                <div style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B" }}>
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
              {/* Nama Usaha */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                  Nama Usaha
                </label>
                <input
                  type="text"
                  required
                  value={newWarkopName}
                  onChange={(e) => {
                    setNewWarkopName(e.target.value);
                    const autoSlug = e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
                    setNewSlug(autoSlug);
                  }}
                  placeholder="Contoh: Warkop Nusantara Jaya, Kafe Bahari, dll."
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "8px",
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                    color: isDark ? "#FFF" : "#0F172A",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
                {newWarkopName.trim() && (
                  <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.75rem", color: isDark ? "#7DD3FC" : "#0284C7" }}>
                    <span>🔗 URL Katalog Menu Otomatis:</span>
                    <span style={{ fontWeight: 800, background: isDark ? "rgba(148, 163, 184, 0.12)" : "rgba(2, 132, 199, 0.08)", padding: "0.15rem 0.5rem", borderRadius: "5px" }}>
                      okesih.com/menu/{newSlug || newWarkopName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}
                    </span>
                  </div>
                )}
              </div>

              {/* Wilayah */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                    Provinsi / Wilayah
                  </label>
                  <select
                    required
                    value={newProvince}
                    onChange={(e) => setNewProvince(e.target.value)}
                    style={{
                      width: "100%", padding: "0.75rem 1rem", borderRadius: "8px",
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                      color: isDark ? "#FFF" : "#0F172A", fontSize: "0.9rem",
                    }}
                  >
                    <option value="">Pilih provinsi</option>
                    {INDONESIA_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                    Kota / Kabupaten
                  </label>
                  <input
                    type="text"
                    required
                    value={newCityRegency}
                    onChange={(e) => setNewCityRegency(e.target.value)}
                    placeholder="Contoh: Kota Makassar"
                    style={{
                      width: "100%", padding: "0.75rem 1rem", borderRadius: "8px",
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                      color: isDark ? "#FFF" : "#0F172A", fontSize: "0.9rem",
                    }}
                  />
                </div>
              </div>

              {/* Rentang Kode Unik POS */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                  Tetapkan Rentang Kode Unik POS
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
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                    color: isDark ? "#FFF" : "#0F172A",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
                <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.25rem" }}>
                  Alokasi 3 digit unik untuk identifikasi mutasi otomatis QRIS kasir tenant ini.
                </div>
              </div>

              {/* Marketing Lapangan & Komisi Bagi Hasil */}
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#34D399" : "#059669", marginBottom: "0.35rem" }}>
                    Marketing Lapangan yang Mengakuisisi
                  </label>
                  <select
                    value={selectedMarketingId}
                    onChange={(e) => {
                      setSelectedMarketingId(e.target.value);
                      if (e.target.value === "direct") {
                        setTenantCommissionRate("");
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(16, 185, 129, 0.3)",
                      color: isDark ? "#FFF" : "#0F172A",
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
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#C084FC" : "#7C3AED", marginBottom: "0.35rem" }}>
                    Komisi Bagi Hasil (Rp/Struk)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={selectedMarketingId === "direct"}
                    value={selectedMarketingId === "direct" ? "0" : tenantCommissionRate}
                    onChange={(e) => setTenantCommissionRate(e.target.value)}
                    placeholder={`0 (Standar: Rp ${defaultCommissionRate})`}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: selectedMarketingId === "direct"
                        ? (isDark ? "rgba(148, 163, 184, 0.08)" : "#E2E8F0")
                        : (isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC"),
                      border: isDark ? "1px solid rgba(168, 85, 247, 0.4)" : "1px solid rgba(168, 85, 247, 0.3)",
                      color: selectedMarketingId === "direct"
                        ? (isDark ? "#64748B" : "#94A3B8")
                        : (isDark ? "#C084FC" : "#7C3AED"),
                      fontWeight: 800,
                      fontSize: "0.85rem",
                      outline: "none",
                      cursor: selectedMarketingId === "direct" ? "not-allowed" : "text",
                    }}
                  />
                  <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.25rem" }}>
                    {selectedMarketingId === "direct"
                      ? "Direct HQ (Tanpa komisi marketing)"
                      : !tenantCommissionRate || tenantCommissionRate.trim() === "0" || tenantCommissionRate.trim() === ""
                      ? `Kosong / 0 = Mengikuti standar global (Rp ${defaultCommissionRate}/struk)`
                      : `Komisi khusus: Rp ${tenantCommissionRate}/struk`}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                    Nama Pemilik / Owner
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
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                      color: isDark ? "#FFF" : "#0F172A",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                    Nomor WhatsApp Owner
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="081234567890"
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "8px",
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                      color: isDark ? "#FFF" : "#0F172A",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Kredensial Owner Otomatis */}
              <div
                style={{
                  background: isDark ? "rgba(14, 165, 233, 0.1)" : "#F0F9FF",
                  border: isDark ? "1px dashed rgba(14, 165, 233, 0.4)" : "1px dashed #38BDF8",
                  borderRadius: "8px",
                  padding: "1rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0284C7", marginBottom: "0.5rem" }}>
                  🔑 Kredensial Login Owner yang Di-generate Sistem:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                  <div>
                    <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Username: </span>
                    <strong style={{ color: isDark ? "#FFF" : "#0F172A" }}>{generatedUsername}</strong>
                  </div>
                  <div>
                    <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Password: </span>
                    <strong style={{ color: "#0284C7" }}>{generatedPassword}</strong>
                  </div>
                </div>
                <div style={{ fontSize: "0.7rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.5rem" }}>
                  *Owner dapat langsung login menggunakan kredensial ini tanpa verifikasi email ataupun OTP.
                </div>
              </div>

              <button
                type="submit"
                disabled={isTenantSaving}
                className="btn-primary"
                style={{
                  width: "100%",
                  padding: "0.9rem",
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  background: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                  marginTop: "0.5rem",
                  opacity: isTenantSaving ? 0.65 : 1,
                  cursor: isTenantSaving ? "wait" : "pointer",
                }}
              >
                {isTenantSaving ? "MENYIMPAN & MENGANTREKAN WHATSAPP..." : "✓ DAFTARKAN TENANT & SIMPAN"}
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
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
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
              background: isDark ? "#090E17" : "#FFFFFF",
              border: isDark ? "2px solid #10B981" : "2px solid #059669",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.3)",
              borderRadius: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#059669" }}>
                  Daftarkan Marketing Lapangan
                </h2>
                <div style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B" }}>
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
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
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
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                    color: isDark ? "#FFF" : "#0F172A",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
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
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                      color: isDark ? "#FFF" : "#0F172A",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
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
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                      color: isDark ? "#FFF" : "#0F172A",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
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
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                      color: "#059669",
                      fontWeight: 800,
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
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
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                      color: isDark ? "#FBBF24" : "#D97706",
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
                  background: isDark ? "rgba(16, 185, 129, 0.08)" : "#ECFDF5",
                  border: isDark ? "1px dashed rgba(16, 185, 129, 0.3)" : "1px dashed #10B981",
                  borderRadius: "8px",
                  padding: "1rem",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#059669", marginBottom: "0.5rem" }}>
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
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#FFFFFF",
                      border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(0, 0, 0, 0.12)",
                      color: isDark ? "#FFF" : "#0F172A",
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
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#FFFFFF",
                      border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(0, 0, 0, 0.12)",
                      color: isDark ? "#FFF" : "#0F172A",
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
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#FFFFFF",
                    border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(0, 0, 0, 0.12)",
                    color: isDark ? "#FFF" : "#0F172A",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ background: isDark ? "rgba(14, 165, 233, 0.1)" : "#F0F9FF", border: "1px dashed #38BDF8", borderRadius: "8px", padding: "1rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0284C7", marginBottom: "0.65rem" }}>
                  🔑 Kredensial login PWA Marketing — otomatis dikirim ke WhatsApp
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <input required value={newMarketingUsername} onChange={(e) => setNewMarketingUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} aria-label="Username marketing" style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #BAE6FD", background: isDark ? "#0F172A" : "#FFF", color: isDark ? "#FFF" : "#0F172A", fontWeight: 700 }} />
                  <input required value={newMarketingPassword} onChange={(e) => setNewMarketingPassword(e.target.value)} aria-label="Password awal marketing" style={{ padding: "0.6rem", borderRadius: "6px", border: "1px solid #BAE6FD", background: isDark ? "#0F172A" : "#FFF", color: "#0284C7", fontWeight: 700 }} />
                </div>
              </div>

              <button
                type="submit"
                disabled={isMarketingSaving}
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
                {isMarketingSaving ? "MENYIMPAN & MENGANTREKAN WHATSAPP..." : "✓ SIMPAN & KIRIM KE WHATSAPP"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: KREDENSIAL OWNER INSTAN (SETELAH TENANT DIDAFTARKAN) */}
      {newTenantCredentials && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(5px)",
            zIndex: 110,
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
              background: isDark ? "#090E17" : "#FFFFFF",
              border: isDark ? "2px solid #10B981" : "2px solid #059669",
              borderRadius: "16px",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 900, color: "#059669" }}>
                Tenant Berhasil Didaftarkan!
              </h2>
              <p style={{ fontSize: "0.85rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                Warkop siap beroperasi. Bagikan kredensial login resmi ini kepada pemilik warkop.
              </p>
            </div>

            <div
              style={{
                background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid rgba(0, 0, 0, 0.1)",
                borderRadius: "12px",
                padding: "1.25rem",
                marginBottom: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                fontSize: "0.875rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Nama Tenant:</span>
                <strong style={{ color: isDark ? "#FFF" : "#0F172A" }}>{newTenantCredentials.name}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Slug URL:</span>
                <span style={{ color: "#0284C7", fontWeight: 700 }}>/menu/{newTenantCredentials.slug}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Rentang Kode Unik:</span>
                <span style={{ fontWeight: 800 }}>{newTenantCredentials.uniqueCodeRange}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Mitra Marketing:</span>
                <span style={{ color: "#059669", fontWeight: 700 }}>{newTenantCredentials.marketingAgentName}</span>
              </div>

              <div
                style={{
                  marginTop: "0.5rem",
                  paddingTop: "0.85rem",
                  borderTop: isDark ? "1px dashed rgba(255, 255, 255, 0.15)" : "1px dashed rgba(0, 0, 0, 0.15)",
                }}
              >
                <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0284C7", marginBottom: "0.4rem" }}>
                  KREDENSIAL LOGIN OWNER INSTAN:
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                  <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Username:</span>
                  <code style={{ background: isDark ? "#06090E" : "#E2E8F0", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 800 }}>
                    {newTenantCredentials.username}
                  </code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Password:</span>
                  <code style={{ background: isDark ? "#06090E" : "#E2E8F0", padding: "0.15rem 0.5rem", borderRadius: "4px", color: "#0284C7", fontWeight: 800 }}>
                    {newTenantCredentials.password}
                  </code>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={() => {
                  const text = `*KREDENSIAL LOGIN WARKOP OKESIH*\nNama: ${newTenantCredentials.name}\nURL Menu: https://www.okesih.com/menu/${newTenantCredentials.slug}\nKode Unik: ${newTenantCredentials.uniqueCodeRange}\n\n*Username:* ${newTenantCredentials.username}\n*Password:* ${newTenantCredentials.password}\n\nSilakan login di https://www.okesih.com/login`;
                  navigator.clipboard.writeText(text);
                  showToast("Kredensial Disalin", "Teks informasi akun berhasil disalin ke clipboard.", "success");
                }}
                className="btn-primary"
                style={{
                  flex: 1,
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                }}
              >
                📋 Salin Kredensial Lengkap
              </button>
              <button
                type="button"
                onClick={() => setNewTenantCredentials(null)}
                className="btn-secondary"
                style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem", fontWeight: 700 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: KONFIRMASI MODERN (PENGGANTI WINDOW.CONFIRM) */}
      {confirmModal.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "460px",
              width: "100%",
              padding: "1.75rem",
              background: isDark ? "#090E17" : "#FFFFFF",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid rgba(0, 0, 0, 0.12)",
              borderRadius: "16px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
            }}
          >
            <h3
              style={{
                fontSize: "1.2rem",
                fontWeight: 900,
                color: isDark ? "#FFF" : "#0F172A",
                marginBottom: "0.5rem",
              }}
            >
              {confirmModal.title}
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: isDark ? "#94A3B8" : "#64748B",
                lineHeight: 1.5,
                marginBottom: "1.5rem",
              }}
            >
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirmModal((c) => ({ ...c, isOpen: false }))}
                className="btn-secondary"
                style={{ padding: "0.55rem 1rem", fontSize: "0.85rem", fontWeight: 700 }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="btn-primary"
                style={{
                  padding: "0.55rem 1.15rem",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  background:
                    confirmModal.confirmVariant === "danger"
                      ? "linear-gradient(135deg, #EF4444, #DC2626)"
                      : "linear-gradient(135deg, #10B981, #059669)",
                }}
              >
                {confirmModal.confirmText || "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
