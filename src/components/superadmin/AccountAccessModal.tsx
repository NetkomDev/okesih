"use client";

import { useState } from "react";

export type AccountAccessTarget = {
  kind: "MARKETING" | "TENANT" | "APPLICATION";
  id: string;
  name: string;
  phone: string;
  canReset: boolean;
};

export default function AccountAccessModal({ target, onClose, onSaved }: {
  target: AccountAccessTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState(target.phone);
  const [confirmed, setConfirmed] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ phone: string; whatsappUrl: string | null; warning: string | null } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/superadmin/account-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: target.kind, id: target.id, phone, resetPassword, recipientConfirmed: confirmed }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Pemulihan akses gagal.");
      setResult(payload.data);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Permintaan gagal. Jika koneksi terputus setelah reset, ulangi reset untuk menyiapkan password baru.");
    } finally { setBusy(false); }
  }

  return <div className="ops-modal-backdrop">
    <section className="ops-modal" role="dialog" aria-modal="true" aria-labelledby="account-access-title">
      <button className="ops-modal-close" aria-label="Tutup pemulihan akses" onClick={onClose} disabled={busy}>×</button>
      <h2 id="account-access-title" style={{ fontSize: 22, paddingRight: 32 }}>Perbaiki WA & akses akun</h2>
      <p style={{ margin: "12px 0", overflowWrap: "anywhere" }}>{target.name}</p>
      {result ? <div style={{ display: "grid", gap: 16 }}>
        <p role="status">Nomor tersimpan: +{result.phone}. {result.whatsappUrl ? "Password lama tidak berlaku. Pesan akses baru siap dikirim." : "Password tidak diubah."}</p>
        {result.warning && <p role="alert">{result.warning}</p>}
        {result.whatsappUrl && <>
          <a className="btn-primary" href={result.whatsappUrl} target="_blank" rel="noreferrer">Buka WhatsApp untuk kirim akses</a>
          <p>Periksa penerima lalu tekan Kirim di WhatsApp. Membuka WhatsApp belum berarti pesan terkirim. Tombol ini dapat dibuka ulang selama jendela ini masih terbuka.</p>
        </>}
        <button className="btn-secondary" onClick={onClose}>Selesai</button>
      </div> : <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <label>Nomor WhatsApp yang benar
          <input type="tel" required maxLength={30} value={phone} onChange={event => { setPhone(event.target.value); setConfirmed(false); }} autoFocus style={{ display: "block", width: "100%", padding: 12, marginTop: 8, border: "1px solid #cbd5e1", borderRadius: 8, color: "#172033", background: "#fff" }} />
        </label>
        {target.canReset && <label style={{ display: "flex", gap: 10, alignItems: "baseline" }}><input type="checkbox" checked={resetPassword} onChange={event => setResetPassword(event.target.checked)} />Reset password dan siapkan pesan akses baru</label>}
        {resetPassword && <p>Username dan akun tetap sama. Password lama akan diganti, termasuk jika sebelumnya sudah terkirim ke nomor yang salah.</p>}
        <label style={{ display: "flex", gap: 10, alignItems: "baseline" }}><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Saya sudah memastikan identitas penerima dan nomor WhatsApp yang benar melalui calon pengguna atau marketing pengaju.</label>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy || !confirmed}>{busy ? "Memproses…" : resetPassword ? "Simpan nomor & reset akses" : "Simpan nomor WhatsApp"}</button>
      </form>}
    </section>
  </div>;
}
