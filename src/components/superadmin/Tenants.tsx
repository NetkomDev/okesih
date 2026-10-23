"use client";
import ModalFrame from "./ModalFrame";
import { MobileDirectory, DirectoryDetail, useDirectoryPageSize } from "./MobileDirectory";
import { randomDigits } from "@/lib/generated-credentials";
import CopyCredential from "./CopyCredential";
import AccessMessage from "./AccessMessage";
import Pagination from "@/components/Pagination";
import { INDONESIA_PROVINCES } from "@/lib/indonesia-regions";
import type { Pagination as PageInfo } from "@/lib/reporting";
import Link from "next/link";
import { useCallback,useEffect,useRef,useState } from "react";
import { useSuperadmin } from "./context";
import AccountAccessModal, { type AccountAccessTarget } from "./AccountAccessModal";
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
  address: string;
  province: string;
  cityRegency: string;
  uniqueCodeRange: string;
  marketingAgentId?: string;
  marketingAgentName?: string;
  commissionPerReceipt: number;
  todayTransactions: number;
  totalSaasBilling: number;
  paymentStatus: "PAID" | "UNPAID" | "GRACE_PERIOD";
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  joinedDate: string;
}
interface TenantApplication {
  id: string;
  business_name: string;
  owner_name: string;
  owner_phone: string;
  address: string;
  province: string;
  city_regency: string;
  status: "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED";
  review_notes?: string;
  created_at: string;
  marketing_partners: { full_name: string; phone: string; city_area: string; referral_code: string; commission_rate: number } | null;
}
interface NewTenantCredentials {
  name: string;
  slug: string;
  uniqueCodeRange: string;
  marketingAgentName: string;
  commissionPerReceipt: number;
  username: string;
  password: string;
  whatsappUrl: string;
}
export default function TenantsFeature() {
const { isDark, showToast, setConfirmModal, activeTab, totalTenants, setTotalTenants, createIntent, setCreateIntent , refreshSummary } = useSuperadmin();
const isAuthorized = true;
const [newTenantCredentials, setNewTenantCredentials] = useState<NewTenantCredentials | null>(null);
const [accessMessageUrl, setAccessMessageUrl] = useState<string | null>(null);
const [accessTarget, setAccessTarget] = useState<AccountAccessTarget | null>(null);
const [marketingList, setMarketingList] = useState<MarketingAgent[]>([]);
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
const pageSize = useDirectoryPageSize();
const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
const [tenants, setTenants] = useState<TenantWarkop[]>([]);
const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || null;
const [searchQuery, setSearchQuery] = useState("");
const [tenantRegionFilter, setTenantRegionFilter] = useState("ALL");
const [tenantPage, setTenantPage] = useState(1);
const [tenantPagination, setTenantPagination] = useState<PageInfo>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
const [tenantProvinces, setTenantProvinces] = useState<string[]>([]);
const [tenantLoading, setTenantLoading] = useState(false);
const [tenantError, setTenantError] = useState("");
const tenantRequest = useRef(0);
const [tenantApplications, setTenantApplications] = useState<TenantApplication[]>([]);
const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null);
const loadTenants = useCallback(async () => {
    const requestId = ++tenantRequest.current;
    setTenantLoading(true); setTenantError("");
    try {
      const params = new URLSearchParams({ page: String(tenantPage), pageSize: String(pageSize), search: searchQuery, province: tenantRegionFilter });
      const res = await fetch(`/api/superadmin/tenants?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Tenant gagal dimuat.");
      if (requestId !== tenantRequest.current) return;
      setTenants(json.data); setTenantPagination(json.pagination); setTotalTenants(json.totalTenants); setTenantProvinces(json.provinces);
      if (tenantPage > json.pagination.totalPages) setTenantPage(json.pagination.totalPages);
    } catch (error) {
      if (requestId === tenantRequest.current) setTenantError(error instanceof Error ? error.message : "Tenant gagal dimuat.");
    } finally { if (requestId === tenantRequest.current) setTenantLoading(false); }
  }, [tenantPage, pageSize, searchQuery, tenantRegionFilter, setTotalTenants]);
useEffect(() => {
    if (!isAuthorized) return;
    const invalidate = () => { tenantRequest.current++; };
    const timer = setTimeout(() => void loadTenants(), 250);
    return () => { clearTimeout(timer); invalidate(); };
  }, [isAuthorized, loadTenants]);
const loadTenantApplications = async () => {
    try {
      const response = await fetch("/api/superadmin/tenant-applications", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pengajuan tenant gagal dimuat.");
      setTenantApplications(payload.data || []);
    } catch (error) {
      console.error("Gagal memuat pengajuan tenant:", error);
    }
  };
const confirmTenantApproval = (id: string) => {
      const application = tenantApplications.find(item => item.id === id);
      if (!application) return;
      setConfirmModal({ isOpen: true, title: "Periksa penerima akses owner", message: `Pastikan nomor ${application.owner_phone} benar-benar milik ${application.owner_name} (${application.business_name}). Jika salah, batalkan lalu perbaiki nomor WA. Akun akan dibuat sebelum pesan WhatsApp dikirim.`, confirmText: "Nomor benar, verifikasi", confirmVariant: "success", onConfirm: async () => {
        setConfirmModal(current => ({ ...current, isOpen: false }));
        await reviewTenantApplication(id, "APPROVE");
      } });
  };
const reviewTenantApplication = async (id: string, decision: "APPROVE" | "REJECT") => {
    setReviewingApplicationId(id);
    try {
      const response = await fetch("/api/superadmin/tenant-applications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pengajuan gagal diproses.");
      if (decision === "APPROVE" && !payload.data?.whatsappUrl) throw new Error("Tautan WhatsApp owner gagal disiapkan.");
      await Promise.all([loadTenantApplications(), loadTenants(), loadMarketingPartners()]);
      showToast(decision === "APPROVE" ? "Tenant Disetujui" : "Pengajuan Ditolak", decision === "APPROVE" ? "Tenant dan akun owner dibuat. Pesan kredensial siap dikirim melalui WhatsApp Anda." : "Status pengajuan telah diperbarui.", "success");
      if (decision === "APPROVE" && payload.data?.whatsappUrl) {
        setAccessMessageUrl(payload.data.whatsappUrl);
      }
    } catch (error) {
      showToast("Review Gagal", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
    } finally {
      setReviewingApplicationId(null);
    }
  };
const [defaultCommissionRate, setDefaultCommissionRate] = useState<number>(15);
useEffect(() => {
  const controller = new AbortController();
  void fetch("/api/platform-settings", { signal: controller.signal, cache: "no-store" })
    .then(async response => { if (!response.ok) throw new Error("Parameter komisi gagal dimuat."); return response.json(); })
    .then(payload => { if (!controller.signal.aborted) setDefaultCommissionRate(payload.data.defaultMarketingCommission); })
    .catch(error => { if (!controller.signal.aborted) showToast("Parameter Belum Dimuat", error.message, "error"); });
  return () => controller.abort();
}, [showToast]);

const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
const [newWarkopName, setNewWarkopName] = useState<string>("");
const [newSlug, setNewSlug] = useState<string>("");
const [newOwnerName, setNewOwnerName] = useState<string>("");
const [newPhone, setNewPhone] = useState<string>("");
const [newAddress, setNewAddress] = useState<string>("");
const [newProvince, setNewProvince] = useState<string>("");
const [newCityRegency, setNewCityRegency] = useState<string>("");
const [newCodeRange, setNewCodeRange] = useState<string>("500 - 599");
const [selectedMarketingId, setSelectedMarketingId] = useState<string>("direct");
const [tenantCommissionRate, setTenantCommissionRate] = useState<string>("");
const [generatedUsername, setGeneratedUsername] = useState<string>("");
const [generatedPassword, setGeneratedPassword] = useState<string>("");
const [isTenantSaving, setIsTenantSaving] = useState<boolean>(false);
const handleOpenRegisterModal = useCallback(() => {
    const randomSuffix = randomDigits(3);
    setNewWarkopName("");
    setNewSlug("");
    setNewOwnerName("");
    setNewPhone("");
    setNewAddress("");
    setNewProvince("");
    setNewCityRegency("");
    setNewCodeRange(`${(totalTenants + 1) * 100} - ${(totalTenants + 1) * 100 + 99}`);
    setSelectedMarketingId("direct");
    setTenantCommissionRate(""); // default kosong (mengikuti standar global komisi)
    setGeneratedUsername(`owner_${randomSuffix}`);
    setGeneratedPassword(randomDigits(6));
    setIsRegisterModalOpen(true);
  }, [totalTenants, setNewWarkopName, setNewSlug, setNewOwnerName, setNewPhone, setNewAddress, setNewProvince, setNewCityRegency, setNewCodeRange, setSelectedMarketingId, setTenantCommissionRate, setIsRegisterModalOpen]);
const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWarkopName.trim() || !newOwnerName.trim() || !newPhone.trim() || !newAddress.trim() || !newProvince || !newCityRegency.trim()) {
      showToast("Form Belum Lengkap", "Nama usaha, owner, nomor WhatsApp, alamat, provinsi, dan kota/kabupaten wajib diisi.", "error");
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
      address: newAddress.trim(),
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
          address: newTenant.address,
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
      if (!payload.data?.whatsappUrl) throw new Error("Tautan WhatsApp owner gagal disiapkan.");
      await loadTenants(); refreshSummary();
      setIsRegisterModalOpen(false);
      setNewTenantCredentials({
        name: newTenant.name,
        slug: newTenant.slug,
        uniqueCodeRange: newTenant.uniqueCodeRange,
        marketingAgentName: newTenant.marketingAgentName || "Direct HQ",
        commissionPerReceipt: newTenant.commissionPerReceipt,
        username: payload.data.username,
        password: generatedPassword,
        whatsappUrl: payload.data.whatsappUrl,
      });
      showToast(
        "Tenant Berhasil Didaftarkan",
        `Pesan selamat datang dan kredensial ${newTenant.name} siap dikirim melalui WhatsApp Anda.`,
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

  const handleDeleteTenant = (tenant: TenantWarkop) => {
    setConfirmModal({
      isOpen: true,
      title: "Arsipkan Tenant dan Hapus Histori Keuangan",
      message: `Tenant "${tenant.name}" akan dinonaktifkan dan akses perangkat dicabut. Transaksi, billing, serta komisi terkait tenant dihapus permanen. Akun, katalog, dan pencairan mitra tetap disimpan. Lanjutkan?`,
      confirmText: "Arsipkan dan Hapus Histori",
      confirmVariant: "danger",
      onConfirm: async () => {
        setConfirmModal((c) => ({ ...c, isOpen: false }));
        showToast("Menghapus Tenant", `Sedang menghapus tenant ${tenant.name}...`, "info");
        try {
          const res = await fetch(`/api/superadmin/tenants?id=${encodeURIComponent(tenant.id)}`, {
            method: "DELETE",
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload.error || "Gagal menghapus tenant.");
          }
          await loadTenants();
          setTenantPagination((prev) => ({
            ...prev,
            total: Math.max(0, prev.total - 1),
          }));
          setTotalTenants(Math.max(0, totalTenants - 1));
          refreshSummary();
          showToast(
            "Tenant Berhasil Diarsipkan",
            `Tenant "${tenant.name}" diarsipkan dan histori keuangan terkait dihapus.`,
            "success"
          );
        } catch (err: unknown) {
          showToast(
            "Gagal Menghapus Tenant",
            err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus tenant.",
            "error"
          );
        }
      },
    });
  };

  const filteredTenants = tenants;
useEffect(() => { const timer = setTimeout(() => void loadTenantApplications(), 0); return () => clearTimeout(timer); }, []);
useEffect(() => { if (!isRegisterModalOpen) return; const timer = setTimeout(() => void loadMarketingPartners(), 0); return () => clearTimeout(timer); }, [isRegisterModalOpen]);
useEffect(() => { if (createIntent !== "tenant") return; const timer = setTimeout(() => { handleOpenRegisterModal(); setCreateIntent(null); }, 0); return () => clearTimeout(timer); }, [createIntent, handleOpenRegisterModal, setCreateIntent]);
const renderTenantActions = (t: TenantWarkop) => <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          <Link
                            href={`/menu/${t.slug}?table=01`}
                            target="_blank"
                            className="btn-secondary"
                            style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                          >
                            Cek QR Menu
                          </Link>
                          <button
                            disabled={t.status === "ARCHIVED"}
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
                            {t.status === "ARCHIVED" ? "Diarsipkan" : t.status === "ACTIVE" ? "Suspend" : "Aktifkan"}
                          </button>
                          <button
                            disabled={t.status === "ARCHIVED"}
                            onClick={() => handleDeleteTenant(t)}
                            title="Arsipkan dan Hapus Histori"
                            style={{
                              background: "rgba(239, 68, 68, 0.12)",
                              border: "1px solid #EF4444",
                              color: "#EF4444",
                              padding: "0.35rem 0.65rem",
                              borderRadius: "6px",
                              fontSize: "0.75rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            Hapus
                          </button>

</div>;
return (<>{accessMessageUrl && <AccessMessage url={accessMessageUrl} onClose={() => setAccessMessageUrl(null)} />}{accessTarget && <AccountAccessModal key={accessTarget.id} target={accessTarget} onClose={() => setAccessTarget(null)} onSaved={() => { void loadTenantApplications(); void loadTenants(); }} />}{activeTab === "tenants" && (
          <section
            className="glass-panel sa-directory-page"
            style={{
              padding: "1.75rem",
              borderRadius: "14px",
              border: isDark ? "1px solid rgba(56, 189, 248, 0.2)" : "1px solid rgba(14, 165, 233, 0.2)",
              background: isDark ? undefined : "#FFFFFF",
            }}
          >
            <div className="sa-directory-controls">
            <div className="sa-directory-heading"
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
                  Kelola Tenant
                </h2>
                <div style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                  Pantau tenant, status akun, dan mitra pengelola.
                </div>
              </div>

              <div className="sa-tenant-tools" style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <select
                  value={tenantRegionFilter}
                  onChange={(e) => { setTenantRegionFilter(e.target.value); setTenantPage(1); }}
                  aria-label="Filter tenant berdasarkan provinsi"
                  style={{
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                    padding: "0.55rem 0.75rem", color: isDark ? "#FFF" : "#0F172A", minWidth: "170px",
                  }}
                >
                  <option value="ALL">Semua wilayah</option>
                  {tenantProvinces.map((province) => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setTenantPage(1); }}
                  aria-label="Cari tenant" placeholder="Cari warkop, slug, owner..."
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
                  + Tambah Tenant
                </button>
              </div>
            </div>

            {tenantApplications.filter((item) => item.status === "PENDING" || item.status === "PROCESSING").length > 0 && (
              <div style={{ marginBottom: "1.5rem", padding: "1rem", borderRadius: "12px", background: isDark ? "rgba(245, 158, 11, 0.08)" : "#FFFBEB", border: "1px solid rgba(245, 158, 11, 0.35)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div><strong style={{ color: isDark ? "#FBBF24" : "#B45309" }}>Pengajuan Tenant Menunggu Verifikasi</strong><div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "2px" }}>Setujui untuk membuat tenant, akun owner, dan mengirim kredensial melalui WhatsApp Super Admin.</div></div>
                  <span style={{ background: "#F59E0B", color: "#fff", borderRadius: "999px", padding: "0.2rem 0.6rem", fontWeight: 800, fontSize: "0.75rem" }}>{tenantApplications.filter((item) => item.status === "PENDING" || item.status === "PROCESSING").length} baru</span>
                </div>
                <div style={{ display: "grid", gap: "0.65rem" }}>
                  {tenantApplications.filter((item) => item.status === "PENDING" || item.status === "PROCESSING").map((item) => {
                    const marketing = Array.isArray(item.marketing_partners) ? item.marketing_partners[0] : item.marketing_partners;
                    const busy = reviewingApplicationId === item.id || item.status === "PROCESSING";
                    return <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", padding: "0.85rem", borderRadius: "10px", background: isDark ? "rgba(15,23,42,.75)" : "#fff", border: isDark ? "1px solid rgba(255,255,255,.08)" : "1px solid #FDE68A" }}>
                      <div><div style={{ fontWeight: 850, color: isDark ? "#fff" : "#17211B" }}>{item.business_name}</div><div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "3px" }}>{item.owner_name} · +{item.owner_phone} · {item.address ? `${item.address}, ` : ""}{item.city_regency}, {item.province}</div><div style={{ fontSize: "0.72rem", color: "#059669", marginTop: "3px", fontWeight: 750 }}>Marketing: {marketing?.full_name || "-"} · {marketing?.referral_code || "-"} · {marketing?.phone || "-"}</div></div>
                      <div style={{ display: "flex", gap: "0.5rem" }}><button disabled={busy} onClick={() => void reviewTenantApplication(item.id, "REJECT")} style={{ border: "1px solid #EF4444", color: "#DC2626", background: "transparent", borderRadius: "7px", padding: "0.45rem 0.75rem", fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>Tolak</button><button disabled={busy} onClick={() => confirmTenantApproval(item.id)} style={{ border: 0, color: "#fff", background: "#059669", borderRadius: "7px", padding: "0.45rem 0.8rem", fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>{busy ? "Memproses..." : "Verifikasi & Aktifkan"}</button></div>
                      <button className="btn-secondary" disabled={busy} onClick={() => setAccessTarget({ kind: "APPLICATION", id: item.id, name: `${item.owner_name} — ${item.business_name}`, phone: item.owner_phone, canReset: false })}>Perbaiki nomor WA</button>
                    </div>;
                  })}
                </div>
              </div>
            )}

            </div>
            <div className="sa-directory-results">
            <MobileDirectory label="Daftar tenant" headers={["Nama tenant", "Kota", "Provinsi"]} rows={filteredTenants.map(t => ({ id: t.id, name: t.name, second: t.cityRegency, third: t.province }))} onSelect={setSelectedTenantId} />
            <div className="superadmin-table-container sa-desktop-directory">
              <table className="sa-data-table" role="table" style={{ width: "100%", minWidth: "1050px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead role="rowgroup">
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
                <tbody role="rowgroup">
                  {filteredTenants.map((t) => (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      <td role="cell" data-label="Tenant" style={{ padding: "1rem" }}>
                        <div style={{ fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>{t.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#0284C7", marginTop: "2px" }}>
                          🔗 /menu/{t.slug}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "4px" }}>
                          📍 {t.cityRegency}, {t.province}
                        </div>
                      </td>

                      <td role="cell" data-label="Owner & kontak" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, color: isDark ? "#E2E8F0" : "#334155" }}>{t.ownerName}</div>
                        <div style={{ fontSize: "0.75rem", color: isDark ? "#64748B" : "#94A3B8" }}>{t.phone}</div>
                        <button className="btn-secondary" style={{ marginTop: 8, fontSize: 12 }} onClick={() => setAccessTarget({ kind: "TENANT", id: t.id, name: `${t.ownerName} — ${t.name}`, phone: t.phone, canReset: t.status === "ACTIVE" })}>Perbaiki WA & akses</button>
                      </td>

                      <td role="cell" data-label="Kode POS" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
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

                      <td role="cell" data-label="Mitra marketing" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700, color: isDark ? "#34D399" : "#059669" }}>
                          {t.marketingAgentName || "Direct HQ"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: isDark ? "#C084FC" : "#7C3AED", fontWeight: 700, marginTop: "2px" }}>
                          Rp {t.commissionPerReceipt} / struk
                        </div>
                      </td>

                      <td role="cell" data-label="Struk & tagihan" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>
                          {t.todayTransactions} Struk
                        </div>
                        <div style={{ fontSize: "0.75rem", color: isDark ? "#FBBF24" : "#D97706", fontWeight: 800, marginTop: "2px" }}>
                          Rp {t.totalSaasBilling.toLocaleString("id-ID")}
                        </div>
                      </td>

                      <td role="cell" data-label="Status" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
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
                              {t.status === "ARCHIVED" ? "DIARSIPKAN" : "SUSPEND"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td role="cell" data-label="Aksi tenant" style={{ padding: "1rem", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          {renderTenantActions(t)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tenantError && <p role="alert">{tenantError}</p>}
            {tenantLoading && <p role="status">Memuat tenant...</p>}
            {!tenantLoading && !tenantError && !filteredTenants.length && <p className="sa-directory-empty">Tidak ada tenant yang cocok dengan pencarian.</p>}
            <Pagination pagination={tenantPagination} onPage={setTenantPage} loading={tenantLoading} />
            </div>
          </section>
        )}
{selectedTenant && <DirectoryDetail title={selectedTenant.name} subtitle="Detail tenant" onClose={() => setSelectedTenantId(null)} fields={[
  ["Status tenant", selectedTenant.status === "ACTIVE" ? "Aktif" : selectedTenant.status === "ARCHIVED" ? "Diarsipkan" : "Nonaktif"],
  ["Owner", selectedTenant.ownerName], ["WhatsApp owner", selectedTenant.phone], ["Alamat", selectedTenant.address],
  ["Kota / kabupaten", selectedTenant.cityRegency], ["Provinsi", selectedTenant.province], ["Kode POS", selectedTenant.uniqueCodeRange],
  ["Slug menu", selectedTenant.slug], ["Mitra pengelola", selectedTenant.marketingAgentName || "Direct HQ"],
  ["Tarif komisi", `Rp ${selectedTenant.commissionPerReceipt.toLocaleString("id-ID")}/struk`],
  ["Struk hari ini", selectedTenant.todayTransactions], ["Tagihan", `Rp ${selectedTenant.totalSaasBilling.toLocaleString("id-ID")}`],
  ["Status tagihan", selectedTenant.paymentStatus === "PAID" ? "Lunas" : "Belum lunas"], ["Bergabung", selectedTenant.joinedDate],
]} actions={<>
  <button className="btn-secondary" style={{ marginBottom: 8 }} onClick={() => setAccessTarget({ kind: "TENANT", id: selectedTenant.id, name: `${selectedTenant.ownerName} — ${selectedTenant.name}`, phone: selectedTenant.phone, canReset: selectedTenant.status === "ACTIVE" })}>Perbaiki WA & akses</button>
  {renderTenantActions(selectedTenant)}
</>} />}
{isRegisterModalOpen && (
        <ModalFrame label="Daftarkan tenant" onClose={() => setIsRegisterModalOpen(false)}>
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
              <div className="sa-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
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

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                  Alamat Lengkap Usaha
                </label>
                <textarea
                  required
                  rows={3}
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Nama jalan, nomor, kelurahan/kecamatan"
                  style={{
                    width: "100%", padding: "0.75rem 1rem", borderRadius: "8px", resize: "vertical",
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid rgba(0, 0, 0, 0.15)",
                    color: isDark ? "#FFF" : "#0F172A", fontSize: "0.9rem", outline: "none",
                  }}
                />
              </div>

              {/* Rentang Kode Unik POS */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                  Tetapkan Rentang Kode Unik POS
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input aria-label="Awal rentang kode unik" type="text" inputMode="numeric" pattern="[0-9]+" required value={newCodeRange.split("-")[0]?.trim() || ""} onChange={event => setNewCodeRange(`${event.target.value.replace(/\D/g, "")} - ${newCodeRange.split("-")[1]?.trim() || ""}`)} style={{ width: "45%", padding: "0.75rem", color: "inherit", background: "transparent" }} />
                  <span>–</span>
                  <input aria-label="Akhir rentang kode unik" type="text" inputMode="numeric" pattern="[0-9]+" required value={newCodeRange.split("-")[1]?.trim() || ""} onChange={event => setNewCodeRange(`${newCodeRange.split("-")[0]?.trim() || ""} - ${event.target.value.replace(/\D/g, "")}`)} style={{ width: "45%", padding: "0.75rem", color: "inherit", background: "transparent" }} />
                </div>
                <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "0.25rem" }}>
                  Alokasi 3 digit unik untuk identifikasi mutasi otomatis QRIS kasir tenant ini.
                </div>
              </div>

              {/* Marketing Lapangan & Komisi Bagi Hasil */}
              <div className="sa-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1rem" }}>
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
                  <input inputMode="numeric"
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

              <div className="sa-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
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
                <div className="sa-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.85rem" }}>
                  <CopyCredential label="Username" value={generatedUsername} />
                  <CopyCredential label="Password" value={generatedPassword} />
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
                {isTenantSaving ? "MENYIMPAN & MENYIAPKAN WHATSAPP..." : "✓ DAFTARKAN TENANT & KIRIM WHATSAPP"}
              </button>
            </form>
          </div>
        </ModalFrame>
      )}
{newTenantCredentials && (
        <ModalFrame label="Kredensial owner" onClose={() => setNewTenantCredentials(null)}>
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
                <CopyCredential label="Username" value={newTenantCredentials.username} />
                <CopyCredential label="Password" value={newTenantCredentials.password} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <a
                href={newTenantCredentials.whatsappUrl}
                className="btn-primary"
                style={{
                  flex: 1,
                  minWidth: "180px",
                  background: "linear-gradient(135deg, #25D366, #128C7E)",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                💬 Buka WhatsApp Owner
              </a>
              <button
                type="button"
                onClick={async () => {
                  const text = `*KREDENSIAL LOGIN WARKOP OKESIH*\nNama: ${newTenantCredentials.name}\nURL Menu: https://www.okesih.com/menu/${newTenantCredentials.slug}\nKode Unik: ${newTenantCredentials.uniqueCodeRange}\n\n*Username:* ${newTenantCredentials.username}\n*Password:* ${newTenantCredentials.password}\n\nSilakan login di https://www.okesih.com/login`;
                  try {
                    await navigator.clipboard.writeText(text);
                    showToast("Kredensial Disalin", "Teks informasi akun berhasil disalin ke clipboard.", "success");
                  } catch {
                    showToast("Salin manual", "Pilih teks username atau password untuk menyalin.", "error");
                  }
                }}
                className="btn-primary"
                style={{
                  flex: 1,
                  minWidth: "180px",
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
        </ModalFrame>
      )}</>);
}
