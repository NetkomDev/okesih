"use client";
import Image from "next/image";
import { useCallback,useEffect,useRef,useState } from "react";
import { useSuperadmin } from "./context";
export interface SaasBillingItem {
  id: string;
  warkopId: string;
  warkopName: string;
  warkopSlug: string;
  warkopLogo: string | null;
  phone?: string | null;
  tanggal: string;
  totalTransactions: number;
  tagihanPokok: number;
  kodeUnik: number;
  totalTagihan: number;
  statusBayar: "UNPAID" | "PAID" | "PENDING_REVIEW";
  statusBadge: "PAID" | "GRACE_PERIOD" | "PENDING_REVIEW" | "OVERDUE" | "UNPAID";
  buktiTransferUrl: string | null;
  ocrRawText: string | null;
  ocrBank: string;
  ocrConfidence: number;
  ocrNotes: string | null;
  graceUntil: string | null;
  createdAt: string;
}
export interface BillingSummary {
  totalBills: number;
  paidCount: number;
  totalPaidAmount: number;
  pendingCount: number;
}
export default function BillingFeature() {
const { isDark, showToast, activeTab , refreshSummary } = useSuperadmin();

const [saasFeePerReceipt, setSaasFeePerReceipt] = useState<number>(50);
const [centralQrisImage, setCentralQrisImage] = useState<string>("https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020101021126570014ID.LINKAJA.WWW01189360091100210001000215ID10293847565204549953033605802ID5920OKESIH+SAAS+PUSAT6007JAKARTA61051234062070703A016304");
const [centralQrisMerchant, setCentralQrisMerchant] = useState<string>("OKESIH SAAS PUSAT (BANK CENTRAL ASIA)");
const [centralBankName, setCentralBankName] = useState<string>("BCA");
const [centralBankAccountNumber, setCentralBankAccountNumber] = useState<string>("8001928374");
const [centralBankAccountName, setCentralBankAccountName] = useState<string>("PT OKESIH KARYA DIGITAL");
const [isCentralQrisSaving, setIsCentralQrisSaving] = useState<boolean>(false);
const [isCentralQrisUploading, setIsCentralQrisUploading] = useState<boolean>(false);
const qrisFileInputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
    let active = true;
    const loadPlatformSettings = async () => {
      try {
        const response = await fetch("/api/platform-settings", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Gagal memuat parameter global.");
        if (active) {
          setSaasFeePerReceipt(payload.data.saasFeePerReceipt);
          if (payload.data.qrisImageUrl) setCentralQrisImage(payload.data.qrisImageUrl);
          if (payload.data.qrisMerchantName) setCentralQrisMerchant(payload.data.qrisMerchantName);
          if (payload.data.bankName) setCentralBankName(payload.data.bankName);
          if (payload.data.bankAccountNumber) setCentralBankAccountNumber(payload.data.bankAccountNumber);
          if (payload.data.bankAccountName) setCentralBankAccountName(payload.data.bankAccountName);
        }
      } catch (error) {
        if (active) showToast("Parameter Belum Dimuat", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
      } finally {
      }
    };
    loadPlatformSettings();
    return () => { active = false; };
  }, [showToast]);
const [billingLogs, setBillingLogs] = useState<SaasBillingItem[]>([]);
const [billingSummary, setBillingSummary] = useState<BillingSummary>({ totalBills: 0, paidCount: 0, totalPaidAmount: 0, pendingCount: 0 });
const [isBillingsLoading, setIsBillingsLoading] = useState<boolean>(false);
const [billingFilter, setBillingFilter] = useState<"ALL" | "PAID" | "GRACE_PERIOD" | "PENDING_REVIEW" | "UNPAID">("ALL");
const [billingSearchQuery, setBillingSearchQuery] = useState<string>("");
const [isQrisConfigExpanded, setIsQrisConfigExpanded] = useState<boolean>(false);
const [selectedBillingDetail, setSelectedBillingDetail] = useState<SaasBillingItem | null>(null);
const [isBillingActionBusy, setIsBillingActionBusy] = useState<string | null>(null);
const handleSaveCentralQrisSettings = async () => {
    setIsCentralQrisSaving(true);
    try {
      const response = await fetch("/api/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrisImageUrl: centralQrisImage,
          qrisMerchantName: centralQrisMerchant,
          bankName: centralBankName,
          bankAccountNumber: centralBankAccountNumber,
          bankAccountName: centralBankAccountName,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Gagal menyimpan konfigurasi QRIS Pusat.");
      showToast("Konfigurasi Tersimpan", "Pengaturan QRIS dan Rekening Pusat OKESIH berhasil disimpan dan aktif secara global!", "success");
    } catch (error) {
      showToast("Gagal Menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsCentralQrisSaving(false);
    }
  };
const handleUploadCentralQris = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCentralQrisUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/superadmin/upload-qris", {
        method: "POST",
        body: formData,
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal mengunggah QRIS Pusat.");

      setCentralQrisImage(payload.data.qrisImageUrl);
      showToast("QRIS Pusat Diperbarui", "Gambar QRIS resmi pusat berhasil diunggah ke storage dan disimpan.", "success");
    } catch (err) {
      showToast("Gagal Upload QRIS", err instanceof Error ? err.message : "Terjadi kendala unggah berkas.", "error");
    } finally {
      setIsCentralQrisUploading(false);
      if (qrisFileInputRef.current) qrisFileInputRef.current.value = "";
    }
  };
const loadSaasBillings = useCallback(async () => {
    setIsBillingsLoading(true);
    try {
      const res = await fetch("/api/superadmin/saas-billings", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal memuat log setoran sewa.");
      setBillingLogs(payload.data?.billings || []);
      if (payload.data?.summary) setBillingSummary(payload.data.summary);
    } catch (err) {
      console.error("Gagal load saas-billings:", err);
    } finally {
      setIsBillingsLoading(false);
    }
  }, []);
useEffect(() => {
    if (activeTab === "qris_billing") {
      const timer = window.setTimeout(() => void loadSaasBillings(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeTab, loadSaasBillings]);
const handleApproveBilling = async (billingId: string, notes?: string) => {
    const reference = window.prompt("Masukkan nomor referensi transaksi dari mutasi rekening yang sudah Anda periksa:")?.trim();
    if (!reference) return;
    setIsBillingActionBusy(billingId);
    try {
      const res = await fetch("/api/superadmin/saas-billings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingId, action: "APPROVE", notes, reference }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal memverifikasi setoran.");
      showToast("Setoran Diverifikasi", payload.message || "Setoran warkop berhasil disetujui.", "success");
      await loadSaasBillings(); refreshSummary();
      if (selectedBillingDetail?.id === billingId) {
        setSelectedBillingDetail((prev) => prev ? { ...prev, statusBayar: "PAID", statusBadge: "PAID" } : null);
      }
    } catch (err) {
      showToast("Gagal Verifikasi", err instanceof Error ? err.message : "Terjadi kendala sistem.", "error");
    } finally {
      setIsBillingActionBusy(null);
    }
  };
const handleRejectBilling = async (billingId: string, notes?: string) => {
    setIsBillingActionBusy(billingId);
    try {
      const res = await fetch("/api/superadmin/saas-billings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingId, action: "REJECT", notes }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal memperbarui status.");
      showToast("Setoran Ditolak", payload.message || "Status setoran ditandai perlu review warkop.", "info");
      await loadSaasBillings(); refreshSummary();
      if (selectedBillingDetail?.id === billingId) {
        setSelectedBillingDetail((prev) => prev ? { ...prev, statusBayar: "UNPAID", statusBadge: "UNPAID" } : null);
      }
    } catch (err) {
      showToast("Gagal Memperbarui", err instanceof Error ? err.message : "Terjadi kendala sistem.", "error");
    } finally {
      setIsBillingActionBusy(null);
    }
  };
return (<>{activeTab === "qris_billing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* 1. KPI Strip Ringkasan Finansial Setoran Sewa */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "1rem",
              }}
            >
              <div
                className="glass-panel"
                style={{
                  padding: "1.1rem 1.25rem",
                  borderRadius: "12px",
                  background: isDark ? "rgba(15, 23, 42, 0.6)" : "#FFFFFF",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700 }}>
                  TOTAL ANTREAN SETORAN
                </div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: isDark ? "#FFF" : "#0F172A", marginTop: "4px" }}>
                  {billingLogs.length} <span style={{ fontSize: "0.85rem", fontWeight: 600, color: isDark ? "#94A3B8" : "#64748B" }}>Shift</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#0284C7", marginTop: "4px", fontWeight: 600 }}>
                  Tagihan sewa platform Rp {saasFeePerReceipt}/struk
                </div>
              </div>

              <div
                className="glass-panel"
                style={{
                  padding: "1.1rem 1.25rem",
                  borderRadius: "12px",
                  background: isDark ? "rgba(16, 185, 129, 0.08)" : "#ECFDF5",
                  border: isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #A7F3D0",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#065F46", fontWeight: 700 }}>
                  SETORAN LUNAS (TERVERIFIKASI)
                </div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#059669", marginTop: "4px" }}>
                  Rp {billingSummary.totalPaidAmount.toLocaleString("id-ID")}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#047857", marginTop: "4px", fontWeight: 700 }}>
                  ✓ {billingLogs.filter((b) => b.statusBadge === "PAID").length} warkop telah lunas
                </div>
              </div>

              <div
                className="glass-panel"
                style={{
                  padding: "1.1rem 1.25rem",
                  borderRadius: "12px",
                  background: isDark ? "rgba(245, 158, 11, 0.08)" : "#FFFBEB",
                  border: isDark ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid #FDE68A",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#92400E", fontWeight: 700 }}>
                  MASA TENGGANG (GRACE PERIOD)
                </div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#D97706", marginTop: "4px" }}>
                  {billingLogs.filter((b) => b.statusBadge === "GRACE_PERIOD").length} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Warkop</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#B45309", marginTop: "4px", fontWeight: 600 }}>
                  ⏳ Batas pembayaran hari ini sebelum shift baru
                </div>
              </div>

              <div
                className="glass-panel"
                style={{
                  padding: "1.1rem 1.25rem",
                  borderRadius: "12px",
                  background: isDark ? "rgba(59, 130, 246, 0.08)" : "#EFF6FF",
                  border: isDark ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid #BFDBFE",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#1E40AF", fontWeight: 700 }}>
                  PERLU REVIEW OCR / BELUM SETOR
                </div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#2563EB", marginTop: "4px" }}>
                  {billingLogs.filter((b) => b.statusBadge === "PENDING_REVIEW" || b.statusBadge === "UNPAID" || b.statusBadge === "OVERDUE").length} <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Menunggu</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#1D4ED8", marginTop: "4px", fontWeight: 600 }}>
                  ⚡ Verifikasi otomatis atau cek bukti transfer
                </div>
              </div>
            </div>

            {/* 2. Banner Rekening & QRIS SaaS Platform Pusat (Ringkas & Expandable) */}
            <section
              className="glass-panel"
              style={{
                padding: "1.25rem 1.5rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid rgba(245, 158, 11, 0.25)",
                background: isDark ? "rgba(15, 23, 42, 0.5)" : "#FFFFFF",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      background: "#FFFFFF",
                      borderRadius: "10px",
                      padding: "4px",
                      border: "2px solid #F59E0B",
                      boxShadow: "0 4px 12px rgba(245, 158, 11, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {centralQrisImage ? (
                      <Image
                        src={centralQrisImage}
                        width={190}
                        height={190}
                        unoptimized
                        alt="QRIS Pusat"
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ fontSize: "9px", color: "#64748B", textAlign: "center" }}>No QRIS</span>
                    )}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: isDark ? "#FBBF24" : "#D97706", margin: 0 }}>
                        💳 QRIS &amp; Rekening Setoran Sewa SaaS (Pusat OKESIH)
                      </h3>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          background: isDark ? "rgba(16, 185, 129, 0.2)" : "#ECFDF5",
                          color: "#059669",
                          padding: "2px 8px",
                          borderRadius: "99px",
                          border: "1px solid #10B981",
                        }}
                      >
                        ● Aktif untuk Seluruh Tenant
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "4px", fontSize: "0.78rem", color: isDark ? "#CBD5E1" : "#475569" }}>
                      <span>Bank: <strong style={{ color: isDark ? "#FFF" : "#0F172A" }}>{centralBankName || "BCA"}</strong></span>
                      <span>No. Rekening: <strong style={{ color: isDark ? "#FFF" : "#0F172A" }}>{centralBankAccountNumber || "-"}</strong></span>
                      <span>a.n: <strong style={{ color: isDark ? "#FFF" : "#0F172A" }}>{centralBankAccountName || "-"}</strong></span>
                      <span>Merchant: <strong style={{ color: isDark ? "#FFF" : "#0F172A" }}>{centralQrisMerchant || "-"}</strong></span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsQrisConfigExpanded(!isQrisConfigExpanded)}
                  className="btn-secondary"
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                  }}
                >
                  <span>{isQrisConfigExpanded ? "▲ Tutup Pengaturan" : "⚙️ Ubah QRIS & Rekening Pusat"}</span>
                </button>
              </div>

              {/* Panel Edit Expandable Form Konfigurasi QRIS */}
              {isQrisConfigExpanded && (
                <div
                  style={{
                    marginTop: "1.25rem",
                    paddingTop: "1.25rem",
                    borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E2E8F0",
                  }}
                >
                  <p style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B", marginBottom: "1rem" }}>
                    QRIS dan rekening ini otomatis ditampilkan kepada seluruh Tenant / Owner Warkop saat mereka melakukan penutupan toko/shift untuk menyetorkan biaya sewa Rp {saasFeePerReceipt}/struk + nominal kode unik alokasi mereka.
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "1.5rem", alignItems: "flex-start" }}>
                    {/* Upload & Preview */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "140px",
                          height: "155px",
                          background: "#FFF",
                          borderRadius: "10px",
                          padding: "6px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                          border: "2px solid #F59E0B",
                        }}
                      >
                        <div style={{ color: "#000", fontSize: "8px", fontWeight: 900, marginBottom: "3px" }}>
                          QRIS RESMI OKESIH HQ
                        </div>
                        <div
                          style={{
                            width: "95px",
                            height: "95px",
                            background: "#F8FAFC",
                            borderRadius: "6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          {centralQrisImage ? (
                            <Image
                              src={centralQrisImage}
                              width={95}
                              height={95}
                              unoptimized
                              alt="QRIS Pusat OKESIH"
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          ) : (
                            <span style={{ fontSize: "10px", color: "#64748B", textAlign: "center" }}>Belum Ada QRIS</span>
                          )}
                        </div>
                        <div style={{ color: "#475569", fontSize: "7.5px", fontWeight: 700, marginTop: "4px" }}>
                          NMID: ID1029384756520
                        </div>
                      </div>

                      <input
                        type="file"
                        ref={qrisFileInputRef}
                        onChange={handleUploadCentralQris}
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => qrisFileInputRef.current?.click()}
                        disabled={isCentralQrisUploading}
                        className="btn-secondary"
                        style={{ fontSize: "0.75rem", padding: "5px 10px", width: "100%" }}
                      >
                        {isCentralQrisUploading ? "⏳ Mengunggah..." : "📷 Upload Gambar Baru"}
                      </button>
                    </div>

                    {/* Inputs */}
                    <div>
                      <div style={{ marginBottom: "0.65rem" }}>
                        <label style={{ display: "block", fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.2rem" }}>
                          Nama Merchant Rekening Pusat
                        </label>
                        <input
                          type="text"
                          value={centralQrisMerchant}
                          onChange={(e) => setCentralQrisMerchant(e.target.value)}
                          placeholder="Contoh: OKESIH SAAS PUSAT (BANK CENTRAL ASIA)"
                          style={{
                            width: "100%",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "6px",
                            background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                            border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                            color: isDark ? "#FFF" : "#0F172A",
                            fontSize: "0.825rem",
                          }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.65rem" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.2rem" }}>
                            Bank Tujuan
                          </label>
                          <input
                            type="text"
                            value={centralBankName}
                            onChange={(e) => setCentralBankName(e.target.value)}
                            placeholder="Contoh: BCA"
                            style={{
                              width: "100%",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "6px",
                              background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                              border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                              color: isDark ? "#FFF" : "#0F172A",
                              fontSize: "0.825rem",
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.2rem" }}>
                            Nomor Rekening
                          </label>
                          <input inputMode="numeric"
                            type="text"
                            value={centralBankAccountNumber}
                            onChange={(e) => setCentralBankAccountNumber(e.target.value)}
                            placeholder="Contoh: 8001928374"
                            style={{
                              width: "100%",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "6px",
                              background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                              border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                              color: isDark ? "#FFF" : "#0F172A",
                              fontSize: "0.825rem",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: "0.85rem" }}>
                        <label style={{ display: "block", fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 700, marginBottom: "0.2rem" }}>
                          Atas Nama Rekening
                        </label>
                        <input
                          type="text"
                          value={centralBankAccountName}
                          onChange={(e) => setCentralBankAccountName(e.target.value)}
                          placeholder="Contoh: PT OKESIH KARYA DIGITAL"
                          style={{
                            width: "100%",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "6px",
                            background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                            border: isDark ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                            color: isDark ? "#FFF" : "#0F172A",
                            fontSize: "0.825rem",
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveCentralQrisSettings}
                        disabled={isCentralQrisSaving}
                        className="btn-primary"
                        style={{
                          background: "linear-gradient(135deg, #F59E0B, #D97706)",
                          fontSize: "0.825rem",
                          fontWeight: 800,
                          padding: "7px 18px",
                        }}
                      >
                        {isCentralQrisSaving ? "💾 Menyimpan..." : "💾 Simpan Konfigurasi QRIS Pusat"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Log Verifikasi Setoran Sewa (OCR AI) — LEBAR PENUH (100% FULL WIDTH) */}
            <section
              className="glass-panel"
              style={{
                padding: "1.75rem",
                borderRadius: "14px",
                border: isDark ? "1px solid rgba(56, 189, 248, 0.2)" : "1px solid rgba(14, 165, 233, 0.2)",
                background: isDark ? undefined : "#FFFFFF",
              }}
            >
              {/* Header Bagian Log Antrean */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "1rem",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0284C7", margin: 0 }}>
                      🤖 Log Verifikasi Setoran Sewa (OCR AI)
                    </h2>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        background: isDark ? "rgba(2, 132, 199, 0.2)" : "#E0F2FE",
                        color: "#0284C7",
                        padding: "3px 10px",
                        borderRadius: "99px",
                      }}
                    >
                      {billingLogs.length} Antrean Terdaftar
                    </span>
                  </div>
                  <p style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B", margin: "0.35rem 0 0" }}>
                    OCR membantu membaca nominal. Pelunasan hanya setelah Superadmin memeriksa penerimaan dana pada rekening.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => void loadSaasBillings()}
                    disabled={isBillingsLoading}
                    className="btn-secondary"
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 14px",
                    }}
                    title="Segarkan Log Setoran"
                  >
                    <span>{isBillingsLoading ? "Memuat..." : "🔄 Refresh Data"}</span>
                  </button>
                </div>
              </div>

              {/* Bilah Kontrol: Filter Tabs & Kotak Pencarian */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "1.25rem",
                  paddingBottom: "1rem",
                  borderBottom: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #E2E8F0",
                }}
              >
                {/* Filter Tabs */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[
                    { key: "ALL", label: `Semua (${billingLogs.length})` },
                    { key: "PAID", label: `✓ Valid Lunas (${billingLogs.filter((b) => b.statusBadge === "PAID").length})` },
                    { key: "GRACE_PERIOD", label: `⏳ Masa Tenggang (${billingLogs.filter((b) => b.statusBadge === "GRACE_PERIOD").length})` },
                    { key: "PENDING_REVIEW", label: `🔍 Perlu Review (${billingLogs.filter((b) => b.statusBadge === "PENDING_REVIEW").length})` },
                    { key: "UNPAID", label: `⚠️ Belum Bayar (${billingLogs.filter((b) => b.statusBadge === "UNPAID" || b.statusBadge === "OVERDUE").length})` },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setBillingFilter(tab.key as typeof billingFilter)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                        background: billingFilter === tab.key ? "#0284C7" : isDark ? "rgba(255,255,255,0.06)" : "#F1F5F9",
                        color: billingFilter === tab.key ? "#FFF" : isDark ? "#94A3B8" : "#64748B",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Input Pencarian Cepat Warkop / Tanggal */}
                <div style={{ minWidth: "240px", flex: "0 1 300px" }}>
                  <input
                    type="text"
                    value={billingSearchQuery}
                    onChange={(e) => setBillingSearchQuery(e.target.value)}
                    placeholder="🔍 Cari nama warkop / tanggal..."
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.85rem",
                      borderRadius: "8px",
                      background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid #CBD5E1",
                      color: isDark ? "#FFF" : "#0F172A",
                      fontSize: "0.8rem",
                    }}
                  />
                </div>
              </div>

              {/* List Log Setoran (Format Baris Lebar / Wide Cards) */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.85rem",
                  maxHeight: "680px",
                  overflowY: "auto",
                  paddingRight: "6px",
                }}
              >
                {isBillingsLoading && billingLogs.length === 0 ? (
                  <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: isDark ? "#94A3B8" : "#64748B", fontSize: "0.9rem" }}>
                    Sedang memuat data setoran sewa warkop...
                  </div>
                ) : billingLogs.length === 0 ? (
                  <div style={{ padding: "3rem 1.5rem", textAlign: "center", color: isDark ? "#94A3B8" : "#64748B", fontSize: "0.9rem", background: isDark ? "rgba(255,255,255,0.02)" : "#F8FAFC", borderRadius: "10px" }}>
                    Belum ada riwayat tagihan sewa warkop saat ini.
                  </div>
                ) : (
                  billingLogs
                    .filter((b) => {
                      if (billingFilter === "PAID" && b.statusBadge !== "PAID") return false;
                      if (billingFilter === "GRACE_PERIOD" && b.statusBadge !== "GRACE_PERIOD") return false;
                      if (billingFilter === "PENDING_REVIEW" && b.statusBadge !== "PENDING_REVIEW") return false;
                      if (billingFilter === "UNPAID" && b.statusBadge !== "UNPAID" && b.statusBadge !== "OVERDUE") return false;
                      if (billingSearchQuery.trim()) {
                        const q = billingSearchQuery.toLowerCase();
                        return (
                          b.warkopName.toLowerCase().includes(q) ||
                          b.tanggal.toLowerCase().includes(q) ||
                          String(b.kodeUnik).includes(q)
                        );
                      }
                      return true;
                    })
                    .map((item) => {
                      const isPaid = item.statusBadge === "PAID";
                      const isGrace = item.statusBadge === "GRACE_PERIOD";
                      const isPending = item.statusBadge === "PENDING_REVIEW";

                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: "1.1rem 1.35rem",
                            borderRadius: "10px",
                            background: isPaid
                              ? isDark ? "rgba(16, 185, 129, 0.06)" : "#F0FDF4"
                              : isGrace
                              ? isDark ? "rgba(245, 158, 11, 0.06)" : "#FFFBEB"
                              : isPending
                              ? isDark ? "rgba(59, 130, 246, 0.06)" : "#EFF6FF"
                              : isDark ? "rgba(239, 68, 68, 0.06)" : "#FEF2F2",
                            border: isPaid
                              ? isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #BBF7D0"
                              : isGrace
                              ? isDark ? "1px solid rgba(245, 158, 11, 0.35)" : "1px solid #FDE68A"
                              : isPending
                              ? isDark ? "1px solid rgba(59, 130, 246, 0.35)" : "1px solid #BFDBFE"
                              : isDark ? "1px solid rgba(239, 68, 68, 0.35)" : "1px solid #FECACA",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1.8fr 1.8fr 1.6fr 1.4fr auto",
                              alignItems: "center",
                              gap: "1.25rem",
                            }}
                          >
                            {/* Kolom 1: Profil Warkop & Tanggal Shift */}
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "1.05rem", fontWeight: 800, color: isDark ? "#FFF" : "#0F172A" }}>
                                  {item.warkopName}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.75rem", color: isDark ? "#94A3B8" : "#64748B", marginTop: "3px" }}>
                                📅 Tanggal: <b>{item.tanggal}</b> • 🧾 <b>{item.totalTransactions} struk</b>
                              </div>
                              {item.phone && (
                                <div style={{ fontSize: "0.7rem", color: isDark ? "#64748B" : "#94A3B8", marginTop: "2px" }}>
                                  📞 {item.phone}
                                </div>
                              )}
                            </div>

                            {/* Kolom 2: Rincian Finansial & Kode Unik */}
                            <div>
                              <div style={{ fontSize: "0.72rem", color: isDark ? "#94A3B8" : "#64748B" }}>
                                Pokok: Rp {item.tagihanPokok.toLocaleString("id-ID")} + Kode Unik:{" "}
                                <strong style={{ color: "#F59E0B" }}>+{item.kodeUnik}</strong>
                              </div>
                              <div
                                style={{
                                  fontSize: "1.2rem",
                                  fontWeight: 900,
                                  color: isPaid ? "#059669" : isGrace ? "#D97706" : "#DC2626",
                                  marginTop: "2px",
                                }}
                              >
                                Rp {item.totalTagihan.toLocaleString("id-ID")}
                              </div>
                              <div style={{ fontSize: "0.68rem", color: isDark ? "#64748B" : "#94A3B8" }}>
                                Total Tagihan Wajib Setor
                              </div>
                            </div>

                            {/* Kolom 3: Hasil OCR AI & Bank Terdeteksi */}
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#0284C7" }}>
                                  🤖 {item.ocrBank}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.65rem",
                                    fontWeight: 800,
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    background: item.ocrConfidence >= 90 ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                                    color: item.ocrConfidence >= 90 ? "#059669" : "#D97706",
                                  }}
                                >
                                  OCR: {item.ocrConfidence}%
                                </span>
                              </div>
                              <div style={{ fontSize: "0.72rem", color: isDark ? "#CBD5E1" : "#475569", marginTop: "3px" }}>
                                Kode unik alokasi: <b style={{ color: "#059669" }}>{item.kodeUnik} (Klop)</b>
                              </div>
                              <div style={{ fontSize: "0.68rem", color: item.buktiTransferUrl ? "#059669" : "#DC2626", marginTop: "2px" }}>
                                {item.buktiTransferUrl ? "🧾 Berkas bukti diunggah" : "⚠️ Bukti belum diunggah"}
                              </div>
                            </div>

                            {/* Kolom 4: Status Setoran & Batas Waktu */}
                            <div>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  fontSize: "0.75rem",
                                  fontWeight: 800,
                                  background: isPaid
                                    ? "#ECFDF5"
                                    : isGrace
                                    ? "#FFFBEB"
                                    : isPending
                                    ? "#EFF6FF"
                                    : "#FEF2F2",
                                  color: isPaid
                                    ? "#059669"
                                    : isGrace
                                    ? "#D97706"
                                    : isPending
                                    ? "#2563EB"
                                    : "#DC2626",
                                  border: isPaid
                                    ? "1px solid #10B981"
                                    : isGrace
                                    ? "1px solid #F59E0B"
                                    : isPending
                                    ? "1px solid #3B82F6"
                                    : "1px solid #EF4444",
                                }}
                              >
                                {isPaid
                                  ? "✓ Valid Lunas"
                                  : isGrace
                                  ? "⏳ Masa Tenggang"
                                  : isPending
                                  ? "🔍 Perlu Review"
                                  : "⚠️ Belum Disetor"}
                              </span>

                              {isGrace && item.graceUntil && (
                                <div style={{ fontSize: "0.7rem", color: "#D97706", fontWeight: 700, marginTop: "4px" }}>
                                  Batas: {new Date(item.graceUntil).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WITA
                                </div>
                              )}
                            </div>

                            {/* Kolom 5: Tombol Aksi Lengkap */}
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => setSelectedBillingDetail(item)}
                                className="btn-secondary"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: "0.75rem",
                                  fontWeight: 700,
                                }}
                                title="Lihat rincian lengkap & bukti transfer"
                              >
                                🔍 Detail
                              </button>

                              {!isPaid && (
                                <>


                                  <button
                                    type="button"
                                    onClick={() => handleApproveBilling(item.id)}
                                    disabled={isBillingActionBusy === item.id}
                                    style={{
                                      padding: "5px 12px",
                                      borderRadius: "6px",
                                      fontSize: "0.75rem",
                                      fontWeight: 800,
                                      background: "#059669",
                                      color: "#FFF",
                                      border: "none",
                                      cursor: "pointer",
                                    }}
                                    title="Setujui dan tandai lunas"
                                  >
                                    ✓ Lunas
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRejectBilling(item.id)}
                                    disabled={isBillingActionBusy === item.id}
                                    style={{
                                      padding: "5px 8px",
                                      borderRadius: "6px",
                                      fontSize: "0.75rem",
                                      fontWeight: 700,
                                      background: "rgba(239, 68, 68, 0.15)",
                                      color: "#DC2626",
                                      border: "1px solid rgba(239, 68, 68, 0.3)",
                                      cursor: "pointer",
                                    }}
                                    title="Tolak bukti setoran"
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </section>
          </div>
        )}
{selectedBillingDetail && (
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
                padding: "1.75rem",
                background: isDark ? "#090E17" : "#FFFFFF",
                border: "2px solid #0284C7",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.3)",
                borderRadius: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: isDark ? "#FFF" : "#0F172A", margin: 0 }}>
                    Bukti Setoran Sewa &amp; OCR AI
                  </h3>
                  <small style={{ color: "#0284C7", fontWeight: 700 }}>
                    {selectedBillingDetail.warkopName} · {selectedBillingDetail.tanggal}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBillingDetail(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: isDark ? "#94A3B8" : "#64748B",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              {/* Rincian Finansial Tagihan */}
              <div
                style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "#F8FAFC",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E2E8F0",
                  marginBottom: "1rem",
                  fontSize: "0.825rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Total Transaksi / Struk:</span>
                  <b>{selectedBillingDetail.totalTransactions} struk</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Tagihan Pokok Sewa:</span>
                  <span>Rp {selectedBillingDetail.tagihanPokok.toLocaleString("id-ID")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: isDark ? "#94A3B8" : "#64748B" }}>Kode Unik Alokasi:</span>
                  <b style={{ color: "#F59E0B" }}>+ Rp {selectedBillingDetail.kodeUnik}</b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed rgba(255,255,255,0.15)", paddingTop: "6px", fontWeight: 800 }}>
                  <span>Total Wajib Setor:</span>
                  <span style={{ color: "#059669", fontSize: "0.95rem" }}>
                    Rp {selectedBillingDetail.totalTagihan.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Preview Bukti Transfer & Hasil OCR */}
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "12px", marginBottom: "1.25rem" }}>
                <div
                  style={{
                    height: "140px",
                    background: "#000",
                    borderRadius: "8px",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {selectedBillingDetail.buktiTransferUrl ? (
                    <Image
                      src={selectedBillingDetail.buktiTransferUrl}
                      width={640}
                      height={360}
                      unoptimized
                      alt="Struk Transfer"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", padding: "8px", color: "#94A3B8", fontSize: "10px" }}>
                      🧾 Struk Belum Diupload
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: isDark ? "rgba(15,23,42,0.6)" : "#F1F5F9",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: "#0284C7", marginBottom: "4px" }}>🤖 Hasil Analisa OCR AI</div>
                    <div style={{ color: isDark ? "#CBD5E1" : "#334155", lineHeight: 1.5 }}>
                      • Bank: <b>{selectedBillingDetail.ocrBank}</b>
                      <br />
                      • Kecocokan Kode: <b>{selectedBillingDetail.kodeUnik} (Klop)</b>
                      <br />
                      • Keyakinan pembacaan teks: <b style={{ color: "#059669" }}>{selectedBillingDetail.ocrConfidence}%</b>
                    </div>
                  </div>
                  {selectedBillingDetail.ocrNotes && (
                    <div style={{ marginTop: "6px", fontSize: "0.7rem", color: isDark ? "#94A3B8" : "#64748B", fontStyle: "italic" }}>
                      &ldquo;{selectedBillingDetail.ocrNotes}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* Tombol Aksi Modal */}
              <div style={{ display: "flex", gap: "8px" }}>
                {selectedBillingDetail.statusBayar !== "PAID" && (
                  <>

                    <button
                      type="button"
                      onClick={() => handleApproveBilling(selectedBillingDetail.id)}
                      disabled={isBillingActionBusy === selectedBillingDetail.id}
                      className="btn-primary"
                      style={{ flex: 1, fontSize: "0.8rem", fontWeight: 800, background: "#059669" }}
                    >
                      ✓ Setujui Lunas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectBilling(selectedBillingDetail.id)}
                      disabled={isBillingActionBusy === selectedBillingDetail.id}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        background: "rgba(239, 68, 68, 0.15)",
                        color: "#DC2626",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        cursor: "pointer",
                      }}
                    >
                      Tolak
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedBillingDetail(null)}
                  className="btn-secondary"
                  style={{
                    padding: "8px 14px",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginLeft: selectedBillingDetail.statusBayar === "PAID" ? "auto" : undefined,
                  }}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}</>);
}
