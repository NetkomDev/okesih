"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { ownerFetch } from "./helpers";
import { useOwnerData } from "./provider";
import OwnerSkeleton from "./OwnerSkeleton";
type BusinessTable = { id: string; label: string; sort_order: number; is_active: boolean };
type StickerConfig = {
  qrSize: number;
  businessNameSize: number;
  businessNameOffsetX: number;
  businessNameAlign: "left" | "center" | "right";
  showLogo: boolean;
  logoSize: number;
  tableLabelSize: number;
  tableOffset: number;
  tableOffsetX: number;
  showBusinessName: boolean;
  showInstruction: boolean;
  instructionSize: number;
  instructionText: string;
  selectedTableId: string;
};
const DEFAULT_STICKER_CONFIG: StickerConfig = {
  qrSize: 180,
  businessNameSize: 18,
  businessNameOffsetX: 0,
  businessNameAlign: "center",
  showLogo: true,
  logoSize: 28,
  tableLabelSize: 60,
  tableOffset: 4,
  tableOffsetX: 0,
  showBusinessName: true,
  showInstruction: true,
  instructionSize: 12,
  instructionText: "Scan untuk melihat menu & memesan",
  selectedTableId: "",
};
function formatTableDisplay(label: string) {
  return (label || "").trim();
}
function renderMultilineBizName(name: string): string[] {
  const trimmed = (name || "").trim();
  if (!trimmed) return [];
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [trimmed];
  return words;
}
function validateImage(file: File, maxSize: number, label: string) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error(`${label} harus berupa PNG, JPG, atau WebP.`);
  if (file.size > maxSize) throw new Error(`${label} maksimal ${Math.round(maxSize / 1024 / 1024)} MB.`);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="owner-modal-backdrop"><div className="owner-modal"><header><h3>{title}</h3><button onClick={onClose}>×</button></header>{children}</div></div>;
}
export default function QrisTablesFeature() {
const { ready, data, setData, error, setError, notice, setNotice, busy, setBusy, loadDashboard, mutate } = useOwnerData("qris-tables");

const pathname = "/owner/qris-tables";
const [tableInput, setTableInput] = useState("");
const [merchantName, setMerchantName] = useState(data.profile.qris_merchant_name || data.profile.nama);
const [businessName, setBusinessName] = useState(data.profile.nama);
const [businessAddress, setBusinessAddress] = useState(data.profile.address || "");
const [editingTable, setEditingTable] = useState<BusinessTable | null>(null);
const [tableEditError, setTableEditError] = useState("");
const qrisInput = useRef<HTMLInputElement>(null);
const logoInput = useRef<HTMLInputElement>(null);
const [stickerConfig, setStickerConfig] = useState<StickerConfig>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("okesih_sticker_config");
        if (saved) return { ...DEFAULT_STICKER_CONFIG, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_STICKER_CONFIG;
  });
const [previewQrUrl, setPreviewQrUrl] = useState<string>("");
const [stickerConfigSaved, setStickerConfigSaved] = useState(false);
useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("okesih_sticker_config", JSON.stringify(stickerConfig));
      } catch {}
    }
  }, [stickerConfig]);
const saveStickerSettings = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("okesih_sticker_config", JSON.stringify(stickerConfig));
      } catch {}
    }
    setStickerConfigSaved(true);
    setTimeout(() => setStickerConfigSaved(false), 2500);
  };
useEffect(() => {
    if (pathname !== "/owner/qris-tables") return;
    let isMounted = true;
    const generatePreview = async () => {
      const slug = data?.profile?.slug || "sample";
      const selectedTable = data?.tables?.find(t => t.id === stickerConfig.selectedTableId) || data?.tables?.[0];
      const tableLabel = selectedTable?.label || "01";
      const origin = typeof window !== "undefined" ? window.location.origin : "https://okesih.com";
      // URL ringkas ?t= menghasilkan QR code Version 2 (25x25) dengan kotak-kotak yang jauh lebih besar & simpel
      const url = `${origin}/menu/${slug}?t=${encodeURIComponent(tableLabel)}`;
      try {
        const { default: QRCode } = await import("qrcode");
        const qr = await QRCode.toDataURL(url, {
          width: Math.max(260, stickerConfig.qrSize * 2),
          margin: 1,
          errorCorrectionLevel: "L", // Level L (Low) menghasilkan matriks paling renggang dengan modul kotak paling besar
        });
        if (isMounted) setPreviewQrUrl(qr);
      } catch (e) {
        console.error("Gagal generate preview QR:", e);
      }
    };
    void generatePreview();
    return () => { isMounted = false; };
  }, [pathname, data?.profile?.slug, data?.tables, stickerConfig.selectedTableId, stickerConfig.qrSize]);
const addTables = () => void mutate(async () => {
    const labels = tableInput.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    await ownerFetch("/api/owner/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labels }) });
    setTableInput("");
  }, "Daftar meja berhasil disimpan.");
const uploadQris = (file?: File) => {
    if (!file) return;
    void mutate(async () => {
      try {
        validateImage(file, 3 * 1024 * 1024, "QRIS");
        const form = new FormData();
        form.set("file", file);
        form.set("merchantName", merchantName.trim());
        await ownerFetch("/api/owner/qris", { method: "POST", body: form });
      } finally {
        if (qrisInput.current) qrisInput.current.value = "";
      }
    }, "QRIS berhasil diperbarui.");
  };
const uploadLogo = (file?: File) => {
    if (!file) return;
    void mutate(async () => {
      try {
        validateImage(file, 2 * 1024 * 1024, "Logo");
        const form = new FormData();
        form.set("file", file);
        await ownerFetch("/api/owner/branding", { method: "POST", body: form });
      } finally {
        if (logoInput.current) logoInput.current.value = "";
      }
    }, "Logo usaha berhasil diperbarui.");
  };
const saveBusinessIdentity = () => void mutate(
    () => ownerFetch("/api/owner/branding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName, address: businessAddress }) }),
    "Identitas dan alamat usaha berhasil disimpan."
  );
const saveMerchantName = () => void mutate(
    () => ownerFetch("/api/owner/qris", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ merchantName }) }),
    "Nama merchant berhasil disimpan."
  );
const updateTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTable) return;
    const cleanLabel = editingTable.label.trim().replace(/^meja\s+/i, "").trim() || editingTable.label.trim();
    if (!cleanLabel) {
      setTableEditError("Nama atau nomor meja tidak boleh kosong.");
      return;
    }

    setBusy(true);
    setTableEditError("");
    setError("");
    try {
      await ownerFetch("/api/owner/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTable.id, label: cleanLabel }),
      });

      

      setData((prev) => {
        if (!prev) return prev;
        const updatedTables = prev.tables
          .filter((t) => t.id === editingTable.id || t.label.toLowerCase() !== cleanLabel.toLowerCase())
          .map((t) => (t.id === editingTable.id ? { ...t, label: cleanLabel } : t));
        return { ...prev, tables: updatedTables };
      });

      setNotice(`Nama meja berhasil diganti menjadi "${formatTableDisplay(cleanLabel)}".`);
      setEditingTable(null);
      await loadDashboard();
    } catch (err) {
      setTableEditError(err instanceof Error ? err.message : "Gagal memperbarui nama meja.");
    } finally {
      setBusy(false);
    }
  };
const printTableStickers = async (singleTableId?: string) => {
  try {
    const printer = await import("./print-table-stickers");
    await printer.printTableStickers(data, stickerConfig, setError, singleTableId);
  } catch (reason) { setError(reason instanceof Error ? reason.message : "Stiker gagal disiapkan."); }
};
if (!ready) {
  if (error) return <div className="owner-error" role="alert">{error}</div>;
  return <OwnerSkeleton variant="qris-tables" />;
}
const { profile } = data;
return (<>{error && <div className="owner-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}{true && <section id="qris" className="owner-settings-grid owner-page-panel owner-qris-page">
            <article className="owner-panel owner-branding-panel">
              <h2>Identitas &amp; Logo Usaha</h2><p>Logo aktif otomatis tampil pada menu pelanggan, layar Kasir, dan layar Dapur. Jika belum diunggah, sistem menggunakan logo OKESIH.</p>
              <div className="owner-logo-preview"><img src={profile.logo_url || "/logo.svg?v=2"} alt={profile.logo_url ? `Logo ${profile.nama}` : "Logo OKESIH"}/></div>
              <label>Nama Usaha<input maxLength={150} value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></label>
              <label>Alamat Lengkap Usaha<textarea rows={3} maxLength={500} value={businessAddress} onChange={(event) => setBusinessAddress(event.target.value)} placeholder="Nama jalan, nomor, kelurahan/kecamatan" /></label>
              <button disabled={busy || businessName.trim().length < 2 || businessAddress.trim().length < 5 || (businessName.trim() === profile.nama && businessAddress.trim() === (profile.address || ""))} className="btn-secondary owner-save-field" onClick={saveBusinessIdentity}>Simpan Identitas Usaha</button>
              <input ref={logoInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadLogo(event.target.files?.[0])}/>
              <div className="owner-branding-actions"><button disabled={busy} className="btn-primary" onClick={() => logoInput.current?.click()}>{busy ? "Menyimpan..." : profile.logo_url ? "Ganti Logo Usaha" : "Upload Logo Usaha"}</button>{profile.logo_url && <button disabled={busy} className="btn-secondary" onClick={() => confirm("Hapus logo usaha dan gunakan logo OKESIH?") && void mutate(() => ownerFetch("/api/owner/branding", { method: "DELETE" }), "Logo usaha berhasil dihapus.")}>Gunakan Logo OKESIH</button>}</div>
              <small>PNG, JPG, atau WebP · Maksimal 2 MB · Disarankan rasio 1:1.</small>
            </article>

            <article className="owner-panel">
              <h2>QRIS Statis Toko</h2><p>Satu gambar aktif per tenant. Gambar baru otomatis menggantikan gambar lama tanpa duplikasi.</p>
              {profile.qris_image_url ? <img className="owner-qris-preview" src={profile.qris_image_url} alt={`QRIS ${profile.nama}`}/> : <div className="owner-qris-placeholder">Belum ada QRIS</div>}
              <label>Nama Merchant<input maxLength={180} value={merchantName} onChange={(event) => setMerchantName(event.target.value)} /></label>
              <button disabled={busy || !merchantName.trim() || merchantName.trim() === (profile.qris_merchant_name || profile.nama)} className="btn-secondary owner-save-field" onClick={saveMerchantName}>Simpan Nama Merchant</button>
              <input ref={qrisInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadQris(event.target.files?.[0])}/>
              <button disabled={busy || !merchantName.trim()} className="btn-primary" onClick={() => qrisInput.current?.click()}>{busy ? "Menyimpan..." : "Upload / Ganti QRIS"}</button>
            </article>

            <article className="owner-panel">
              <h2>Cetak Stiker QR Code Meja</h2><p>Masukkan nomor atau nama meja sesuai kondisi nyata, dipisahkan koma atau baris baru.</p>
              <div className="owner-table-input"><textarea rows={3} value={tableInput} onChange={(event) => setTableInput(event.target.value)} placeholder="Contoh: 01, 02, Teras 1, VIP"/><button disabled={busy || !tableInput.trim()} className="btn-primary" onClick={addTables}>Tambah Meja</button></div>
              <div className="owner-table-chips">{data.tables.map((table) => <span key={table.id}><Link target="_blank" href={`/menu/${profile.slug}?tableId=${encodeURIComponent(table.id)}`}>{formatTableDisplay(table.label)}</Link><button aria-label={`Edit meja ${table.label}`} onClick={() => { setTableEditError(""); setEditingTable({ ...table, label: table.label.replace(/^meja\s+/i, "") }); }}>✎</button><button aria-label={`Hapus meja ${table.label}`} onClick={() => confirm(`Hapus meja ${table.label}?`) && void mutate(() => ownerFetch(`/api/owner/tables?id=${table.id}`, { method: "DELETE" }), "Meja berhasil dihapus.")}>×</button></span>)}</div>
              <button className="btn-primary" disabled={!data.tables.length} onClick={() => void printTableStickers()}>🖨️ Cetak Semua Stiker QR Meja</button>
            </article>

            <article className="owner-panel owner-sticker-preview-card">
              <div className="owner-sticker-header">
                <div>
                  <h2>Preview &amp; Desain Stiker QR Meja</h2>
                  <p>Tata letak stiker otomatis disesuaikan secara live. Klik Simpan Desain agar pengaturan tersimpan permanen untuk cetak ulang kapan saja.</p>
                </div>
                <div className="owner-sticker-header-actions">
                  <button
                    type="button"
                    className="owner-sticker-tool-btn primary"
                    onClick={saveStickerSettings}
                    title="Simpan pengaturan desain ini"
                  >
                    <span className="tool-icon">{stickerConfigSaved ? "✓" : "💾"}</span>
                    <span>{stickerConfigSaved ? "Tersimpan" : "Simpan"}</span>
                  </button>
                  <button
                    type="button"
                    className="owner-sticker-tool-btn"
                    onClick={() => {
                      setStickerConfig({ ...DEFAULT_STICKER_CONFIG, selectedTableId: stickerConfig.selectedTableId });
                      if (typeof window !== "undefined") {
                        try {
                          localStorage.setItem("okesih_sticker_config", JSON.stringify({ ...DEFAULT_STICKER_CONFIG, selectedTableId: stickerConfig.selectedTableId }));
                        } catch {}
                      }
                      setStickerConfigSaved(true);
                      setTimeout(() => setStickerConfigSaved(false), 2000);
                    }}
                    title="Kembalikan ukuran dan posisi ke pengaturan default"
                  >
                    <span className="tool-icon">↺</span>
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Selector Meja Sampel */}
              <div className="owner-sticker-sample-bar">
                <label>
                  <span>Pilih Meja Contoh:</span>
                  <select
                    value={stickerConfig.selectedTableId}
                    onChange={(e) => setStickerConfig({ ...stickerConfig, selectedTableId: e.target.value })}
                  >
                    {data.tables.length === 0 ? (
                      <option value="">(Contoh Meja 01)</option>
                    ) : (
                      data.tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {formatTableDisplay(table.label)}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              {/* Live Preview Display Box */}
              <div className="owner-sticker-preview-viewport">
                <div className="owner-sticker-badge-live">● LIVE PREVIEW</div>
                <div className="owner-sticker-sheet">
                  <div
                    className="owner-sticker-top-row"
                    style={{ marginBottom: `${stickerConfig.tableOffset}px` }}
                  >
                    {stickerConfig.showBusinessName && (
                      <div
                        className="owner-sticker-biz-header"
                        style={{
                          transform: `translateX(${stickerConfig.businessNameOffsetX || 0}px)`,
                        }}
                      >
                        {stickerConfig.showLogo && profile.logo_url && (
                          <img
                            src={profile.logo_url}
                            alt="Logo Usaha"
                            className="owner-sticker-biz-logo"
                            style={{
                              width: `${stickerConfig.logoSize || 28}px`,
                              height: `${stickerConfig.logoSize || 28}px`,
                            }}
                          />
                        )}
                        <div
                          className="owner-sticker-biz-name"
                          style={{
                            fontSize: `${stickerConfig.businessNameSize}px`,
                            textAlign: stickerConfig.businessNameAlign || "center",
                          }}
                        >
                          {renderMultilineBizName(businessName || profile.nama).map((line, idx) => (
                            <div key={idx} style={{ lineHeight: 1.15 }}>{line}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div
                      className="owner-sticker-table-label"
                      style={{
                        fontSize: `${stickerConfig.tableLabelSize}px`,
                        transform: `translateX(${stickerConfig.tableOffsetX || 0}px)`,
                      }}
                    >
                      {formatTableDisplay((data.tables.find((t) => t.id === stickerConfig.selectedTableId) || data.tables[0])?.label || "01")}
                    </div>
                  </div>

                  <div className="owner-sticker-qr-wrapper">
                    {previewQrUrl ? (
                      <img
                        src={previewQrUrl}
                        alt="QR Code Meja"
                        style={{
                          width: `${stickerConfig.qrSize}px`,
                          height: `${stickerConfig.qrSize}px`,
                        }}
                      />
                    ) : (
                      <div
                        className="owner-sticker-qr-loading"
                        style={{
                          width: `${stickerConfig.qrSize}px`,
                          height: `${stickerConfig.qrSize}px`,
                        }}
                      >
                        Membuat QR simpel...
                      </div>
                    )}
                  </div>

                  {stickerConfig.showInstruction && (
                    <div
                      className="owner-sticker-instruction"
                      style={{ fontSize: `${stickerConfig.instructionSize}px` }}
                    >
                      {stickerConfig.instructionText || "Scan untuk melihat menu & memesan"}
                    </div>
                  )}
                </div>
              </div>

              {/* Real-time Controls */}
              <div className="owner-sticker-controls">
                {/* 1. Pengaturan Nama Usaha: Ukuran & Geser Horisontal Kiri-Kanan */}
                <div className="owner-sticker-control-row">
                  <div className="owner-sticker-control-group">
                    <div className="owner-sticker-control-header">
                      <span>Ukuran Nama Usaha</span>
                      <b>{stickerConfig.businessNameSize} px</b>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="30"
                      step="1"
                      value={stickerConfig.businessNameSize}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, businessNameSize: Number(e.target.value) })}
                    />
                    <div className="owner-sticker-slider-hints"><span>Kecil (12px)</span><span>Besar (30px)</span></div>
                  </div>

                  <div className="owner-sticker-control-group">
                    <div className="owner-sticker-control-header">
                      <span>Geser Posisi Horisontal Nama Usaha</span>
                      <b style={{ color: (stickerConfig.businessNameOffsetX || 0) === 0 ? "var(--accent)" : "inherit" }}>
                        {(stickerConfig.businessNameOffsetX || 0) === 0 ? "0 px (Center)" : `${(stickerConfig.businessNameOffsetX || 0) > 0 ? "+" : ""}${stickerConfig.businessNameOffsetX || 0} px`}
                      </b>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={stickerConfig.businessNameOffsetX || 0}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, businessNameOffsetX: Number(e.target.value) })}
                    />
                    <div className="owner-sticker-slider-hints">
                      <span>◄ Kiri (-50)</span>
                      <span style={{ fontWeight: 800, color: (stickerConfig.businessNameOffsetX || 0) === 0 ? "var(--accent)" : "var(--text-muted)" }}>0 (Center)</span>
                      <span>Kanan (+50) ►</span>
                    </div>
                  </div>
                </div>

                {/* 1b. Pengaturan Logo Usaha & Rata Teks Nama Usaha */}
                <div className="owner-sticker-control-row">
                  <div className="owner-sticker-control-group">
                    <div className="owner-sticker-control-header">
                      <span>Ukuran Logo Usaha</span>
                      <b>{stickerConfig.logoSize || 28} px</b>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="60"
                      step="2"
                      value={stickerConfig.logoSize || 28}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, logoSize: Number(e.target.value) })}
                    />
                    <div className="owner-sticker-slider-hints"><span>Kecil (16px)</span><span>Besar (60px)</span></div>
                  </div>

                  <div className="owner-sticker-control-group">
                    <div className="owner-sticker-control-header">
                      <span>Rata Teks Nama Usaha</span>
                      <b>{stickerConfig.businessNameAlign === "left" ? "Rata Kiri" : stickerConfig.businessNameAlign === "right" ? "Rata Kanan" : "Rata Tengah"}</b>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "2px" }}>
                      <button
                        type="button"
                        onClick={() => setStickerConfig({ ...stickerConfig, businessNameAlign: "left" })}
                        style={{
                          padding: "6px 4px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: (stickerConfig.businessNameAlign || "center") === "left" ? "#ea580c" : "var(--bg-surface-2)",
                          color: (stickerConfig.businessNameAlign || "center") === "left" ? "#ffffff" : "var(--text-muted)",
                          border: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                        }}
                      >
                        ⇤ Kiri
                      </button>
                      <button
                        type="button"
                        onClick={() => setStickerConfig({ ...stickerConfig, businessNameAlign: "center" })}
                        style={{
                          padding: "6px 4px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: (stickerConfig.businessNameAlign || "center") === "center" ? "#ea580c" : "var(--bg-surface-2)",
                          color: (stickerConfig.businessNameAlign || "center") === "center" ? "#ffffff" : "var(--text-muted)",
                          border: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                        }}
                      >
                        ≡ Tengah
                      </button>
                      <button
                        type="button"
                        onClick={() => setStickerConfig({ ...stickerConfig, businessNameAlign: "right" })}
                        style={{
                          padding: "6px 4px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: (stickerConfig.businessNameAlign || "center") === "right" ? "#ea580c" : "var(--bg-surface-2)",
                          color: (stickerConfig.businessNameAlign || "center") === "right" ? "#ffffff" : "var(--text-muted)",
                          border: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                        }}
                      >
                        Kanan ⇥
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Pengaturan Nomor Meja / Kursi: Ukuran (min 50px, max 100px) & Geser Horisontal Kiri-Kanan */}
                <div className="owner-sticker-control-row">
                  <div className="owner-sticker-control-group">
                    <div className="owner-sticker-control-header">
                      <span>Ukuran Nomor Meja / Kursi</span>
                      <b>{stickerConfig.tableLabelSize} px</b>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="1"
                      value={stickerConfig.tableLabelSize}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, tableLabelSize: Number(e.target.value) })}
                    />
                    <div className="owner-sticker-slider-hints"><span>Kecil (50px)</span><span>Besar (100px)</span></div>
                  </div>

                  <div className="owner-sticker-control-group">
                    <div className="owner-sticker-control-header">
                      <span>Geser Posisi Horisontal Nomor Meja</span>
                      <b style={{ color: (stickerConfig.tableOffsetX || 0) === 0 ? "var(--accent)" : "inherit" }}>
                        {(stickerConfig.tableOffsetX || 0) === 0 ? "0 px (Center)" : `${(stickerConfig.tableOffsetX || 0) > 0 ? "+" : ""}${stickerConfig.tableOffsetX || 0} px`}
                      </b>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="1"
                      value={stickerConfig.tableOffsetX || 0}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, tableOffsetX: Number(e.target.value) })}
                    />
                    <div className="owner-sticker-slider-hints">
                      <span>◄ Kiri (-50)</span>
                      <span style={{ fontWeight: 800, color: (stickerConfig.tableOffsetX || 0) === 0 ? "var(--accent)" : "var(--text-muted)" }}>0 (Center)</span>
                      <span>Kanan (+50) ►</span>
                    </div>
                  </div>
                </div>

                {/* 3. Pengaturan Jarak Vertikal & Ukuran QR Code */}
                <div className="owner-sticker-control-row">
                  <div className="owner-sticker-control-group">
                    <div className="owner-sticker-control-header">
                      <span>Jarak Vertikal Meja ke QR Code</span>
                      <b>{stickerConfig.tableOffset} px</b>
                    </div>
                    <input
                      type="range"
                      min="-12"
                      max="30"
                      step="1"
                      value={stickerConfig.tableOffset}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, tableOffset: Number(e.target.value) })}
                    />
                    <div className="owner-sticker-slider-hints"><span>Mendekat (-12px)</span><span>Menjauh (+30px)</span></div>
                  </div>

                  <div className="owner-sticker-control-group">
                    <div className="owner-sticker-control-header">
                      <span>Ukuran QR Code</span>
                      <b>{stickerConfig.qrSize} px</b>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="260"
                      step="5"
                      value={stickerConfig.qrSize}
                      onChange={(e) => setStickerConfig({ ...stickerConfig, qrSize: Number(e.target.value) })}
                    />
                    <div className="owner-sticker-slider-hints"><span>Kecil (100px)</span><span>Besar (260px)</span></div>
                  </div>
                </div>

                <div className="owner-sticker-toggles">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                    <label className="owner-sticker-checkbox">
                      <input
                        type="checkbox"
                        checked={stickerConfig.showBusinessName}
                        onChange={(e) => setStickerConfig({ ...stickerConfig, showBusinessName: e.target.checked })}
                      />
                      <span>Tampilkan Nama Usaha</span>
                    </label>
                    {profile.logo_url && (
                      <label className="owner-sticker-checkbox">
                        <input
                          type="checkbox"
                          checked={stickerConfig.showLogo}
                          onChange={(e) => setStickerConfig({ ...stickerConfig, showLogo: e.target.checked })}
                        />
                        <span>Tampilkan Logo Usaha</span>
                      </label>
                    )}
                    <label className="owner-sticker-checkbox">
                      <input
                        type="checkbox"
                        checked={stickerConfig.showInstruction}
                        onChange={(e) => setStickerConfig({ ...stickerConfig, showInstruction: e.target.checked })}
                      />
                      <span>Tampilkan Petunjuk Scan</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="owner-sticker-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!data.tables.length}
                  onClick={() => void printTableStickers()}
                >
                  🖨️ Cetak Semua Meja ({data.tables.length})
                </button>
                {data.tables.length > 0 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const cur = data.tables.find((t) => t.id === stickerConfig.selectedTableId) || data.tables[0];
                      if (cur) void printTableStickers(cur.id);
                    }}
                  >
                    Cetak {formatTableDisplay((data.tables.find((t) => t.id === stickerConfig.selectedTableId) || data.tables[0])?.label || "01")} Saja
                  </button>
                )}
              </div>
            </article>
          </section>}{editingTable && (
        <Modal title="Edit Nama Meja / Kursi" onClose={() => { setEditingTable(null); setTableEditError(""); }}>
          <form onSubmit={updateTable}>
            {tableEditError && (
              <div className="owner-error" style={{ marginBottom: "12px", padding: "10px 12px", fontSize: "12px" }}>
                {tableEditError}
              </div>
            )}
            <label className="owner-category-field">
              Nama / Nomor Urut
              <input
                required
                autoFocus
                maxLength={30}
                value={editingTable.label}
                onChange={(event) => {
                  setTableEditError("");
                  setEditingTable({ ...editingTable, label: event.target.value });
                }}
                placeholder="Contoh: 01, Kursi 01, Meja 1, VIP 1"
              />
              <small style={{ color: "var(--text-muted)", fontSize: "11px", marginTop: "4px" }}>
                Ketik nama atau nomor secara langsung sesuai keinginan Anda. Sistem akan menampilkan persis apa yang Anda tulis.
              </small>
            </label>
            <div className="owner-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => { setEditingTable(null); setTableEditError(""); }}
              >
                Batal
              </button>
              <button
                disabled={busy || !editingTable.label.trim()}
                className="btn-primary"
                type="submit"
              >
                {busy ? "Menyimpan ke Supabase..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </Modal>
      )}</>);
}
