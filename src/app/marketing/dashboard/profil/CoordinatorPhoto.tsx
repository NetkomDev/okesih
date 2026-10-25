"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function CoordinatorPhoto({ photoUrl, onSaved }: { photoUrl: string | null; onSaved: (url: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!source) return;
    const modal = dialog.current!;
    modal.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { modal.close(); document.body.style.overflow = previous; };
  }, [source]);

  useEffect(() => {
    if (!source || !canvas.current) return;
    const context = canvas.current.getContext("2d");
    if (!context) return;
    const scale = Math.max(480 / source.naturalWidth, 720 / source.naturalHeight) * zoom;
    const width = 480 / scale, height = 720 / scale;
    context.clearRect(0, 0, 480, 720);
    context.drawImage(source, (source.naturalWidth - width) * x / 100, (source.naturalHeight - height) * y / 100, width, height, 0, 0, 480, 720);
  }, [source, zoom, x, y]);

  async function choose(file?: File) {
    if (!file) return;
    setError(""); setSuccess(false);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("Pilih JPG, PNG, atau WebP maksimal 10 MB."); return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new window.Image();
      img.src = url;
      await img.decode();
      if (img.naturalWidth * img.naturalHeight > 25_000_000) throw new Error("Foto terlalu besar. Pilih foto maksimal 25 megapiksel.");
      setZoom(1); setX(50); setY(50); setSource(img);
    } catch (err) { setError(err instanceof Error ? err.message : "Foto tidak dapat dibaca."); }
    finally { URL.revokeObjectURL(url); }
  }

  async function save() {
    if (saving.current || !canvas.current) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.current!.toBlob(resolve, "image/webp", .85));
      if (!blob) throw new Error("Crop foto gagal. Silakan coba lagi.");
      const form = new FormData();
      form.append("image", blob, blob.type === "image/webp" ? "portrait.webp" : "portrait.png");
      const response = await fetch("/api/marketing/profile/photo", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Foto gagal disimpan.");
      onSaved(data.photoUrl); setSource(null); setSuccess(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Foto gagal disimpan."); }
    finally { saving.current = false; setBusy(false); }
  }

  return <section className="mkt-panel mkt-photo-panel">
    <div className="mkt-profile-section-title"><span aria-hidden="true">↗</span><div><h2>Foto KorMit</h2><p>Tampil menyatu dengan sisi kanan header dashboard Anda.</p></div></div>
    <div className="mkt-photo-settings">
      <div className="mkt-photo-preview"><span>Koordinator<br /><strong>Mitra</strong></span>{photoUrl && <Image src={photoUrl} alt="Pratinjau foto KorMit" fill unoptimized sizes="160px" />}</div>
      <div><h3>{photoUrl ? "Perbarui foto Anda" : "Lengkapi profil Anda"}</h3><p>Pilih foto, lalu atur crop agar wajah terlihat jelas. JPG, PNG, atau WebP, maksimal 10 MB.</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
        <button type="button" className="mkt-primary" onClick={() => input.current?.click()}>{photoUrl ? "Ganti foto" : "Tambah foto"}</button>
      </div>
    </div>
    {error && !source && <p className="mkt-alert error" role="alert">{error}</p>}
    {success && <p className="mkt-alert success" role="status">Foto tersimpan dan header dashboard telah diperbarui.</p>}
    <dialog ref={dialog} className="mkt-crop-dialog" aria-labelledby="mkt-crop-title" onCancel={event => { event.preventDefault(); if (!saving.current) setSource(null); }}>
      <div className="mkt-crop-content">
        <h2 id="mkt-crop-title">Atur foto KorMit</h2><p>Geser pengaturan untuk menempatkan wajah di tengah foto.</p>
        <canvas ref={canvas} width={480} height={720} aria-label="Pratinjau hasil crop foto" />
        <fieldset disabled={busy}>
          <label>Perbesar<input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
          <label>Posisi kiri / kanan<input type="range" min="0" max="100" value={x} onChange={e => setX(Number(e.target.value))} /></label>
          <label>Posisi atas / bawah<input type="range" min="0" max="100" value={y} onChange={e => setY(Number(e.target.value))} /></label>
        </fieldset>
        {error && <p className="mkt-alert error" role="alert">{error}</p>}
        <div className="mkt-crop-actions"><button type="button" disabled={busy} onClick={() => setSource(null)}>Batal</button><button className="mkt-primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Menyimpan…" : "Simpan foto"}</button></div>
      </div>
    </dialog>
  </section>;
}
