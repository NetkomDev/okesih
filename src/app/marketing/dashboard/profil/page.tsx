"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMarketingData } from "../MarketingContext";
import MarketingLoading from "../MarketingLoading";
import "../marketing-dashboard.css";

type ProfileData = {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  phone: string;
  email: string;
  cityArea: string;
  referralCode: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  commissionRate: number;
  totalTenants: number;
  status: string;
};

export default function MarketingProfilPage() {
  const { data: dashboardData, loading: contextLoading, refresh: refreshDashboard, isAuthorized } = useMarketingData();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // Form Kredensial
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialError, setCredentialError] = useState("");
  const [credentialSuccess, setCredentialSuccess] = useState("");

  // Form Profil & Rekening
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cityArea, setCityArea] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/marketing/profile", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal memuat profil marketing.");
      
      const p: ProfileData = payload.profile;
      setProfile(p);
      setUsername(p.username || "");
      setFullName(p.fullName || "");
      setPhone(p.phone || "");
      setCityArea(p.cityArea || "");
      setBankName(p.bankName || "");
      setBankAccountNumber(p.bankAccountNumber || "");
      setBankAccountName(p.bankAccountName || "");
    } catch (err) {
      console.error(err);
      setProfileError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat profil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      void loadProfile();
    }
  }, [isAuthorized]);

  const handleCopyReferral = () => {
    if (!profile?.referralCode) return;
    navigator.clipboard.writeText(profile.referralCode);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2500);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredentialError("");
    setCredentialSuccess("");

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (cleanUsername.length < 4 || cleanUsername.length > 30) {
      setCredentialError("Username harus 4-30 karakter (hanya huruf kecil, angka, _ atau -).");
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setCredentialError("Password baru minimal 6 karakter.");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setCredentialError("Konfirmasi password tidak cocok dengan password baru.");
      return;
    }

    if (cleanUsername === (profile?.username || "") && !newPassword) {
      setCredentialError("Tidak ada perubahan username atau password yang dimasukkan.");
      return;
    }

    try {
      setSavingCredentials(true);
      const res = await fetch("/api/marketing/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          ...(newPassword ? { newPassword } : {}),
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal memperbarui kredensial.");

      const successNotes: string[] = [];
      if (payload.usernameChanged) successNotes.push(`Username berhasil diubah menjadi "${payload.username}".`);
      if (payload.passwordChanged) successNotes.push("Password baru berhasil disimpan di database.");
      
      setCredentialSuccess(successNotes.join(" ") || "Kredensial login berhasil diperbarui.");
      setNewPassword("");
      setConfirmPassword("");
      
      // Update local profile & context
      if (profile) {
        setProfile({ ...profile, username: payload.username });
      }
      void refreshDashboard();
    } catch (err) {
      setCredentialError(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    if (!fullName.trim()) {
      setProfileError("Nama lengkap tidak boleh kosong.");
      return;
    }

    if (!phone.trim()) {
      setProfileError("Nomor WhatsApp tidak boleh kosong.");
      return;
    }

    try {
      setSavingProfile(true);
      const res = await fetch("/api/marketing/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          cityArea,
          bankName,
          bankAccountNumber,
          bankAccountName,
        }),
      });

      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal menyimpan data profil.");

      setProfileSuccess("Data profil dan rekening pencairan komisi berhasil diperbarui.");
      if (profile) {
        setProfile({
          ...profile,
          fullName: fullName.trim(),
          phone: phone.trim(),
          cityArea: cityArea.trim(),
          bankName: bankName.trim(),
          bankAccountNumber: bankAccountNumber.trim(),
          bankAccountName: bankAccountName.trim(),
        });
      }
      void refreshDashboard();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (!isAuthorized || (contextLoading && !dashboardData) || loading) {
    return <MarketingLoading />;
  }

  return (
    <main className="mkt-shell">
      <div className="mkt-container">
        {/* Subpage Header Nav */}
        <div className="mkt-subpage-header">
          <Link href="/marketing/dashboard" className="mkt-back-btn" title="Kembali ke Dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Kembali</span>
          </Link>
          <div className="mkt-subpage-title-box">
            <h1>Profil &amp; Keamanan Akun</h1>
            <p>Kelola kredensial login (username &amp; password) dan kelengkapan data mitra pemasaran Anda.</p>
          </div>
        </div>

        {/* Section 1: Kredensial Keamanan Login (Username & Password) */}
        <section className="mkt-panel" style={{ marginTop: "16px" }}>
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon" style={{ background: "rgba(255, 106, 42, 0.15)", color: "#ff6a2a" }}>
              🔒
            </div>
            <div>
              <h2>Keamanan &amp; Kredensial Login</h2>
              <p>Ubah username dan password untuk masuk ke aplikasi PWA Marketing OKESIH.</p>
            </div>
          </div>

          {credentialError && <div className="mkt-alert error">⚠️ {credentialError}</div>}
          {credentialSuccess && <div className="mkt-alert success">✓ {credentialSuccess}</div>}

          <form onSubmit={handleSaveCredentials} className="mkt-form" style={{ marginTop: "16px" }}>
            <div className="mkt-form-row">
              <label style={{ flex: 1 }}>
                <span>Username Akun</span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="Contoh: marketing_jkt"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                  Digunakan untuk login. Minimal 4 karakter (hanya huruf kecil, angka, _ atau -).
                </small>
              </label>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", background: "#f8fafc", padding: "12px 16px", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 700 }}>Username Terdaftar Saat Ini</span>
                <strong style={{ fontSize: "16px", color: "#0f172a", marginTop: "2px" }}>
                  {profile?.username || <em style={{ color: "#94a3b8" }}>Belum disetel</em>}
                </strong>
                <span style={{ fontSize: "11px", color: "#0d9488", marginTop: "2px" }}>
                  Status: Terhubung ke Database Auth
                </span>
              </div>
            </div>

            <div className="mkt-form-row" style={{ marginTop: "8px" }}>
              <label style={{ flex: 1 }}>
                <span>Password Baru (Opsional)</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kosongkan jika tidak ingin ganti password"
                    style={{ paddingRight: "70px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: "4px 8px",
                    }}
                  >
                    {showPassword ? "Tutup" : "Lihat"}
                  </button>
                </div>
                <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                  Minimal 6 karakter jika ingin mengganti password.
                </small>
              </label>

              <label style={{ flex: 1 }}>
                <span>Konfirmasi Password Baru</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru..."
                  disabled={!newPassword}
                />
                <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                  Wajib sama persis dengan password baru di samping.
                </small>
              </label>
            </div>

            <button
              type="submit"
              className="mkt-primary"
              disabled={savingCredentials}
              style={{ marginTop: "12px", maxWidth: "280px" }}
            >
              {savingCredentials ? "Menyimpan ke Database..." : "Simpan Kredensial Baru"}
            </button>
          </form>
        </section>

        {/* Section 2: Data Profil & Rekening Bank */}
        <section className="mkt-panel" style={{ marginTop: "20px" }}>
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon" style={{ background: "rgba(13, 148, 136, 0.15)", color: "#0d9488" }}>
              👤
            </div>
            <div>
              <h2>Informasi Profil &amp; Rekening Komisi</h2>
              <p>Pastikan nama, nomor WhatsApp, dan nomor rekening penampung komisi akurat.</p>
            </div>
          </div>

          {profileError && <div className="mkt-alert error">⚠️ {profileError}</div>}
          {profileSuccess && <div className="mkt-alert success">✓ {profileSuccess}</div>}

          <form onSubmit={handleSaveProfile} className="mkt-form" style={{ marginTop: "16px" }}>
            <div className="mkt-form-row">
              <label style={{ flex: 1 }}>
                <span>Nama Lengkap Mitra</span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nama lengkap sesuai KTP"
                />
              </label>

              <label style={{ flex: 1 }}>
                <span>Nomor WhatsApp Aktif</span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 08123456789"
                />
              </label>
            </div>

            <div className="mkt-form-row">
              <label style={{ flex: 1 }}>
                <span>Kota / Wilayah Operasional</span>
                <input
                  type="text"
                  value={cityArea}
                  onChange={(e) => setCityArea(e.target.value)}
                  placeholder="Contoh: Jakarta Selatan, Surabaya, Makassar"
                />
              </label>

              <label style={{ flex: 1 }}>
                <span>Nama Bank Penampung</span>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Contoh: BCA / Mandiri / BNI / BRI / BSI"
                />
              </label>
            </div>

            <div className="mkt-form-row">
              <label style={{ flex: 1 }}>
                <span>Nomor Rekening Bank</span>
                <input
                  type="text"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  placeholder="Nomor rekening bank..."
                />
              </label>

              <label style={{ flex: 1 }}>
                <span>Atas Nama Rekening</span>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                  placeholder="Nama pemilik rekening bank..."
                />
              </label>
            </div>

            <button
              type="submit"
              className="mkt-primary"
              disabled={savingProfile}
              style={{ marginTop: "12px", maxWidth: "280px" }}
            >
              {savingProfile ? "Menyimpan Profil..." : "Simpan Profil &amp; Rekening"}
            </button>
          </form>
        </section>

        {/* Section 3: Ringkasan Informasi Kemitraan (Read-Only) */}
        <section className="mkt-panel" style={{ marginTop: "20px" }}>
          <div className="mkt-panel-head">
            <div className="mkt-panel-icon" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#2563eb" }}>
              🏷️
            </div>
            <div>
              <h2>Informasi Kemitraan Resmi</h2>
              <p>Rincian status akun dan kode referral yang terhubung dengan Super Admin OKESIH.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginTop: "18px" }}>
            {/* Referral Code Card */}
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Kode Referral Anda</span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px" }}>
                <strong style={{ fontSize: "19px", color: "#0f766e", letterSpacing: "0.5px" }}>
                  {profile?.referralCode}
                </strong>
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  style={{
                    background: copiedReferral ? "#059669" : "#0d9488",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "background 0.2s ease",
                  }}
                >
                  {copiedReferral ? "✓ Tersalin" : "Salin"}
                </button>
              </div>
              <small style={{ display: "block", color: "#94a3b8", fontSize: "10.5px", marginTop: "4px" }}>
                Berikan kode ini kepada calon tenant saat mendaftar.
              </small>
            </div>

            {/* Komisi Rate Card */}
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Tarif Komisi</span>
              <div style={{ marginTop: "6px" }}>
                <strong style={{ fontSize: "19px", color: "#ff6a2a" }}>
                  Rp {(profile?.commissionRate || 15).toLocaleString("id-ID")}
                </strong>
                <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "4px" }}>/ struk</span>
              </div>
              <small style={{ display: "block", color: "#94a3b8", fontSize: "10.5px", marginTop: "4px" }}>
                Otomatis dihitung dari setiap struk transaksi tenant binaan.
              </small>
            </div>

            {/* Status Akun */}
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Status Kemitraan</span>
              <div style={{ marginTop: "6px" }}>
                <span style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  background: profile?.status === "ACTIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: profile?.status === "ACTIVE" ? "#047857" : "#b91c1c",
                  fontWeight: 800,
                  fontSize: "13px",
                }}>
                  ● {profile?.status === "ACTIVE" ? "AKTIF" : profile?.status || "AKTIF"}
                </span>
              </div>
              <small style={{ display: "block", color: "#94a3b8", fontSize: "10.5px", marginTop: "4px" }}>
                Total Tenant Terdaftar: <b>{profile?.totalTenants || 0} tenant</b>
              </small>
            </div>
          </div>
        </section>

        <footer style={{ marginTop: "32px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
          © {new Date().getFullYear()} OKESIH.COM · Keamanan &amp; Profil Kemitraan Marketing
        </footer>
      </div>
    </main>
  );
}
