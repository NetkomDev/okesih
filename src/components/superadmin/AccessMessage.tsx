"use client";
import CopyCredential from "./CopyCredential";

export default function AccessMessage({ url, onClose }: { url: string; onClose: () => void }) {
  const message = new URL(url).searchParams.get("text") || "";
  const username = message.match(/Username:\s*[*`]*([^\s*`]+)/)?.[1];
  const password = message.match(/Password(?: sementara| baru)?:\s*[*`]*([^\s*`]+)/)?.[1];
  if (!username || !password) return null;
  return <section aria-label="Akses akun baru" style={{ padding: "1rem", marginBottom: "1rem", border: "1px solid #38bdf8", borderRadius: 8 }}>
    <p>Akun siap digunakan. Salin akses atau kirim melalui WhatsApp.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
      <CopyCredential label="Username" value={username} />
      <CopyCredential label="Password" value={password} />
    </div>
    <a className="btn-primary" href={url} target="_blank" rel="noreferrer">Buka WhatsApp</a>
    <button type="button" className="btn-secondary" onClick={onClose}>Tutup akses</button>
  </section>;
}
