"use client";

import { useEffect, useRef, useState } from "react";
import { createDevicePin, devicePinKey, hashDevicePin, readDevicePin } from "@/lib/device-pin";
import "./cashier-pin.css";

export default function CashierPinGate({ deviceId, tenant, children }: {
  deviceId: string; tenant: string; children: React.ReactNode;
}) {
  const [mode, setMode] = useState<"loading" | "setup" | "unlock" | "error">("loading");
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setMode(readDevicePin(deviceId) ? "unlock" : "setup"); }
      catch { setMode("error"); setError("Penyimpanan PIN tidak dapat dibaca. Aktifkan penyimpanan browser atau hubungi Owner untuk pairing ulang."); }
    }, 0);
    const lock = () => { generation.current++; setUnlocked(false); setPin(""); setConfirmation(""); };
    const storage = (event: StorageEvent) => { if (event.key === devicePinKey(deviceId) || event.key === null) lock(); };
    window.addEventListener("storage", storage);
    return () => {
      // This is a request generation counter, not a DOM ref; invalidate pending verification.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      window.clearTimeout(timer);
      window.removeEventListener("storage", storage);
    };
  }, [deviceId]);

  if (unlocked) return <>{children}<button className="cashier-lock-button" onClick={() => { setUnlocked(false); setPin(""); }}>Kunci Kasir</button></>;

  return <main className="device-pairing-page"><section className="device-pairing-card">
    <small>OKESIH KASIR · {tenant}</small>
    <h1>{mode === "setup" ? "Buat PIN Kasir" : "Masukkan PIN Kasir"}</h1>
    <p>{mode === "setup" ? "Buat PIN 6 angka untuk mengunci layar perangkat ini. PIN akan diminta setiap aplikasi dibuka kembali." : "Layar Kasir terkunci. Masukkan PIN perangkat untuk mulai bekerja."}</p>
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (inFlight.current || mode === "error" || mode === "loading") return;
      inFlight.current = true; setBusy(true); setError("");
      const attemptGeneration = generation.current;
      try {
        if (!/^\d{6}$/.test(pin)) throw new Error("PIN harus terdiri dari 6 angka.");
        let record = readDevicePin(deviceId);
        if (!record) {
          if (mode !== "setup") throw new Error("Data PIN hilang. Hubungi Owner sebelum menggunakan perangkat ini.");
          if (pin !== confirmation) throw new Error("Konfirmasi PIN belum sama.");
          record = await createDevicePin(pin);
        } else {
          if (Date.now() < record.retryAt) throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((record.retryAt - Date.now()) / 1000)} detik.`);
          if (await hashDevicePin(pin, record.salt) !== record.hash) {
            record.failures++;
            record.retryAt = record.failures >= 5 ? Date.now() + 60_000 : 0;
            localStorage.setItem(devicePinKey(deviceId), JSON.stringify(record));
            throw new Error(record.failures >= 5 ? "PIN salah. Tunggu 60 detik sebelum mencoba lagi." : "PIN salah. Silakan coba kembali.");
          }
        }
        localStorage.setItem(devicePinKey(deviceId), JSON.stringify({ ...record, failures: 0, retryAt: 0 }));
        setMode("unlock"); setPin(""); setConfirmation("");
        if (attemptGeneration === generation.current) setUnlocked(true);
      } catch (reason) { setError(reason instanceof Error ? reason.message : "PIN tidak dapat diverifikasi."); }
      finally { inFlight.current = false; setBusy(false); }
    }}>
      <label>PIN 6 angka<input aria-label="PIN Kasir" type="password" inputMode="numeric" pattern="[0-9]{6}" autoComplete="off" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} required disabled={busy || mode === "loading" || mode === "error"}/></label>
      {mode === "setup" && <label>Ulangi PIN<input aria-label="Konfirmasi PIN Kasir" type="password" inputMode="numeric" pattern="[0-9]{6}" autoComplete="off" maxLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value.replace(/\D/g, ""))} required disabled={busy}/></label>}
      {error && <p className="device-pairing-error" role="alert">{error}</p>}
      <button className="btn-primary" type="submit" disabled={busy || mode === "loading" || mode === "error"}>{busy ? "Memeriksa..." : mode === "setup" ? "Simpan PIN & Buka Kasir" : "Buka Kasir"}</button>
    </form>
    <p>PIN ini adalah pengunci layar lokal, bukan akun staf. Lupa PIN? Minta Owner mencabut perangkat, lalu lakukan pairing ulang.</p>
  </section></main>;
}
