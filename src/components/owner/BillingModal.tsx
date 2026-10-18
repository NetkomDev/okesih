"use client";
import { useEffect,useRef,useState } from "react";
import { ownerFetch } from "./helpers";

type OwnerBillingData = {
  activeBilling: {
    id: string;
    tanggal: string;
    totalTransactions: number;
    tagihanPokok: number;
    kodeUnik: number;
    totalTagihan: number;
    statusBayar: "UNPAID" | "PAID" | "PENDING_REVIEW";
    buktiTransferUrl: string | null;
    graceUntil: string | null;
    createdAt: string;
  } | null;
  recentBillings: Array<{
    id: string;
    tanggal: string;
    totalTransactions: number;
    tagihanPokok: number;
    kodeUnik: number;
    totalTagihan: number;
    statusBayar: "UNPAID" | "PAID" | "PENDING_REVIEW";
    buktiTransferUrl: string | null;
  }>;
  centralPayment: {
    qrisImageUrl: string;
    qrisMerchantName: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
    saasFeePerReceipt: number;
  };
  proofRetentionDays: number;
};
function money(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}
export default function BillingModal({ onClose, onPaid, setNotice }: { onClose: () => void; onPaid: () => Promise<void>; setNotice: (message: string) => void }) {
const isBillingModalOpen = true;
const setIsBillingModalOpen = (open: boolean) => { if (!open) onClose(); };
const [billingData, setBillingData] = useState<OwnerBillingData | null>(null);
const [isBillingLoading, setIsBillingLoading] = useState(false);
const [isBillingUploading, setIsBillingUploading] = useState(false);
const [billingProofFile, setBillingProofFile] = useState<File | null>(null);
const [billingProofPreview, setBillingProofPreview] = useState<string | null>(null);
const [billingError, setBillingError] = useState("");
const [billingWhatsAppUrl, setBillingWhatsAppUrl] = useState("");
const [copiedTotal, setCopiedTotal] = useState(false);
const billingFileInputRef = useRef<HTMLInputElement>(null);
const loadOwnerBilling = async () => {
    setIsBillingLoading(true);
    setBillingError("");
    try {
      const res = await ownerFetch("/api/owner/billing");
      setBillingData(res.data);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Gagal memuat rincian sewa.");
    } finally {
      setIsBillingLoading(false);
    }
  };
const handleSelectProofFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setBillingError("Format berkas harus PNG, JPG, atau WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBillingError("Ukuran berkas maksimal 5 MB.");
      return;
    }
    setBillingProofFile(file);
    setBillingError("");
    const reader = new FileReader();
    reader.onload = () => setBillingProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  };
const handleSubmitBillingProof = async () => {
    if (!billingProofFile) {
      setBillingError("Pilih foto bukti transfer bank terlebih dahulu.");
      return;
    }
    setIsBillingUploading(true);
    setBillingError("");
    setBillingWhatsAppUrl("");
    try {
      const form = new FormData();
      form.append("file", billingProofFile);
      if (billingData?.activeBilling?.id) {
        form.append("billingId", billingData.activeBilling.id);
      }
      const payload = await ownerFetch("/api/owner/billing", {
        method: "POST",
        body: form,
      });
      if (!payload.data?.whatsappUrl) throw new Error("Tautan WhatsApp Super Admin gagal disiapkan.");
      setBillingWhatsAppUrl(payload.data.whatsappUrl);
      setNotice("Bukti transfer lolos verifikasi. Kirim konfirmasi yang sudah disiapkan melalui WhatsApp Anda.");
      setBillingProofFile(null);
      setBillingProofPreview(null);
      await loadOwnerBilling();
      await onPaid();
      window.location.assign(payload.data.whatsappUrl);
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Gagal mengunggah bukti transfer.");
    } finally {
      setIsBillingUploading(false);
    }
  };
const copyToClipboard = (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedTotal(true);
      setTimeout(() => setCopiedTotal(false), 2000);
    }
  };
const saveBillingQris = async () => {
    const url = billingData?.centralPayment?.qrisImageUrl;
    if (!url) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("QRIS tidak dapat diunduh.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = "QRIS-OKESIH.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };
useEffect(() => { const timer = setTimeout(() => void loadOwnerBilling(), 0); return () => clearTimeout(timer); }, []);
return (isBillingModalOpen && (
        <div
          className="owner-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isBillingUploading) setIsBillingModalOpen(false);
          }}
        >
          <div className="owner-billing-modal">
            <header className="owner-billing-modal-header">
              <h3>
                Pembayaran Sewa SaaS
                <span className="owner-billing-modal-tag">Langganan Platform</span>
              </h3>
              <button
                type="button"
                className="owner-billing-modal-close"
                onClick={() => setIsBillingModalOpen(false)}
                disabled={isBillingUploading}
                title="Tutup Popup"
              >
                ×
              </button>
            </header>

            {billingError && (
              <div className="owner-error" style={{ margin: "14px 20px 0" }}>
                {billingError}
                <button type="button" onClick={() => setBillingError("")}>×</button>
              </div>
            )}

            {isBillingLoading ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ow-muted, #94a3b8)" }}>
                <span className="spinner" style={{ display: "inline-block", width: "26px", height: "26px", border: "2px solid rgba(245, 158, 11, 0.2)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <p style={{ marginTop: "12px", fontSize: "13px" }}>Memuat rincian tagihan sewa...</p>
              </div>
            ) : (
              <div className="owner-billing-modal-grid">
                {/* Kolom Kiri: Tagihan & QRIS */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Kartu Nominal Wajib Ditransfer */}
                  <div className="owner-billing-card is-highlight">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ow-muted)" }}>
                        Periode: {billingData?.activeBilling?.tanggal ? new Date(billingData.activeBilling.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Hari Ini"}
                      </span>
                      <span className={`owner-billing-status-badge ${billingData?.activeBilling?.statusBayar === "PAID" ? "paid" : billingData?.activeBilling?.statusBayar === "PENDING_REVIEW" ? "pending" : "unpaid"}`}>
                        {billingData?.activeBilling?.statusBayar === "PAID" ? "LUNAS" : billingData?.activeBilling?.statusBayar === "PENDING_REVIEW" ? "MENUNGGU REVIEW" : "BELUM BAYAR"}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "10px" }}>
                      <div>
                        <span style={{ display: "block", fontSize: "10px", fontWeight: 800, color: "var(--ow-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Total Wajib Ditransfer
                        </span>
                        <strong style={{ display: "block", marginTop: "2px", fontSize: "24px", fontWeight: 900, color: "#f59e0b", letterSpacing: "-0.02em" }}>
                          {money(billingData?.activeBilling?.totalTagihan || 20000)}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => copyToClipboard(String(billingData?.activeBilling?.totalTagihan || 20000))}
                        style={{ fontSize: "11px", padding: "6px 10px", height: "fit-content", borderRadius: "8px" }}
                      >
                        {copiedTotal ? "✓ Disalin" : "Salin Nominal"}
                      </button>
                    </div>

                    <p style={{ margin: "8px 0 0", fontSize: "10.5px", color: "var(--ow-muted)", lineHeight: 1.35 }}>
                      Transfer nominal <strong>persis sampai digit terakhir</strong> agar struk otomatis diverifikasi AI.
                    </p>
                  </div>

                  {/* Kartu QRIS Pembayaran */}
                  <div className="owner-billing-card" style={{ flex: 1, justifyContent: "space-between", alignItems: "center", textAlign: "center", padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", paddingBottom: "2px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", color: "var(--ow-muted)", textTransform: "uppercase" }}>
                        Scan QRIS Pembayaran
                      </span>
                      <span style={{ fontSize: "10px", color: "#10b981", fontWeight: 700 }}>
                        ● Siap Scan di Layar
                      </span>
                    </div>

                    {billingData?.centralPayment?.qrisImageUrl && (
                      <div className="owner-billing-qris-box">
                        <img
                          src={billingData.centralPayment.qrisImageUrl}
                          alt="QRIS OKESIH"
                          className="owner-billing-qris-frame"
                        />
                      </div>
                    )}

                    <div className="owner-billing-qris-footer">
                      <span style={{ fontSize: "11.5px", fontWeight: 800, color: "var(--ow-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {billingData?.centralPayment?.qrisMerchantName || "OKESIH PUSAT"}
                      </span>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void saveBillingQris()}
                        style={{ fontSize: "10.5px", padding: "5px 10px", whiteSpace: "nowrap" }}
                        title="Simpan berkas QRIS ke perangkat bila diperlukan"
                      >
                        ↓ Simpan
                      </button>
                    </div>
                  </div>
                </div>

                {/* Kolom Kanan: Upload Bukti & Riwayat */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Kartu Upload Bukti */}
                  <div className="owner-billing-card" style={{ gap: "10px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", color: "var(--ow-muted)", textTransform: "uppercase" }}>
                      Unggah Bukti Transfer
                    </div>

                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      ref={billingFileInputRef}
                      style={{ display: "none" }}
                      onChange={handleSelectProofFile}
                    />

                    {billingProofPreview ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--ow-surface)", padding: "10px", borderRadius: "10px", border: "1px dashed #f59e0b" }}>
                        <img
                          src={billingProofPreview}
                          alt="Bukti Preview"
                          style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {billingProofFile?.name || "Foto struk transfer"}
                          </span>
                          <small style={{ fontSize: "10px", color: "var(--ow-muted)" }}>Siap dianalisis sistem</small>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: "10px", padding: "4px 8px" }}
                          onClick={() => { setBillingProofFile(null); setBillingProofPreview(null); }}
                        >
                          Ganti
                        </button>
                      </div>
                    ) : billingData?.activeBilling?.buktiTransferUrl ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--ow-surface)", padding: "8px 10px", borderRadius: "10px", border: "1px solid var(--ow-border)" }}>
                        <img
                          src={billingData.activeBilling.buktiTransferUrl}
                          alt="Bukti Terkirim"
                          style={{ width: "42px", height: "42px", objectFit: "cover", borderRadius: "6px" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981", display: "block" }}>Bukti Telah Diunggah</span>
                          <small style={{ fontSize: "10px", color: "var(--ow-muted)" }}>
                            {billingData.activeBilling.statusBayar === "PAID" ? "Lolos verifikasi" : "Dalam antrean verifikasi"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: "10px", padding: "4px 8px" }}
                          onClick={() => billingFileInputRef.current?.click()}
                        >
                          Ganti
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="owner-billing-dropzone"
                        onClick={() => billingFileInputRef.current?.click()}
                      >
                        <span style={{ fontSize: "20px" }}>📸</span>
                        <strong style={{ fontSize: "12px", color: "var(--ow-text)" }}>Pilih Foto / Screenshot Struk</strong>
                        <span style={{ fontSize: "10px", color: "var(--ow-muted)" }}>Format PNG, JPG, WebP (Maks. 5 MB)</span>
                      </button>
                    )}

                    {billingProofFile && (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={isBillingUploading}
                        onClick={() => void handleSubmitBillingProof()}
                        style={{
                          padding: "10px",
                          borderRadius: "10px",
                          fontWeight: 800,
                          fontSize: "12px",
                          background: "#f59e0b",
                          border: "none",
                          color: "#000",
                          cursor: isBillingUploading ? "not-allowed" : "pointer",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        {isBillingUploading ? (
                          <>
                            <span className="spinner" style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                            Menganalisis Bukti...
                          </>
                        ) : (
                          "Analisis & Verifikasi Bukti"
                        )}
                      </button>
                    )}

                    {billingWhatsAppUrl && (
                      <a
                        href={billingWhatsAppUrl}
                        className="btn-primary"
                        style={{
                          padding: "10px",
                          borderRadius: "10px",
                          fontWeight: 800,
                          fontSize: "12px",
                          background: "#25D366",
                          color: "#fff",
                          textAlign: "center",
                          textDecoration: "none",
                        }}
                      >
                        💬 Buka Kembali WhatsApp Super Admin
                      </a>
                    )}

                    <small style={{ color: "var(--ow-muted)", fontSize: "9.5px", lineHeight: 1.35, textAlign: "center" }}>
                      Bukti disimpan aman setelah lolos verifikasi & dihapus permanen dalam {billingData?.proofRetentionDays || 90} hari.
                    </small>
                  </div>

                  {/* Kartu Riwayat Setoran Sewa Sebelumnya */}
                  <div className="owner-billing-card" style={{ flex: 1, gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.05em", color: "var(--ow-muted)", textTransform: "uppercase" }}>
                        Riwayat Setoran
                      </span>
                      {billingData?.recentBillings && (
                        <span style={{ fontSize: "10px", color: "var(--ow-muted)", fontWeight: 700 }}>
                          {billingData.recentBillings.length} transaksi
                        </span>
                      )}
                    </div>

                    <div className="owner-billing-history-scroll">
                      {billingData?.recentBillings && billingData.recentBillings.length > 0 ? (
                        billingData.recentBillings.slice(0, 4).map((b) => (
                          <div
                            key={b.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "6px 8px",
                              borderRadius: "8px",
                              background: "var(--ow-surface, #ffffff)",
                              border: "1px solid var(--ow-border, #e2e8f0)",
                              fontSize: "11px"
                            }}
                          >
                            <div>
                              <strong style={{ display: "block", color: "var(--ow-text)", fontSize: "11px" }}>
                                {new Date(b.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                              </strong>
                              <span style={{ color: "var(--ow-muted)", fontSize: "10px" }}>{money(Number(b.totalTagihan))}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span className={`owner-billing-status-badge ${b.statusBayar === "PAID" ? "paid" : b.statusBayar === "PENDING_REVIEW" ? "pending" : "unpaid"}`} style={{ fontSize: "9.5px", padding: "2px 6px" }}>
                                {b.statusBayar === "PAID" ? "LUNAS" : b.statusBayar === "PENDING_REVIEW" ? "MENUNGGU" : "BELUM"}
                              </span>
                              {b.buktiTransferUrl && (
                                <a
                                  href={b.buktiTransferUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: "10px", color: "#3b82f6", textDecoration: "underline" }}
                                >
                                  Bukti
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: "12px", textAlign: "center", color: "var(--ow-muted)", fontSize: "11px" }}>
                          Belum ada riwayat setoran sebelumnya.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ));
}
