"use client";

import { useCallback, useEffect, useState } from "react";
import { useMarketingData } from "../MarketingContext";
import MarketingLoading from "../MarketingLoading";
import "../marketing-dashboard.css";

type ProfileData = {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  phone: string;
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
  const { refresh: refreshDashboard, isAuthorized } = useMarketingData();

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

  const applyProfile = (p: ProfileData) => {
    setProfile(p); setUsername(p.username); setFullName(p.fullName); setPhone(p.phone);
    setCityArea(p.cityArea); setBankName(p.bankName); setBankAccountNumber(p.bankAccountNumber); setBankAccountName(p.bankAccountName);
  };

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      setProfileError("");
      const res = await fetch("/api/marketing/profile", { cache: "no-store", signal });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Gagal memuat profil marketing.");
      
      if (!signal?.aborted) applyProfile(payload.profile);
    } catch (err) {
      if (signal?.aborted) return;
      setProfileError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat profil.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadProfile(controller.signal);
    });
    return () => controller.abort();
  }, [isAuthorized, loadProfile]);

  const handleCopyReferral = async () => {
    if (!profile?.referralCode) return;
    try {
      await navigator.clipboard.writeText(profile.referralCode);
      setCopiedReferral(true);
    } catch {
      setProfileError("Penyalinan gagal. Pilih dan salin kode referral secara manual.");
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredentialError("");
    setCredentialSuccess("");

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{4,30}$/.test(cleanUsername)) {
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
      if (payload.passwordChanged) successNotes.push("Password berhasil diperbarui.");
      
      setCredentialSuccess(successNotes.join(" ") || "Kredensial login berhasil diperbarui.");
      setNewPassword("");
      setConfirmPassword("");
      
      setProfile(payload.profile);
      setUsername(payload.profile.username);
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
      applyProfile(payload.profile);
      void refreshDashboard();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (!isAuthorized || loading) return <MarketingLoading />;

  const busy = savingProfile || savingCredentials;
  return (
    <main className="mkt-shell mkt-profile">
      <div className="mkt-container">
        <div className="mkt-subpage-header">
          <div className="mkt-subpage-title-box">
            <h1>Profil saya</h1>
            <p>Informasi pribadi, rekening komisi, dan keamanan akun.</p>
          </div>
        </div>
        {!profile ? (
          <section className="mkt-panel mkt-profile-content">
            <h2>Profil belum dapat dimuat</h2>
            <p role="alert">{profileError}</p>
            <button className="mkt-primary" onClick={() => void loadProfile()}>Coba lagi</button>
          </section>
        ) : (
          <div className="mkt-profile-content">
            <section className="mkt-panel mkt-profile-summary" aria-label="Ringkasan kemitraan">
              <div className="mkt-profile-identity">
                <div className="mkt-profile-avatar" aria-hidden="true">{profile.fullName.trim().charAt(0).toUpperCase()}</div>
                <div><h2>{profile.fullName}</h2><p>{profile.cityArea || "Wilayah belum diisi"}</p></div>
                <span className="mkt-profile-status">{profile.status === "ACTIVE" ? "Aktif" : profile.status}</span>
              </div>
              <dl className="mkt-profile-facts">
                <div><dt>Kode referral</dt><dd><span>{profile.referralCode}</span><button type="button" onClick={handleCopyReferral}>{copiedReferral ? "Tersalin" : "Salin"}</button></dd></div>
                <div><dt>Tarif komisi mitra</dt><dd>Rp {profile.commissionRate.toLocaleString("id-ID")} <small>/ struk</small></dd></div>
                <div><dt>Tenant binaan</dt><dd>{profile.totalTenants} <small>tenant</small></dd></div>
              </dl>
              <p className="mkt-profile-hint">Tarif tiap tenant dapat berbeda sesuai penetapan admin.</p>
            </section>

            <div className="mkt-profile-columns">
              <section className="mkt-panel">
                <div className="mkt-profile-section-title"><span aria-hidden="true">01</span><div><h2>Informasi pribadi</h2><p>Gunakan kontak aktif agar mudah dihubungi.</p></div></div>
                {profileError && <p className="mkt-alert error" role="alert">{profileError}</p>}
                {profileSuccess && <p className="mkt-alert success" role="status">{profileSuccess}</p>}
                <form onSubmit={handleSaveProfile} className="mkt-form">
                  <fieldset disabled={busy}>
                    <label>Nama lengkap<input required minLength={2} maxLength={150} autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} /></label>
                    <div className="mkt-form-row">
                      <label>Nomor WhatsApp<input type="tel" required maxLength={30} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
                      <label>Kota / wilayah<input required maxLength={100} value={cityArea} onChange={e => setCityArea(e.target.value)} /></label>
                    </div>
                    <div className="mkt-profile-divider"><h3>Rekening komisi</h3><p>Pastikan rekening dan nama penerima sudah benar.</p></div>
                    <div className="mkt-form-row">
                      <label>Nama bank<input required maxLength={50} placeholder="Contoh: BCA" value={bankName} onChange={e => setBankName(e.target.value)} /></label>
                      <label>Nomor rekening<input required inputMode="numeric" pattern="[0-9]+" maxLength={50} value={bankAccountNumber} onChange={e => setBankAccountNumber(e.target.value)} /></label>
                    </div>
                    <label>Nama pemilik rekening<input required minLength={2} maxLength={150} value={bankAccountName} onChange={e => setBankAccountName(e.target.value)} /></label>
                    <button className="mkt-primary" type="submit">{savingProfile ? "Menyimpan…" : "Simpan profil"}</button>
                  </fieldset>
                </form>
              </section>
              <section className="mkt-panel">
                <div className="mkt-profile-section-title"><span aria-hidden="true">02</span><div><h2>Keamanan akun</h2><p>Kelola username dan password login Anda.</p></div></div>
                {credentialError && <p className="mkt-alert error" role="alert">{credentialError}</p>}
                {credentialSuccess && <p className="mkt-alert success" role="status">{credentialSuccess}</p>}
                <form onSubmit={handleSaveCredentials} className="mkt-form">
                  <fieldset disabled={busy}>
                    <label>Username<input required minLength={4} maxLength={30} pattern="[a-zA-Z0-9_-]+" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} /><small>4–30 karakter: huruf, angka, _ atau -.</small></label>
                    <div className="mkt-profile-divider"><h3>Ganti password</h3><p>Kosongkan jika password tidak ingin diubah.</p></div>
                    <label>Password baru<input type={showPassword ? "text" : "password"} minLength={6} maxLength={256} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /><small>Minimal 6 karakter.</small></label>
                    <label>Ulangi password baru<input type={showPassword ? "text" : "password"} required={Boolean(newPassword)} disabled={!newPassword} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
                    <button className="mkt-profile-reveal" type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Sembunyikan password" : "Tampilkan password"}</button>
                    <button className="mkt-primary" type="submit">{savingCredentials ? "Menyimpan…" : "Simpan akun"}</button>
                  </fieldset>
                </form>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
