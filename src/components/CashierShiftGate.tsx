"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createCashierClient } from "@/lib/supabase/client";
import PwaInstallButton from "@/components/PwaInstallButton";
import "./cashier-shift.css";

export type CashierShiftContextType = {
  cashierName?: string;
  cashierUsername?: string;
  expectedCash: number;
  openEndShiftModal: () => void;
};

export const CashierShiftContext = createContext<CashierShiftContextType | null>(null);

export function useCashierShift() {
  return useContext(CashierShiftContext);
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [error, setError] = useState("");

  const loadSession = useCallback(async () => {
    try {
      const body = await cashierRequest("/api/device/cashier-session");
      setSession(body);
      return body as SessionState;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sesi kasir gagal dimuat.");
      return null;
    }
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

  // Real-time synchronization for cashier shift & cash calculations
  useEffect(() => {
    const supabase = createCashierClient();
    const channel = supabase
      .channel("cashier-shift-realtime-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          void loadSession();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        () => {
          void loadSession();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSession]);

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
    setShowPassword(false);
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
      const numericActualCash = Number(actualCash.replace(/\D/g, "") || 0);
      await cashierRequest("/api/device/cashier-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", actualCash: numericActualCash, notes }),
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
        <label>
          <span>Password</span>
          <div style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", marginTop: "8px" }}>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              style={{
                width: "100%",
                marginTop: 0,
                paddingRight: "86px",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              style={{
                position: "absolute",
                right: "8px",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px 8px",
                fontSize: "12px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                color: "#94a3b8",
                borderRadius: "8px",
                userSelect: "none",
              }}
            >
              {showPassword ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  <span>Tutup</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>Lihat</span>
                </>
              )}
            </button>
          </div>
        </label>
        {error && <p className="device-pairing-error" role="alert">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Membuka shift..." : "Masuk & Mulai Shift"}</button>
      </form>}
      <PwaInstallButton label="Pasang Aplikasi Kasir"/>
      <p>Belum memiliki akun? Minta Owner membuat akun dengan peran Kasir.</p>
    </section></main>;
  }

  return (
    <CashierShiftContext.Provider
      value={{
        cashierName: session.cashier?.name,
        cashierUsername: session.cashier?.username,
        expectedCash: session.shift?.expectedCash || 0,
        openEndShiftModal: () => {
          setError("");
          setClosing(true);
          void loadSession();
        },
      }}
    >
      {children}
      {closing && <div className="ops-modal-backdrop"><section className="ops-modal cashier-close-modal">
        <button className="ops-modal-close" onClick={() => setClosing(false)}>×</button>
        <small>PERGANTIAN KASIR</small><h2>Akhiri Shift</h2>
        <p>Hitung uang tunai fisik di laci sebelum keluar.</p>
        <div className="cashier-expected">
          <div>
            <span>Kas tunai menurut sistem</span>
            <b>Rp {Number(session.shift?.expectedCash || 0).toLocaleString("id-ID")}</b>
          </div>
          <button
            type="button"
            className="cashier-refresh-cash-btn"
            disabled={refreshingSession}
            onClick={async () => {
              setRefreshingSession(true);
              try {
                await loadSession();
              } finally {
                setRefreshingSession(false);
              }
            }}
            title="Sinkronkan kas tunai terbaru"
          >
            {refreshingSession ? "..." : "🔄 Sinkronkan"}
          </button>
        </div>
        <form onSubmit={endShift}>
          <label>
            Kas fisik diserahkan (Rp)
            <input
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 50.000"
              value={actualCash}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                setActualCash(digits ? Number(digits).toLocaleString("id-ID") : "");
              }}
              required
            />
          </label>
          <label>Catatan (opsional)<textarea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)}/></label>
          {error && <p className="device-pairing-error" role="alert">{error}</p>}
          <button className="primary" type="submit" disabled={busy}>{busy ? "Menutup shift..." : "Simpan, Keluar & Ganti Kasir"}</button>
        </form>
      </section></div>}
    </CashierShiftContext.Provider>
  );
}
