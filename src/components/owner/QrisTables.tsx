"use client";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { ownerFetch } from "./helpers";
import { useOwnerData } from "./provider";
import OwnerSkeleton from "./OwnerSkeleton";
type BusinessTable = { id: string; label: string; sort_order: number; is_active: boolean };

function formatTableDisplay(label: string) {
  return (label || "").trim();
}

function validateImage(file: File, maxSize: number, label: string) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error(`${label} harus berupa PNG, JPG, atau WebP.`);
  if (file.size > maxSize) throw new Error(`${label} maksimal ${Math.round(maxSize / 1024 / 1024)} MB.`);
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="owner-modal-backdrop"><div className="owner-modal"><header><h3>{title}</h3><button onClick={onClose}>×</button></header>{children}</div></div>;
}
export default function QrisTablesFeature() {
const { ready, refreshing, data, setData, error, setError, notice, setNotice, busy, setBusy, loadDashboard, mutate } = useOwnerData("qris-tables");

const pathname = "/owner/qris-tables";
const [tableInput, setTableInput] = useState("");
const [merchantName, setMerchantName] = useState(data.profile.qris_merchant_name || data.profile.nama);
const [businessName, setBusinessName] = useState(data.profile.nama);
const [businessAddress, setBusinessAddress] = useState(data.profile.address || "");
const [editingTable, setEditingTable] = useState<BusinessTable | null>(null);
const [tableEditError, setTableEditError] = useState("");
const qrisInput = useRef<HTMLInputElement>(null);
const logoInput = useRef<HTMLInputElement>(null);
const [selectedTableChoice, setSelectedTableId] = useState<string>("");
const selectedTableId = data.tables.some(t => t.id === selectedTableChoice) ? selectedTableChoice : (data.tables[0]?.id || "");
const [pdfBusy, setPdfBusy] = useState(false);
const [pdfProgress, setPdfProgress] = useState("");
const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
const [previewLoading, setPreviewLoading] = useState(false);

useEffect(() => {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("okesih_sticker_config");
    } catch {}
  }
}, []);



useEffect(() => {
  if (pathname !== "/owner/qris-tables") return;
  let isMounted = true;

  const renderPreview = async () => {
    if (!previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://okesih.com";

    const activeTable =
      data?.tables?.find((t) => t.id === selectedTableId) ||
      data?.tables?.[0] || {
        id: "sample",
        label: "01",
        sort_order: 1,
        is_active: true,
      };

    const currentProfile = {
      ...data.profile,
      nama: (businessName || data.profile.nama || "OKESIH").trim(),
    };

    try {
      setPreviewLoading(true);
      const { renderTableSignToCanvas } = await import("@/lib/table-sign");
      if (!isMounted) return;
      await renderTableSignToCanvas(canvas, currentProfile, activeTable, origin);
    } catch (err) {
      console.error("Gagal merender preview papan meja:", err);
    } finally {
      if (isMounted) setPreviewLoading(false);
    }
  };

  void renderPreview();

  return () => {
    isMounted = false;
  };
}, [pathname, selectedTableId, data?.tables, data?.profile, businessName]);
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
const handleDownloadSinglePdf = async () => {
  const activeTable =
    data?.tables?.find((t) => t.id === selectedTableId) || data?.tables?.[0];
  if (!activeTable) {
    setError("Pilih meja terlebih dahulu.");
    return;
  }
  setPdfBusy(true);
  setError("");
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://okesih.com";
    const { downloadSingleTablePdf } = await import("@/lib/table-sign");
    await downloadSingleTablePdf(data.profile, activeTable, origin);
    setNotice(`PDF Papan Meja ${activeTable.label} berhasil diunduh.`);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Gagal mengunduh PDF meja.");
  } finally {
    setPdfBusy(false);
  }
};

const handleDownloadAllPdf = async () => {
  if (!data.tables.length) {
    setError("Belum ada meja yang terdaftar.");
    return;
  }
  setPdfBusy(true);
  setError("");
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://okesih.com";
    const { downloadAllTablesPdf } = await import("@/lib/table-sign");
    await downloadAllTablesPdf(data.profile, data.tables, origin, (current, total) => {
      setPdfProgress(`Membuat PDF: meja ${current} dari ${total}...`);
    });
    setNotice(`PDF Semua Meja (${data.tables.length} meja) berhasil diunduh.`);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Gagal mengunduh PDF semua meja.");
  } finally {
    setPdfBusy(false);
    setPdfProgress("");
  }
};

const handlePrintTableSigns = async (singleTableId?: string) => {
  if (!data.tables.length) {
    setError("Belum ada meja yang terdaftar untuk dicetak.");
    return;
  }
  setPdfBusy(true);
  setError("");
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://okesih.com";
    const { printTableSigns } = await import("@/lib/table-sign");
    await printTableSigns(data.profile, data.tables, origin, singleTableId);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Gagal membuka jendela cetak.");
  } finally {
    setPdfBusy(false);
  }
};
if (!ready) {
  if (error)
    return (
      <div className="owner-main">
        <div className="owner-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="owner-error-retry-btn"
            disabled={refreshing}
            onClick={() => { setError(""); void loadDashboard().catch(() => {}); }}
          >
            {refreshing ? "Memuat..." : "Coba lagi"}
          </button>
        </div>
        <OwnerSkeleton variant="qris-tables" />
      </div>
    );
  return <OwnerSkeleton variant="qris-tables" />;
}
const { profile } = data;
return (<>{error && <div className="owner-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}{true && <section id="qris" className="owner-settings-grid owner-page-panel owner-qris-page">
            <article className="owner-panel owner-branding-panel">
              <h2>Identitas &amp; Logo Bisnis</h2><p>Logo aktif otomatis tampil pada menu pelanggan, layar Kasir, dan layar Dapur. Jika belum diunggah, sistem menggunakan logo OKESIH.</p>
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
              <button className="btn-primary" disabled={!data.tables.length || pdfBusy} onClick={() => void handlePrintTableSigns()}>🖨️ Cetak Semua Papan Meja</button>
            </article>

            <article className="owner-panel owner-table-sign-card">
              <div className="owner-table-sign-header">
                <h2>Cetak &amp; Simpan Papan QR Meja</h2>
                <p>Desain papan meja standar resmi OKESIH (10 × 15 cm) untuk tempat akrilik meja. QR Code menu digital terhubung otomatis dengan nomor meja dan sistem kasir.</p>
              </div>

              <div className="owner-table-sign-toolbar">
                <label className="owner-table-sign-select">
                  <span>Pilih Meja:</span>
                  <select
                    value={selectedTableId}
                    onChange={(e) => setSelectedTableId(e.target.value)}
                    disabled={data.tables.length === 0 || pdfBusy}
                  >
                    {data.tables.length === 0 ? (
                      <option value="">(Contoh Meja 01)</option>
                    ) : (
                      data.tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          Meja {formatTableDisplay(table.label)}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <div className="owner-table-sign-actions">
                  <button
                    type="button"
                    className="owner-table-sign-btn primary"
                    disabled={data.tables.length === 0 || pdfBusy}
                    onClick={handleDownloadSinglePdf}
                    title="Simpan file PDF siap cetak untuk meja yang dipilih"
                  >
                    {pdfBusy && !pdfProgress ? "⏳ Memproses..." : "📥 Simpan PDF (Meja Ini)"}
                  </button>

                  <button
                    type="button"
                    className="owner-table-sign-btn"
                    disabled={data.tables.length === 0 || pdfBusy}
                    onClick={handleDownloadAllPdf}
                    title="Simpan satu file PDF gabungan untuk seluruh meja"
                  >
                    {pdfProgress || "📥 Simpan Semua Meja (PDF)"}
                  </button>

                  <button
                    type="button"
                    className="owner-table-sign-btn"
                    disabled={data.tables.length === 0 || pdfBusy}
                    onClick={() => void handlePrintTableSigns(selectedTableId || undefined)}
                    title="Buka dialog cetak langsung dari browser"
                  >
                    🖨️ Cetak Langsung
                  </button>
                </div>
              </div>

              <div className="owner-table-sign-viewport">
                <div className="owner-table-sign-badge">● PREVIEW STANDAR RESMI</div>
                <div className="owner-table-sign-canvas-wrapper">
                  <canvas
                    ref={previewCanvasRef}
                    className="owner-table-sign-canvas"
                    aria-label="Preview Papan Meja QR"
                  />
                  {previewLoading && (
                    <div style={{ position: "absolute", color: "#ffffff", fontSize: "12px", background: "rgba(0,0,0,0.65)", padding: "6px 14px", borderRadius: "8px", fontWeight: 600 }}>
                      Memuat preview...
                    </div>
                  )}
                </div>
                <div className="owner-table-sign-info">
                  Standar Akrilik A6 / 10 × 15 cm · Template Resmi OKESIH · File disimpan dalam format PDF
                </div>
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
