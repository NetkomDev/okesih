"use client";
import ModalFrame from "./ModalFrame";
import { MobileDirectory, DirectoryDetail, useDirectoryPageSize } from "./MobileDirectory";
import Pagination from "@/components/Pagination";
import type { Pagination as PageInfo } from "@/lib/reporting";
import { randomDigits } from "@/lib/generated-credentials";
import CopyCredential from "./CopyCredential";
import AccessMessage from "./AccessMessage";
import { useCallback,useEffect,useState,useRef } from "react";
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
  membershipLevel: "COORDINATOR" | "MITRA";
  experienceNotes?: string;
  coordinatorName?: string;
  pendingWithdrawal?: number;
}
interface MarketingWithdrawal {
  id: string;
  amount: number;
  status: "PENDING" | "PAID" | "REJECTED";
  bank_name: string;
  bank_account_number: string;
  bank_account_name: string;
  notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  marketing_partners: { full_name: string; phone: string; referral_code: string } | null;
}
type MarketingFilterStatus = "ALL" | "PENDING" | "ACTIVE" | "INACTIVE";
export default function MarketingFeature() {
const { isDark, showToast, setConfirmModal, activeTab, createIntent, setCreateIntent, refreshSummary } = useSuperadmin();

const pageSize = useDirectoryPageSize();
const [marketingPage, setMarketingPage] = useState(1);
const [pagination, setPagination] = useState<PageInfo>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
const [counts, setCounts] = useState({ ALL: 0, ACTIVE: 0, PENDING: 0, INACTIVE: 0 });
const [directoryLoading, setDirectoryLoading] = useState(false);
const [directoryError, setDirectoryError] = useState("");
const requestSequence = useRef(0);
const [directoryRevision, setDirectoryRevision] = useState(0);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [marketingList, setMarketingList] = useState<MarketingAgent[]>([]);
const [accessMessageUrl, setAccessMessageUrl] = useState<string | null>(null);
const [accessTarget, setAccessTarget] = useState<AccountAccessTarget | null>(null);
const [marketingWithdrawals, setMarketingWithdrawals] = useState<MarketingWithdrawal[]>([]);
const [reviewingWithdrawalId, setReviewingWithdrawalId] = useState<string | null>(null);
const [marketingFilterStatus, setMarketingFilterStatus] = useState<MarketingFilterStatus>("ALL");
const [marketingSearchQuery, setMarketingSearchQuery] = useState<string>("");
const loadMarketingPartners = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setDirectoryLoading(true); setDirectoryError("");
    try {
      const params = new URLSearchParams({ page: String(marketingPage), pageSize: String(pageSize), search: marketingSearchQuery, status: marketingFilterStatus });
      const res = await fetch(`/api/superadmin/marketing?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Daftar mitra gagal dimuat.");
      if (requestId !== requestSequence.current) return;
      setPagination(json.pagination); setCounts(json.counts);
      if (json.pagination.page !== marketingPage) setMarketingPage(json.pagination.page);
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
          membership_level?: string;
          experience_notes?: string;
          coordinator_name?: string;
          pending_withdrawal?: number;
        }
        const mapped: MarketingAgent[] = json.data.map((row: RawMarketingPartner) => ({
          id: row.id,
          name: row.full_name,
          phone: row.phone,
          email: row.email,
          area: row.city_area,
          referralCode: row.referral_code,
          commissionPerReceipt: Number(row.commission_rate) || 0,
          bankName: row.bank_name,
          accountNumber: row.bank_account_number,
          accountName: row.bank_account_name,
          totalTenantsAcquired: row.total_tenants_acquired || 0,
          totalReceiptsGenerated: row.total_receipts_generated || 0,
          totalCommissionEarned: Number(row.total_commission_earned) || 0,
          commissionPaid: Number(row.commission_paid) || 0,
          status: row.status,
          membershipLevel: (row.membership_level === "COORDINATOR" || row.membership_level === "KOORDINATOR") ? "COORDINATOR" : "MITRA",
          experienceNotes: row.experience_notes,
          coordinatorName: row.coordinator_name,
          pendingWithdrawal: Number(row.pending_withdrawal) || 0,
        }));
        setMarketingList(mapped);
      }
    } catch (e) {
      if (requestId === requestSequence.current) setDirectoryError(e instanceof Error ? e.message : "Daftar mitra gagal dimuat.");
    } finally { if (requestId === requestSequence.current) setDirectoryLoading(false); }
  }, [marketingPage, pageSize, marketingSearchQuery, marketingFilterStatus]);
const confirmMarketingActivation = (id: string) => {
      const partner = marketingList.find(item => item.id === id);
      if (!partner) return;
      setConfirmModal({ isOpen: true, title: "Periksa penerima akses marketing", message: `Pastikan nomor ${partner.phone} benar-benar milik ${partner.name}. Jika salah, batalkan lalu gunakan Perbaiki WA & akses. Akun akan diaktifkan sebelum pesan WhatsApp dikirim.`, confirmText: "Nomor benar, aktifkan", confirmVariant: "success", onConfirm: async () => {
        setConfirmModal(current => ({ ...current, isOpen: false }));
        await handleUpdateMarketingStatus(id, "ACTIVE");
      } });
  };
const handleUpdateMarketingStatus = async (id: string, newStatus: "ACTIVE" | "INACTIVE") => {
    try {
      const res = await fetch("/api/superadmin/marketing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Server tidak dapat mengubah status mitra.");
      setDirectoryRevision(value => value + 1);
      showToast(
        "Status Marketing Diperbarui",
        payload.whatsappUrl
          ? "Akun marketing aktif. Kredensial siap dikirim melalui WhatsApp Anda."
          : `Status mitra marketing berhasil diubah menjadi ${newStatus}.`,
        "success"
      );
      if (payload.whatsappUrl) {
        setAccessMessageUrl(payload.whatsappUrl);
      }
    } catch (error) {
      showToast("Gagal Memperbarui", error instanceof Error ? error.message : "Terjadi kesalahan jaringan ke server.", "error");
    }
  };

  const handleToggleCoordinator = async (agent: MarketingAgent) => {
    const newLevel = agent.membershipLevel === "COORDINATOR" ? "MITRA" : "COORDINATOR";
    try {
      const res = await fetch("/api/superadmin/marketing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agent.id, membershipLevel: newLevel }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal mengubah level keanggotaan.");
      setDirectoryRevision(value => value + 1);
      showToast(
        "Level Kemitraan Diperbarui",
        newLevel === "COORDINATOR"
          ? `${agent.name} berhasil diangkat menjadi Koordinator Mitra. Fitur jaringan aktif.`
          : `Status ${agent.name} dikembalikan menjadi Mitra Marketing.`,
        "success"
      );
      if (payload.whatsappUrl) {
        window.location.assign(payload.whatsappUrl);
      }
    } catch (error) {
      showToast("Gagal Memperbarui", error instanceof Error ? error.message : "Terjadi kesalahan jaringan ke server.", "error");
    }
  };

  const handleDeleteMarketing = (agent: MarketingAgent) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Akun & Data Mitra Marketing",
      message: `Mitra "${agent.name}" (${agent.referralCode}) akan dihapus permanen beserta akun login, data rekening, dan riwayat mutasi komisinya.${
        agent.totalTenantsAcquired > 0
          ? ` Sebanyak ${agent.totalTenantsAcquired} tenant binaannya tetap aman dan beroperasi normal sebagai tenant langsung tanpa pemotongan komisi marketing.`
          : ""
      } Tindakan ini permanen dan tidak dapat dibatalkan. Lanjutkan?`,
      confirmText: "Ya, Hapus Permanen",
      confirmVariant: "danger",
      onConfirm: async () => {
        setConfirmModal((c) => ({ ...c, isOpen: false }));
        showToast("Menghapus Marketing", `Sedang menghapus mitra ${agent.name}...`, "info");
        try {
          const res = await fetch(`/api/superadmin/marketing?id=${encodeURIComponent(agent.id)}`, {
            method: "DELETE",
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload.error || "Gagal menghapus mitra marketing.");
          }
          setDirectoryRevision(value => value + 1);
          refreshSummary();
          showToast(
            "Marketing Berhasil Dihapus",
            `Mitra "${agent.name}" dan seluruh datanya berhasil dibersihkan dari database.`,
            "success"
          );
        } catch (err: unknown) {
          showToast(
            "Gagal Menghapus Marketing",
            err instanceof Error ? err.message : "Terjadi kesalahan saat menghapus mitra marketing.",
            "error"
          );
        }
      },
    });
  };
const loadMarketingWithdrawals = async () => {
    try {
      const response = await fetch("/api/superadmin/marketing-withdrawals", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pengajuan pencairan gagal dimuat.");
      setMarketingWithdrawals(payload.data || []);
    } catch (error) {
      console.error("Gagal memuat pencairan marketing:", error);
    }
  };
const reviewMarketingWithdrawal = async (id: string, decision: "PAID" | "REJECTED") => {
    setReviewingWithdrawalId(id);
    try {
      const response = await fetch("/api/superadmin/marketing-withdrawals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pengajuan pencairan gagal diproses.");
      await Promise.all([loadMarketingWithdrawals(), loadMarketingPartners()]);
      showToast(decision === "PAID" ? "Pencairan Selesai" : "Pencairan Ditolak", decision === "PAID" ? "Transfer dicatat dan saldo komisi marketing telah diperbarui." : "Saldo tertahan telah dikembalikan ke saldo tersedia.", "success");
    } catch (error) {
      showToast("Pencairan Gagal", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
    } finally {
      setReviewingWithdrawalId(null);
    }
  };
const [defaultCommissionRate, setDefaultCommissionRate] = useState<number | null>(null);
useEffect(() => {
  const controller = new AbortController();
  void fetch("/api/platform-settings", { signal: controller.signal, cache: "no-store" })
    .then(async response => { if (!response.ok) throw new Error("Parameter komisi gagal dimuat."); return response.json(); })
    .then(payload => { if (!controller.signal.aborted) setDefaultCommissionRate(payload.data.defaultMarketingCommission); })
    .catch(error => { if (!controller.signal.aborted) showToast("Parameter Belum Dimuat", error.message, "error"); });
  return () => controller.abort();
}, [showToast]);

const [isMarketingModalOpen, setIsMarketingModalOpen] = useState<boolean>(false);
const [newMarketingName, setNewMarketingName] = useState<string>("");
const [newMarketingPhone, setNewMarketingPhone] = useState<string>("");
const [newMarketingArea, setNewMarketingArea] = useState<string>("");
const [newMarketingCode, setNewMarketingCode] = useState<string>("");
const [newMarketingBank, setNewMarketingBank] = useState<string>("BCA");
const [newMarketingAccountNo, setNewMarketingAccountNo] = useState<string>("");
const [newMarketingAccountName, setNewMarketingAccountName] = useState<string>("");
const [newMarketingUsername, setNewMarketingUsername] = useState<string>("");
const [newMarketingPassword, setNewMarketingPassword] = useState<string>("");
const [isMarketingSaving, setIsMarketingSaving] = useState<boolean>(false);
const handleOpenMarketingModal = useCallback(() => {
    const suffix = randomDigits(3);
    setNewMarketingUsername(`marketing_${suffix}`);
    setNewMarketingPassword(randomDigits(6));
    setIsMarketingModalOpen(true);
  }, [setNewMarketingUsername, setNewMarketingPassword, setIsMarketingModalOpen]);
const handleCreateMarketing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarketingName.trim() || !newMarketingCode.trim()) {
      showToast("Form Belum Lengkap", "Harap isi Nama Marketing dan Kode Referral!", "error");
      return;
    }

    const newMkt: Omit<MarketingAgent, "commissionPerReceipt"> = {
      id: `mkt-${Date.now()}`,
      name: newMarketingName.trim(),
      phone: newMarketingPhone || "-",
      area: newMarketingArea || "Nasional",
      referralCode: newMarketingCode.toUpperCase().trim(),
      bankName: newMarketingBank,
      accountNumber: newMarketingAccountNo || "-",
      accountName: newMarketingAccountName || newMarketingName,
      totalTenantsAcquired: 0,
      totalReceiptsGenerated: 0,
      totalCommissionEarned: 0,
      commissionPaid: 0,
      status: "ACTIVE",
      membershipLevel: "MITRA",
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
      if (!payload.whatsappUrl) throw new Error("Tautan WhatsApp marketing gagal disiapkan.");
      setDirectoryRevision(value => value + 1); refreshSummary();
      setIsMarketingModalOpen(false);
      showToast("Marketing Berhasil Didaftarkan", `Kredensial ${newMkt.name} siap dikirim melalui WhatsApp Anda.`, "success");
      setAccessMessageUrl(payload.whatsappUrl);
    } catch (error) {
      showToast("Gagal Menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsMarketingSaving(false);
    }
  };
useEffect(() => { const timer = setTimeout(() => { void loadMarketingWithdrawals(); }, 0); return () => clearTimeout(timer); }, []);
useEffect(() => { if (createIntent !== "marketing") return; const timer = setTimeout(() => { handleOpenMarketingModal(); setCreateIntent(null); }, 0); return () => clearTimeout(timer); }, [createIntent, handleOpenMarketingModal, setCreateIntent]);
useEffect(() => {
  const invalidate = () => { requestSequence.current++; };
  const timer = setTimeout(() => void loadMarketingPartners(), 250);
  return () => { clearTimeout(timer); invalidate(); };
}, [loadMarketingPartners, directoryRevision]);
const selected = marketingList.find(m => m.id === selectedId);
const renderMarketingActions = (m: MarketingAgent) => <>
                            <button className="btn-secondary" style={{ marginBottom: 8, fontSize: 12 }} onClick={() => setAccessTarget({ kind: "MARKETING", id: m.id, name: m.name, phone: m.phone, canReset: m.status === "ACTIVE" })}>Perbaiki WA & akses</button>
                            <div style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end" }}>
                              {m.status === "PENDING" ? (
                                <>
                                  <button
                                    onClick={() => confirmMarketingActivation(m.id)}
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
                                  {m.status === "ACTIVE" ? (
                                    <>
                                      {m.membershipLevel === "COORDINATOR" ? (
                                        <button
                                          onClick={() => handleToggleCoordinator(m)}
                                          className="btn-secondary"
                                          style={{
                                            padding: "0.4rem 0.65rem",
                                            fontSize: "0.75rem",
                                            color: "#D97706",
                                            borderColor: "rgba(245, 158, 11, 0.4)",
                                            fontWeight: 700,
                                          }}
                                          title="Cabut Status Koordinator Mitra"
                                        >
                                          Cabut Koordinator
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleToggleCoordinator(m)}
                                          className="btn-secondary"
                                          style={{
                                            padding: "0.4rem 0.65rem",
                                            fontSize: "0.75rem",
                                            color: "#6366F1",
                                            borderColor: "rgba(99, 102, 241, 0.4)",
                                            fontWeight: 700,
                                            background: "rgba(99, 102, 241, 0.08)",
                                          }}
                                          title="Jadikan Koordinator Mitra"
                                        >
                                          👑 Jadikan Koordinator
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleUpdateMarketingStatus(m.id, "INACTIVE")}
                                        className="btn-secondary"
                                        style={{ padding: "0.4rem 0.55rem", fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B" }}
                                        title="Nonaktifkan Kemitraan"
                                      >
                                        Suspend
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => confirmMarketingActivation(m.id)}
                                      className="btn-secondary"
                                      style={{ padding: "0.4rem 0.55rem", fontSize: "0.75rem", color: "#059669" }}
                                      title="Aktifkan Kembali"
                                    >
                                      Aktifkan
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteMarketing(m)}
                                className="btn-secondary"
                                style={{
                                  padding: "0.4rem 0.65rem",
                                  fontSize: "0.75rem",
                                  color: "#EF4444",
                                  borderColor: "rgba(239, 68, 68, 0.4)",
                                  fontWeight: 700,
                                  background: "rgba(239, 68, 68, 0.08)",
                                }}
                                title="Hapus Akun & Seluruh Data Marketing"
                              >
                                Hapus
                              </button>
                            </div>

</>;
return (<>{accessMessageUrl && <AccessMessage url={accessMessageUrl} onClose={() => setAccessMessageUrl(null)} />}{accessTarget && <AccountAccessModal key={accessTarget.id} target={accessTarget} onClose={() => setAccessTarget(null)} onSaved={() => void loadMarketingPartners()} />}{activeTab === "marketing" && (
          <section
            className="glass-panel sa-directory-page"
            style={{
              padding: "1.75rem",
              borderRadius: "14px",
              border: isDark ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(16, 185, 129, 0.25)",
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
                  Kelola Mitra
                </h2>
                <div style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                  Tinjau pendaftaran, koordinator, dan tenant binaan.
                </div>
              </div>

              <div className="sa-partner-actions" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    loadMarketingPartners();
                    loadMarketingWithdrawals();
                    showToast("Data Dimuat Ulang", "Daftar mitra marketing telah diperbarui dari server.", "info");
                  }}
                  className="btn-secondary"
                  style={{ padding: "0.55rem 0.95rem", fontSize: "0.85rem", fontWeight: 700 }}
                >
                  Muat ulang
                </button>

                <button
                  onClick={() => {
                    const codeSuffix = Math.floor(Math.random() * 89) + 10;
                    setNewMarketingName("");
                    setNewMarketingPhone("");
                    setNewMarketingArea("");
                    setNewMarketingCode(`MKT-${codeSuffix}`);
                    setNewMarketingAccountNo("");
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
                  + Tambah Mitra
                </button>
              </div>
            </div>

            {marketingWithdrawals.filter((item) => item.status === "PENDING").length > 0 && (
              <div style={{ marginBottom: "1.25rem", padding: "1rem", borderRadius: "12px", background: isDark ? "rgba(16,185,129,.08)" : "#F0FDFA", border: "1px solid rgba(20,184,166,.35)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
                  <div><strong style={{ color: isDark ? "#5EEAD4" : "#0F766E" }}>Pengajuan Pencairan Komisi</strong><div style={{ marginTop: "2px", color: isDark ? "#94A3B8" : "#64748B", fontSize: "0.75rem" }}>Tandai sudah transfer hanya setelah dana benar-benar dikirim.</div></div>
                  <span style={{ padding: "0.2rem 0.6rem", borderRadius: "999px", background: "#0D9488", color: "#fff", fontSize: "0.75rem", fontWeight: 800 }}>{marketingWithdrawals.filter((item) => item.status === "PENDING").length} menunggu</span>
                </div>
                <div style={{ display: "grid", gap: "0.65rem" }}>
                  {marketingWithdrawals.filter((item) => item.status === "PENDING").map((item) => {
                    const marketing = Array.isArray(item.marketing_partners) ? item.marketing_partners[0] : item.marketing_partners;
                    const busy = reviewingWithdrawalId === item.id;
                    return <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", padding: "0.85rem", borderRadius: "10px", background: isDark ? "rgba(15,23,42,.78)" : "#fff", border: isDark ? "1px solid rgba(255,255,255,.08)" : "1px solid #99F6E4" }}>
                      <div><div style={{ color: isDark ? "#fff" : "#0F172A", fontWeight: 850 }}>{marketing?.full_name || "Marketing"} · Rp {Number(item.amount).toLocaleString("id-ID")}</div><div style={{ marginTop: "3px", color: isDark ? "#94A3B8" : "#64748B", fontSize: "0.75rem" }}>{marketing?.referral_code || "-"} · {marketing?.phone || "-"}</div><div style={{ marginTop: "3px", color: "#0D9488", fontSize: "0.72rem", fontWeight: 750 }}>{item.bank_name} · {item.bank_account_number} · a/n {item.bank_account_name}</div></div>
                      <div style={{ display: "flex", gap: "0.5rem" }}><button disabled={busy} onClick={() => void reviewMarketingWithdrawal(item.id, "REJECTED")} style={{ padding: "0.45rem 0.75rem", border: "1px solid #EF4444", borderRadius: "7px", background: "transparent", color: "#DC2626", fontWeight: 800 }}>Tolak</button><button disabled={busy} onClick={() => void reviewMarketingWithdrawal(item.id, "PAID")} style={{ padding: "0.45rem 0.8rem", border: 0, borderRadius: "7px", background: "#059669", color: "#fff", fontWeight: 800 }}>{busy ? "Memproses..." : "Sudah Transfer"}</button></div>
                    </div>;
                  })}
                </div>
              </div>
            )}

            {/* Filter & Pemetaan Wilayah Bar */}
            <div className="sa-partner-filters"
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
              <div className="sa-partner-status" role="group" aria-label="Filter status mitra" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700 }}>Status:</span>
                {[
                  { key: "ALL", label: `Semua (${counts.ALL})` },
                  { key: "PENDING", label: `⏳ Pendaftar Baru (${counts.PENDING})` },
                  { key: "ACTIVE", label: `● Aktif (${counts.ACTIVE})` },
                  { key: "INACTIVE", label: `✕ Nonaktif (${counts.INACTIVE})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    aria-pressed={marketingFilterStatus === tab.key}
                    onClick={() => { setMarketingFilterStatus(tab.key as MarketingFilterStatus); setMarketingPage(1); }}
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
              <div className="sa-search-field" style={{ minWidth: "260px" }}>
                <input
                  type="text"
                  aria-label="Cari mitra marketing" placeholder="Cari kota, wilayah, atau nama..."
                  value={marketingSearchQuery}
                  onChange={(e) => { setMarketingSearchQuery(e.target.value); setMarketingPage(1); }}
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

            </div>
            <div className="sa-directory-results">
            <MobileDirectory numericLast label="Daftar mitra" headers={["Nama mitra", "Wilayah", "Tenant"]} rows={marketingList.map(m => ({ id: m.id, name: m.name, second: m.area, third: m.totalTenantsAcquired, coordinator: m.membershipLevel === "COORDINATOR" }))} onSelect={setSelectedId} />
            <div className="superadmin-table-container sa-desktop-directory">
              <table className="sa-data-table" role="table" style={{ width: "100%", minWidth: "1150px", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead role="rowgroup">
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
                <tbody role="rowgroup">
                  {marketingList
                    .map((m) => {
                      const sisaKomisi = Math.max(0, m.totalCommissionEarned - m.commissionPaid - (m.pendingWithdrawal || 0));
                      return (
                        <tr
                          key={m.id}
                          style={{
                            borderBottom: isDark ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(0, 0, 0, 0.05)",
                          }}
                        >
                          <td role="cell" data-label="Mitra marketing" style={{ padding: "1rem" }}>
                            <div style={{ fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>{m.name}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexWrap: "wrap", marginTop: "3px" }}>
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
                                }}
                              >
                                {m.referralCode}
                              </span>
                              {m.membershipLevel === "COORDINATOR" ? (
                                <span
                                  style={{
                                    background: "rgba(99, 102, 241, 0.15)",
                                    border: "1px solid #6366F1",
                                    color: "#6366F1",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "4px",
                                    fontWeight: 800,
                                    fontSize: "0.7rem",
                                    display: "inline-block",
                                  }}
                                >
                                  👑 Koordinator Mitra
                                </span>
                              ) : (
                                <span
                                  style={{
                                    background: isDark ? "rgba(148, 163, 184, 0.15)" : "rgba(100, 116, 139, 0.1)",
                                    border: "1px solid rgba(148, 163, 184, 0.3)",
                                    color: isDark ? "#94A3B8" : "#64748B",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "4px",
                                    fontWeight: 700,
                                    fontSize: "0.7rem",
                                    display: "inline-block",
                                  }}
                                >
                                  Mitra Marketing
                                </span>
                              )}
                            </div>
                            {m.coordinatorName && <p style={{ fontSize: "0.8rem", marginTop: 6 }}>Binaan KorMit: <b>{m.coordinatorName}</b></p>}
                            {m.experienceNotes && (
                              <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "4px" }}>
                                💡 {m.experienceNotes}
                              </div>
                            )}
                          </td>

                          <td role="cell" data-label="WhatsApp & wilayah" style={{ padding: "1rem" }}>
                            <div style={{ color: isDark ? "#E2E8F0" : "#334155" }}>{m.phone}</div>
                            <div style={{ fontSize: "0.75rem", color: "#0284C7", fontWeight: 700, marginTop: "2px" }}>
                              📍 {m.area}
                            </div>
                          </td>

                          <td role="cell" data-label="Status akun" style={{ padding: "1rem" }}>
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

                          <td role="cell" data-label="Tarif komisi" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                            <span style={{ fontWeight: 800, color: isDark ? "#FBBF24" : "#D97706" }}>
                              Rp {m.commissionPerReceipt} / struk
                            </span>
                          </td>

                          <td role="cell" data-label="Performa" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 800, color: "#0284C7" }}>
                              {m.totalTenantsAcquired} Tenant
                            </div>
                            <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginTop: "2px" }}>
                              📊 {m.totalReceiptsGenerated} Struk
                            </div>
                          </td>

                          <td role="cell" data-label="Total komisi" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 900, color: isDark ? "#34D399" : "#059669" }}>
                              Rp {m.totalCommissionEarned.toLocaleString("id-ID")}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: isDark ? "#64748B" : "#94A3B8" }}>
                              Dicairkan: Rp {m.commissionPaid.toLocaleString("id-ID")}
                            </div>
                            {sisaKomisi > 0 && (
                              <div style={{ fontSize: "0.75rem", color: "#EF4444", fontWeight: 700 }}>
                                Tersedia: Rp {sisaKomisi.toLocaleString("id-ID")}
                              </div>
                            )}
                          </td>

                          <td role="cell" data-label="Rekening" style={{ padding: "1rem", whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 700, fontSize: "0.8rem", color: isDark ? "#FFF" : "#0F172A" }}>
                              💳 {m.bankName} - {m.accountNumber}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: isDark ? "#64748B" : "#94A3B8" }}>a/n {m.accountName}</div>
                          </td>

                          <td role="cell" data-label="Aksi mitra" style={{ padding: "1rem", textAlign: "right", whiteSpace: "nowrap" }}>
                            {renderMarketingActions(m)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {directoryError && <p role="alert">{directoryError} <button className="btn-secondary" onClick={() => void loadMarketingPartners()}>Coba lagi</button></p>}
            {directoryLoading && <p role="status">Memuat mitra…</p>}
            {!directoryLoading && !directoryError && !marketingList.length && <p className="sa-directory-empty">Tidak ada mitra yang cocok dengan pencarian.</p>}
            <Pagination pagination={pagination} onPage={setMarketingPage} loading={directoryLoading} />
            </div>
          </section>
        )}
{selected && <DirectoryDetail title={selected.name} subtitle={selected.membershipLevel === "COORDINATOR" ? "Koordinator Mitra" : "Mitra Marketing"} onClose={() => setSelectedId(null)} fields={[
  ["Status", selected.status === "ACTIVE" ? "Aktif" : selected.status === "PENDING" ? "Menunggu persetujuan" : "Nonaktif"],
  ["WhatsApp", selected.phone], ["Email", selected.email], ["Wilayah", selected.area], ["Kode referral", selected.referralCode],
  ["Koordinator perekrut", selected.coordinatorName], ["Tenant binaan langsung", selected.totalTenantsAcquired],
  ["Struk terkredit", selected.totalReceiptsGenerated], ["Tarif komisi langsung", `Rp ${selected.commissionPerReceipt.toLocaleString("id-ID")}/struk`],
  ["Total komisi", `Rp ${selected.totalCommissionEarned.toLocaleString("id-ID")}`], ["Sudah dibayar", `Rp ${selected.commissionPaid.toLocaleString("id-ID")}`],
  ["Pencairan menunggu", `Rp ${(selected.pendingWithdrawal || 0).toLocaleString("id-ID")}`],
  ["Saldo tersedia", `Rp ${Math.max(0, selected.totalCommissionEarned - selected.commissionPaid - (selected.pendingWithdrawal || 0)).toLocaleString("id-ID")}`],
  ["Bank", selected.bankName], ["Nomor rekening", selected.accountNumber], ["Nama pemilik rekening", selected.accountName], ["Catatan", selected.experienceNotes],
]} actions={renderMarketingActions(selected)} />}
{isMarketingModalOpen && (
        <ModalFrame label="Daftarkan marketing" onClose={() => setIsMarketingModalOpen(false)}>
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

              <div className="sa-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: isDark ? "#94A3B8" : "#475569", marginBottom: "0.35rem" }}>
                    Nomor WhatsApp
                  </label>
                  <input inputMode="tel"
                    type="tel"
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

              <div className="sa-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
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

                <div style={{ alignSelf: "center", fontSize: "0.85rem", lineHeight: 1.6 }}>
                  Komisi tenant langsung: <b>{defaultCommissionRate === null ? "Memuat parameter…" : `Rp ${defaultCommissionRate}/struk`}</b>. Tarif dan bonus KorMit diatur pada Parameter Master Global.
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
                <div className="sa-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "0.75rem", marginBottom: "0.5rem" }}>
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
                  <input inputMode="numeric"
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
                  🔑 Kredensial login PWA Marketing — siap disalin dan dikirim ke WhatsApp
                </div>
                <div className="sa-responsive-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <CopyCredential label="Username" value={newMarketingUsername} />
                  <CopyCredential label="Password" value={newMarketingPassword} />
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
                {isMarketingSaving ? "MENYIMPAN & MENYIAPKAN WHATSAPP..." : "✓ SIMPAN & KIRIM KE WHATSAPP"}
              </button>
            </form>
          </div>
        </ModalFrame>
      )}</>);
}
