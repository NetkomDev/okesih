"use client";
import { useEffect,useState } from "react";
import { ownerFetch } from "./helpers";
import { useOwnerData } from "./provider";

export default function PinFeature() {
const { error, setError, notice, setNotice, busy, setBusy } = useOwnerData("pin");

const isAuthorized = true;
const pathname = "/owner/pin";
const [auditPinInput, setAuditPinInput] = useState("");
const [auditPinConfirm, setAuditPinConfirm] = useState("");
const [hasAuditPin, setHasAuditPin] = useState<boolean | null>(null);
const [auditPinLoading, setAuditPinLoading] = useState(false);
const loadAuditPinStatus = async () => {
    try {
      setAuditPinLoading(true);
      const res = await ownerFetch("/api/owner/security-pin");
      setHasAuditPin(Boolean(res.hasPin));
    } catch {
      // Abaikan jika gagal
    } finally {
      setAuditPinLoading(false);
    }
  };
const saveAuditPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(auditPinInput)) {
      return setError("PIN harus terdiri dari 4 sampai 6 angka.");
    }
    if (auditPinInput !== auditPinConfirm) {
      return setError("Konfirmasi PIN tidak cocok.");
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await ownerFetch("/api/owner/security-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: auditPinInput }),
      });
      setHasAuditPin(true);
      setAuditPinInput("");
      setAuditPinConfirm("");
      setNotice("PIN Akses Histori Pesanan berhasil diperbarui!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan PIN.");
    } finally {
      setBusy(false);
    }
  };
const disableAuditPin = async () => {
    if (!confirm("Nonaktifkan PIN Keamanan? Tab Histori Pesanan di kasir akan dapat dibuka tanpa PIN.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await ownerFetch("/api/owner/security-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      setHasAuditPin(false);
      setAuditPinInput("");
      setAuditPinConfirm("");
      setNotice("PIN Akses Histori Pesanan berhasil dinonaktifkan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menonaktifkan PIN.");
    } finally {
      setBusy(false);
    }
  };
useEffect(() => {
    if (!isAuthorized) return;
    const timer = window.setTimeout(() => void loadAuditPinStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [isAuthorized, pathname]);
return (<>{error && <div className="owner-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}{true && (
            <section className="owner-pin-page owner-page-panel">
              <div className="owner-section-heading">
                <div>
                  <small style={{ color: "#ea580c", fontWeight: 900, letterSpacing: "0.08em" }}>KEAMANAN &amp; PRIVASI AUDIT</small>
                  <h2>PIN Akses Histori Pesanan</h2>
                  <p>Lindungi rekap omzet, total transaksi kasir, dan data audit keuangan dari akses staf kasir tanpa izin.</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 500px) 1fr", gap: "24px", alignItems: "start", marginTop: "16px" }}>
                <article className="owner-panel" style={{ padding: "26px", borderRadius: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: hasAuditPin ? "#dcfce7" : "#fff7ed", display: "grid", placeItems: "center", fontSize: "20px" }}>
                      {hasAuditPin ? "🛡️" : "🔓"}
                    </div>
                    <div>
                      <b style={{ display: "block", fontSize: "15px", color: "var(--text-primary)" }}>Status Proteksi PIN</b>
                      <span style={{ fontSize: "12.5px", fontWeight: 750, color: hasAuditPin ? "#15803d" : "#c2410c" }}>
                        {auditPinLoading ? "Memeriksa status..." : hasAuditPin ? "● PIN Aktif — Histori Kasir Terkunci" : "○ PIN Belum Dibuat (Tidak Terproteksi)"}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={saveAuditPin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <label className="owner-category-field">
                      {hasAuditPin ? "Ganti PIN Baru (4 - 6 Angka)" : "Buat PIN Baru (4 - 6 Angka)"}
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{4,6}"
                        maxLength={6}
                        required
                        value={auditPinInput}
                        onChange={(e) => setAuditPinInput(e.target.value.replace(/\D/g, ""))}
                        placeholder="Contoh: 123456"
                        autoComplete="new-password"
                        style={{ height: "44px", fontSize: "16px", letterSpacing: "0.2em", fontWeight: 900, textAlign: "center" }}
                      />
                      <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                        Hanya masukkan digit angka (0-9).
                      </small>
                    </label>

                    <label className="owner-category-field">
                      Konfirmasi PIN
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{4,6}"
                        maxLength={6}
                        required
                        value={auditPinConfirm}
                        onChange={(e) => setAuditPinConfirm(e.target.value.replace(/\D/g, ""))}
                        placeholder="Ulangi PIN di atas"
                        autoComplete="new-password"
                        style={{ height: "44px", fontSize: "16px", letterSpacing: "0.2em", fontWeight: 900, textAlign: "center" }}
                      />
                    </label>

                    <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={busy || auditPinInput.length < 4}
                        style={{ flex: 1, height: "44px", fontSize: "14px", fontWeight: 900 }}
                      >
                        {busy ? "Menyimpan..." : hasAuditPin ? "Perbarui PIN" : "Aktifkan PIN"}
                      </button>

                      {hasAuditPin && (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busy}
                          onClick={disableAuditPin}
                          style={{ height: "44px", color: "#dc2626", borderColor: "#fecaca" }}
                          title="Nonaktifkan proteksi PIN"
                        >
                          Hapus PIN
                        </button>
                      )}
                    </div>
                  </form>
                </article>

                <article className="owner-panel" style={{ padding: "26px", borderRadius: "18px", background: "var(--bg-card)", border: "1.5px solid var(--border-color)" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 900, color: "var(--text-primary)" }}>
                    💡 Cara Kerja PIN Histori Pesanan
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <li>
                      <b>Akses Tab POS Kasir:</b> Saat kasir mengetuk tab <b>&quot;Histori Pesanan&quot;</b> di aplikasi kasir, sistem akan menampilkan popup pop-up PIN 6 angka.
                    </li>
                    <li>
                      <b>Hanya Pemegang PIN:</b> Kasir biasa tidak akan dapat melihat omzet harian, kas tunai, QRIS, maupun daftar transaksi jika tidak mengetahui PIN ini.
                    </li>
                    <li>
                      <b>Sesi Audit Otomatis:</b> Sekali PIN berhasil dimasukkan di perangkat kasir, halaman dapat diaudit oleh Owner hingga layar dikunci atau shift selesai.
                    </li>
                    <li>
                      <b>Fleksibel &amp; Aman:</b> Anda dapat mengganti atau menonaktifkan PIN kapan saja langsung dari dashboard ini secara instan.
                    </li>
                  </ul>
                </article>
              </div>
            </section>
          )}</>);
}
