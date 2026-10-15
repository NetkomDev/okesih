"use client";

import { useCallback, useEffect, useState } from "react";
import { createCashierClient } from "@/lib/supabase/client";
import PwaInstallButton from "@/components/PwaInstallButton";
import "./cashier-shift.css";

type ActiveShift = {
  id: string;
  cashierId: string;
  cashierName: string;
  deviceId: string;
  deviceName: string;
  openedAt: string;
  expectedCash: number;
};

type SessionState = {
  authenticated: boolean;
  cashier?: { id: string; username: string; name: string };
  shift: ActiveShift | null;
  ownsActiveShift?: boolean;
};

async function accessToken() {
  const supabase = createCashierClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

async function cashierRequest(path: string, init?: RequestInit) {
  const token = await accessToken();
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: { ...init?.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Sesi kasir gagal diproses.");
  return body;
}

export default function CashierShiftGate({ tenant, pendingCount, onShiftChanged, children }: {
  tenant: string;
  pendingCount: number;
  onShiftChanged: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadSession = useCallback(async () => {
    const body = await cashierRequest("/api/device/cashier-session");
    setSession(body);
    return body as SessionState;
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const body = await cashierRequest("/api/device/cashier-session");
        if (!cancelled) setSession(body);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Sesi kasir gagal dimuat.");
      }
    });
    return () => { cancelled = true; };
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    const supabase = createCashierClient();
    try {
      const email = username.includes("@") ? username.trim().toLowerCase() : `${username.trim().toLowerCase()}@okesih.local`;
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw new Error(loginError.message === "Invalid login credentials" ? "Username atau password kasir salah." : loginError.message);
      await cashierRequest("/api/device/cashier-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      await loadSession();
      await onShiftChanged();
      setPassword("");
    } catch (reason) {
      await supabase.auth.signOut();
      setSession((current) => ({ authenticated: false, shift: current?.shift || null }));
      setError(reason instanceof Error ? reason.message : "Kasir gagal masuk.");
    } finally {
      setBusy(false);
    }
  };

  const startExistingSession = async () => {
    setBusy(true); setError("");
    try {
      await cashierRequest("/api/device/cashier-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      await loadSession();
      await onShiftChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Shift gagal dimulai.");
    } finally {
      setBusy(false);
    }
  };

  const changeAccount = async () => {
    await createCashierClient().auth.signOut();
    setSession((current) => ({ authenticated: false, shift: current?.shift || null }));
    setError("");
  };

  const endShift = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pendingCount > 0) {
      setError("Sinkronkan seluruh perubahan offline sebelum mengakhiri shift.");
      return;
    }
    setBusy(true); setError("");
    const supabase = createCashierClient();
    try {
      await cashierRequest("/api/device/cashier-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", actualCash: Number(actualCash || 0), notes }),
      });
      await supabase.auth.signOut();
      setClosing(false); setActualCash(""); setNotes(""); setPassword("");
      await onShiftChanged();
      await loadSession();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Shift gagal diakhiri.");
    } finally {
      setBusy(false);
    }
  };

  if (!session) return <main className="device-loading"><b>{error || "Memeriksa sesi kasir..."}</b></main>;

  if (!session.authenticated || !session.ownsActiveShift) {
    return <main className="device-pairing-page"><section className="device-pairing-card cashier-login-card">
      <small>OKESIH KASIR · {tenant}</small>
      <h1>Masuk Kasir</h1>
      <p>Gunakan akun kasir yang dibuat Owner. Login ini sekaligus membuka shift kerja pada perangkat yang sudah dipairing.</p>
      {session.shift && <div className="cashier-active-warning"><b>Shift masih aktif</b><span>{session.shift.cashierName} · {session.shift.deviceName}</span></div>}
      {session.authenticated && session.cashier ? <div className="cashier-resume-session">
        <b>{session.cashier.name}</b><span>@{session.cashier.username}</span>
        {error && <p className="device-pairing-error" role="alert">{error}</p>}
        <button className="btn-primary" disabled={busy} onClick={() => void startExistingSession()}>{busy ? "Membuka shift..." : "Mulai / Lanjutkan Shift"}</button>
        <button className="btn-secondary" disabled={busy} onClick={() => void changeAccount()}>Gunakan Akun Lain</button>
      </div> : <form onSubmit={login}>
        <label>Username Kasir<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required minLength={3}/></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6}/></label>
        {error && <p className="device-pairing-error" role="alert">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Membuka shift..." : "Masuk & Mulai Shift"}</button>
      </form>}
      <PwaInstallButton label="Pasang Aplikasi Kasir"/>
      <p>Belum memiliki akun? Minta Owner membuat akun dengan peran Kasir.</p>
    </section></main>;
  }

  return <>
    {children}
    <button className="cashier-shift-button" onClick={() => { setError(""); setClosing(true); }}>
      <span>● {session.cashier?.name}</span><b>Akhiri Shift</b>
    </button>
    {closing && <div className="ops-modal-backdrop"><section className="ops-modal cashier-close-modal">
      <button className="ops-modal-close" onClick={() => setClosing(false)}>×</button>
      <small>PERGANTIAN KASIR</small><h2>Akhiri Shift</h2>
      <p>Hitung uang tunai fisik di laci sebelum keluar.</p>
      <div className="cashier-expected"><span>Kas tunai menurut sistem</span><b>Rp {Number(session.shift?.expectedCash || 0).toLocaleString("id-ID")}</b></div>
      <form onSubmit={endShift}>
        <label>Kas fisik diserahkan (Rp)<input type="number" inputMode="numeric" min="0" value={actualCash} onChange={(event) => setActualCash(event.target.value)} required/></label>
        <label>Catatan (opsional)<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)}/></label>
        {error && <p className="device-pairing-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? "Menutup shift..." : "Simpan, Keluar & Ganti Kasir"}</button>
      </form>
    </section></div>}
  </>;
}
