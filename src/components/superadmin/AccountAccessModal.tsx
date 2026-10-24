"use client";
import ModalFrame from "./ModalFrame";
import AccessMessage from "./AccessMessage";

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

  return <ModalFrame label="Perbaiki WhatsApp dan akses akun" onClose={() => { if (!busy) onClose(); }}>
    <section className="glass-panel sa-account-access">
      <header className="sa-account-access-header">
      <div>
      <h2 id="account-access-title">Perbaiki WA & akses akun</h2>
      <p>{target.name}</p></div>
      <button type="button" className="btn-secondary sa-account-access-close" aria-label="Tutup pemulihan akses" onClick={onClose} disabled={busy}>×</button>
      </header>
      <div className="sa-account-access-body">
      {result ? <div style={{ display: "grid", gap: 16 }}>
        <p role="status">Nomor tersimpan: +{result.phone}. {result.whatsappUrl ? "Password lama tidak berlaku. Pesan akses baru siap dikirim." : "Password tidak diubah."}</p>
        {result.warning && <p role="alert">{result.warning}</p>}
        {result.whatsappUrl && <>
          <AccessMessage url={result.whatsappUrl} onClose={() => setResult(null)} />
          <p>Periksa penerima lalu tekan Kirim di WhatsApp. Membuka WhatsApp belum berarti pesan terkirim. Tombol ini dapat dibuka ulang selama jendela ini masih terbuka.</p>
        </>}
        <button className="btn-secondary" onClick={onClose}>Selesai</button>
      </div> : <form onSubmit={submit}>
        <label>Nomor WhatsApp yang benar
          <input inputMode="tel" type="tel" required maxLength={30} value={phone} onChange={event => { setPhone(event.target.value); setConfirmed(false); }} disabled={busy} />
        </label>
        {target.canReset && <label className="sa-access-check"><input type="checkbox" checked={resetPassword} onChange={event => setResetPassword(event.target.checked)} disabled={busy} /><span>Reset password dan siapkan pesan akses baru</span></label>}
        {resetPassword && <p>Username dan akun tetap sama. Password lama akan diganti, termasuk jika sebelumnya sudah terkirim ke nomor yang salah.</p>}
        <label className="sa-access-check"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /><span>Saya sudah memastikan identitas penerima dan nomor WhatsApp yang benar melalui calon pengguna atau marketing pengaju.</span></label>
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy || !confirmed}>{busy ? "Memproses…" : resetPassword ? "Simpan nomor & reset akses" : "Simpan nomor WhatsApp"}</button>
      </form>}
      </div>
    </section>
  </ModalFrame>;
}
