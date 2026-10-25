"use client";
import { useRef, useState } from "react";
import ModalFrame from "./ModalFrame";
import type { ConfirmModalData } from "./types";

export default function ConfirmActionModal({ data, onClose }: { data: ConfirmModalData; onClose: () => void }) {
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const danger = data.confirmVariant === "danger";
  const isPrimary = data.confirmVariant === "primary";
  const close = () => { if (!submitting.current) onClose(); };
  const confirm = async () => {
    if (submitting.current || (data.requireVerification && !verified)) return;
    submitting.current = true; setBusy(true); setError("");
    try { await data.onConfirm(); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Tindakan belum berhasil. Silakan coba lagi."); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <ModalFrame label={data.title} onClose={close}>
    <section className={`glass-panel sa-confirm-action ${danger ? "is-danger" : ""} ${isPrimary ? "is-primary" : ""}`} aria-busy={busy}>
      <header>
        <span className="sa-confirm-icon" aria-hidden="true">
          {isPrimary ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18.6A1.6 1.6 0 0 0 3.2 21h17.6a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></svg>
          )}
        </span>
        <div><p>Konfirmasi tindakan</p><h2>{data.title}</h2></div>
      </header>
      {data.targetName && <div className="sa-confirm-target"><small>Periksa kembali pilihan Anda</small><strong>{data.targetName}</strong></div>}
      <p className="sa-confirm-description">{data.message}</p>
      {data.requireVerification && <label className="sa-confirm-verification"><input type="checkbox" checked={verified} disabled={busy} onChange={event => setVerified(event.target.checked)} /><span>Saya sudah memeriksa nama di atas dan memahami dampak tindakan ini.</span></label>}
      {error && <p className="sa-confirm-error" role="alert">{error}</p>}
      <footer>
        <button type="button" className="btn-secondary" disabled={busy} onClick={close}>Batal</button>
        <button type="button" className="btn-primary sa-confirm-submit" disabled={busy || (data.requireVerification && !verified)} onClick={() => void confirm()}>{busy ? "Memproses…" : data.confirmText || "Konfirmasi"}</button>
      </footer>
    </section>
  </ModalFrame>;
}
