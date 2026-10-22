"use client";
import { useRef, useState } from "react";

export default function CopyCredential({ label, value }: { label: string; value: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Tersalin");
    } catch {
      input.current?.focus();
      input.current?.select();
      setNotice("Teks dipilih. Tekan lama lalu salin.");
    }
  }
  return <div style={{ minWidth: 0 }}>
    <label style={{ display: "block" }}>{label}
      <input ref={input} readOnly value={value} onFocus={event => event.target.select()} style={{ width: "100%", minWidth: 0, padding: "0.5rem", color: "inherit", background: "transparent", border: "1px solid #94a3b8", borderRadius: 6, userSelect: "text", WebkitUserSelect: "text" }} />
    </label>
    <button type="button" className="btn-secondary" onClick={() => void copy()} aria-label={`Salin ${label.toLowerCase()}`}>Salin {label.toLowerCase()}</button>
    <small role="status">{notice}</small>
  </div>;
}
