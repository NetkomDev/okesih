"use client";

import Image from "next/image";
import { useState } from "react";

export default function DevicePairing({ type, pairing, error, onBegin }: {
  type: "POS" | "KDS";
  pairing: { code: string; expiresAt: string } | null;
  error: string;
  onBegin: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(type === "POS" ? "Tablet Kasir" : "Layar Dapur");
  const [busy, setBusy] = useState(false);
  return <main className="device-pairing-page">
    <section className="device-pairing-card">
      <Image src="/logo.svg?v=2" width={72} height={72} alt="OKESIH" priority/>
      <small>OKESIH {type === "POS" ? "KASIR" : "DAPUR"}</small>
      {!pairing ? <>
        <h1>Pasangkan perangkat ini</h1><p>Berikan nama yang mudah dikenali Owner, lalu buat kode pairing.</p>
        <label>Nama perangkat<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)}/></label>
        <button className="btn-primary" disabled={busy || name.trim().length < 2} onClick={async () => { setBusy(true); await onBegin(name); setBusy(false); }}>{busy ? "Membuat kode..." : "Buat Kode Pairing"}</button>
      </> : <>
        <h1>Masukkan kode ini di Dashboard Owner</h1><div className="device-pairing-code">{pairing.code}</div><p>Dashboard Owner → Perangkat &amp; PWA → Setujui Perangkat. Kode berlaku sampai {new Date(pairing.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.</p><span className="device-pairing-wait">● Menunggu persetujuan Owner...</span>
      </>}
      {error && <div className="device-pairing-error">{error}</div>}
    </section>
  </main>;
}
