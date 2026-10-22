"use client";
import { useEffect,useState } from "react";
import { useSuperadmin } from "./context";

export default function SettingsFeature() {
const { isDark, showToast, activeTab } = useSuperadmin();

const [globalDismissDuration, setGlobalDismissDuration] = useState<number>(60);
const [saasFeePerReceipt, setSaasFeePerReceipt] = useState<number>(50);
const [defaultCommissionRate, setDefaultCommissionRate] = useState<number>(0);
const [coordinatorCommission, setCoordinatorCommission] = useState(0);
const [settingsError, setSettingsError] = useState(false);
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
          setCoordinatorCommission(payload.data.coordinatorCommissionPerReceipt);
          setSettingsUpdatedAt(payload.data.updatedAt);
        }
      } catch (error) {
        if (active) setSettingsError(true);
        if (active) showToast("Parameter Belum Dimuat", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
      } finally {
        if (active) setIsSettingsLoading(false);
      }
    };
    loadPlatformSettings();
    return () => { active = false; };
  }, [showToast]);
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
          coordinatorCommissionPerReceipt: coordinatorCommission,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Parameter global gagal disimpan.");
      setGlobalDismissDuration(payload.data.queueDismissSeconds);
      setSaasFeePerReceipt(payload.data.saasFeePerReceipt);
      setDefaultCommissionRate(payload.data.defaultMarketingCommission);
          setCoordinatorCommission(payload.data.coordinatorCommissionPerReceipt);
      setSettingsUpdatedAt(payload.data.updatedAt);
      showToast("Parameter Global Tersimpan", "TV antrean, dashboard owner, dan halaman marketing kini menggunakan konfigurasi terbaru.", "success");
    } catch (error) {
      showToast("Gagal Menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsSettingsSaving(false);
    }
  };
return (<>{activeTab === "platform_config" && (
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
                ⏱️ Parameter Master: Auto-Dismiss Antrean Dapur &amp; TV
              </h3>
              <p style={{ fontSize: "0.825rem", color: isDark ? "#94A3B8" : "#64748B", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                Berapa lama pesanan berstatus <strong>HIJAU (Siap Diantar)</strong> bertahan di layar Dapur / TV tenant warkop sebelum otomatis dianggap telah diambil oleh waiter dan dihapus dari antrean.
              </p>

              <div className="sa-duration-options" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
                {[30, 45, 60, 90, 120].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setGlobalDismissDuration(sec)}
                    disabled={isSettingsLoading || isSettingsSaving || settingsError}
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
                Durasi yang akan diterapkan: {globalDismissDuration} detik untuk seluruh layar dapur tenant
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
                <input inputMode="numeric"
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
                <span style={{ fontSize: "0.85rem", color: isDark ? "#94A3B8" : "#64748B" }}>Komisi Mitra Marketing:</span>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: isDark ? "#C084FC" : "#7C3AED" }}>Rp</span>
                <input inputMode="numeric"
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

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.85rem", color: isDark ? "#94A3B8" : "#64748B" }}>Komisi Koordinator Mitra:</span>
                <span style={{ fontSize: "1rem", fontWeight: 800, color: isDark ? "#818CF8" : "#4F46E5" }}>Rp</span>
                <input inputMode="numeric"
                  type="number"
                  min={0}
                  max={saasFeePerReceipt}
                  value={coordinatorCommission}
                  disabled={isSettingsLoading || isSettingsSaving || settingsError}
                  onChange={(event) => setCoordinatorCommission(Number(event.target.value))}
                  style={{
                    background: isDark ? "rgba(15, 23, 42, 0.8)" : "#F8FAFC",
                    border: isDark ? "1px solid rgba(129, 140, 248, 0.4)" : "1px solid rgba(0, 0, 0, 0.15)",
                    borderRadius: "8px",
                    padding: "0.4rem 0.65rem",
                    fontSize: "1rem",
                    fontWeight: 900,
                    color: isDark ? "#818CF8" : "#4F46E5",
                    width: "90px",
                  }}
                />
                <span style={{ fontSize: "0.8rem", color: isDark ? "#94A3B8" : "#64748B" }}>/ struk</span>
              </div>
              <p style={{ marginBottom: "16px", fontSize: "13px", color: isDark ? "#94A3B8" : "#64748B" }}>
                Margin per struk perusahaan: <strong>Rp {Math.max(0, saasFeePerReceipt - defaultCommissionRate - coordinatorCommission).toLocaleString("id-ID")}</strong>.
                Komisi dihitung otomatis dari Parameter Master Global saat tagihan dilunasi.
              </p>
              {settingsError && <p role="alert">Parameter gagal dimuat. Muat ulang halaman sebelum menyimpan.</p>}
              <div style={{ paddingTop: "1rem", borderTop: isDark ? "1px solid rgba(255,255,255,.1)" : "1px solid rgba(15,23,42,.1)" }}>
                <button
                  type="button"
                  onClick={handleSavePlatformSettings}
                  disabled={isSettingsLoading || isSettingsSaving || settingsError}
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
        )}</>);
}
