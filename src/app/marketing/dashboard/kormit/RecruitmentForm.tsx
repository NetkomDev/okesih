"use client";
import { useRef, useState } from "react";

type Result = { name: string; status: string; whatsappUrl: string };
export default function RecruitmentForm({ onRegistered }: { onRegistered: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const requestId = useRef("");
  const submitting = useRef(false);
  return <section className="kormit-recruit">
    <h2>Rekrut mitra baru</h2>
    <p>Daftarkan calon mitra binaan Anda. Super Admin memverifikasi pendaftaran dan mengirim akses login ke nomor WhatsApp mitra baru.</p>
    {!open && <button className="mkt-primary" onClick={() => { setOpen(true); requestId.current = crypto.randomUUID(); }}>Daftarkan mitra baru</button>}
    {open && !result && <form className="mkt-form" onSubmit={async event => {
      event.preventDefault();
      if (submitting.current) return;
      submitting.current = true; setBusy(true); setError("");
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      try {
        const response = await fetch("/api/marketing/network", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fields, requestId: requestId.current }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Pendaftaran belum berhasil.");
        setResult(body.data); onRegistered();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Koneksi terputus. Coba kirim ulang pendaftaran yang sama."); }
      finally { submitting.current = false; setBusy(false); }
    }}>
      <fieldset disabled={busy} className="kormit-fields">
        <label>Nama lengkap<input name="fullName" required minLength={2} maxLength={150} autoComplete="off" /></label>
        <label>WhatsApp mitra baru<input name="phone" type="tel" inputMode="tel" required maxLength={30} placeholder="081234567890" autoComplete="off" /><small>Gunakan nomor calon mitra, bukan nomor koordinator.</small></label>
        <label>Email (opsional)<input name="email" type="email" maxLength={254} autoComplete="off" /></label>
        <label>Kota / wilayah<input name="cityArea" required minLength={2} maxLength={150} /></label>
        <label>Nama bank<input name="bankName" required minLength={2} maxLength={100} placeholder="Contoh: BRI" /></label>
        <label>Nomor rekening<input name="bankAccountNumber" inputMode="numeric" pattern="[0-9]{5,30}" required maxLength={30} autoComplete="off" /></label>
        <label>Nama pemilik rekening<input name="bankAccountName" required minLength={2} maxLength={150} /></label>
        <label>Pengalaman / catatan (opsional)<textarea name="experienceNotes" maxLength={2000} rows={3} /></label>
        <button className="mkt-primary" type="submit">{busy ? "Menyimpan…" : "Kirim untuk verifikasi"}</button>
      </fieldset>
      {error && <p className="mkt-alert error" role="alert">{error}</p>}
    </form>}
    {result && <div className="kormit-result" role="status"><h3>{result.name} sudah terdaftar</h3>
      <p>{result.status === "PENDING" ? "Menunggu verifikasi Super Admin." : "Lihat status terbaru pada daftar mitra."} Buka WhatsApp lalu tekan Kirim untuk memberi tahu Super Admin.</p>
      <a className="mkt-primary" href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">Kirim WhatsApp ke Super Admin</a>
      <button type="button" onClick={() => { requestId.current = crypto.randomUUID(); setResult(null); setError(""); }}>Daftarkan mitra lainnya</button>
    </div>}
  </section>;
}
