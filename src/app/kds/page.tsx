"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import DevicePairing from "@/components/DevicePairing";
import DevicePwaModal from "@/components/DevicePwaModal";
import PwaInstallButton from "@/components/PwaInstallButton";
import { type DeviceOrder, useDeviceApp } from "@/lib/use-device-app";

function playKitchenBell(ctx: AudioContext) {
  const now = ctx.currentTime;
  const strikes = [
    { high: 1046, low: 784, start: 0 },
    { high: 1046, low: 784, start: 0.38 },
  ];
  strikes.forEach(({ high, low, start }) => {
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(high, now + start);
    gain1.gain.setValueAtTime(0.85, now + start);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + start + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now + start);
    osc1.stop(now + start + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(low, now + start + 0.08);
    gain2.gain.setValueAtTime(0.8, now + start + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + start + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + start + 0.08);
    osc2.stop(now + start + 0.35);
  });
}

function playKitchenSound(ctx?: AudioContext | null) {
  try {
    const audio = new Audio("/sound/dingdong-kds.mp3");
    audio.volume = 1.0;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        if (ctx) playKitchenBell(ctx);
      });
    }
  } catch {
    if (ctx) playKitchenBell(ctx);
  }
}

export default function KdsModulePage() {
  const app = useDeviceApp("KDS");
  const [busyId, setBusyId] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const prevReadyIds = useRef<Set<string> | null>(null);
  const lastChimedReadyId = useRef<string>("");

  const getAudioContext = () => {
    if (!audio.current && typeof window !== "undefined") {
      const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Audio) audio.current = new Audio();
    }
    if (audio.current && audio.current.state === "suspended") {
      void audio.current.resume();
    }
    return audio.current;
  };

  useEffect(() => {
    const unlock = () => {
      const ctx = getAudioContext();
      if (ctx) {
        setAudioUnlocked(true);
        if (ctx.state === "suspended") void ctx.resume();
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const cooking = app.data?.orders.filter((order) => order.status_pesanan === "COOKING") || [];
  const ready = app.data?.orders.filter((order) => order.status_pesanan === "READY") || [];

  useEffect(() => {
    if (!app.data) return;
    const currentReadyIds = new Set(ready.map((order) => order.id));
    if (prevReadyIds.current === null) {
      prevReadyIds.current = currentReadyIds;
      return;
    }

    const newReadyOrders = ready.filter((order) => !prevReadyIds.current!.has(order.id));
    prevReadyIds.current = currentReadyIds;

    if (newReadyOrders.length > 0 && audioEnabled) {
      const needsChime = newReadyOrders.some((order) => order.id !== lastChimedReadyId.current);
      if (needsChime) {
        const ctx = getAudioContext();
        if (ctx && ctx.state === "suspended") {
          void ctx.resume().then(() => {
            playKitchenSound(ctx);
          });
        } else {
          playKitchenSound(ctx);
        }
      }
    }
  }, [app.data, audioEnabled, ready]);

  if (app.authorized === false) return <DevicePairing type="KDS" pairing={app.pairing} error={app.error} onBegin={app.beginPairing}/>;
  if (!app.data) return <div className="device-loading"><Image src="/okesih-logo-animated.svg" width={90} height={90} alt="OKESIH"/><b>{app.error || "Menyiapkan Dapur..."}</b></div>;

  const transition = async (order: DeviceOrder, status: "READY" | "DONE") => {
    setBusyId(order.id); app.setError("");
    try {
      await app.transitionOrder(order.id, status);
      if (status === "READY" && audioEnabled) {
        lastChimedReadyId.current = order.id;
        const ctx = getAudioContext();
        playKitchenSound(ctx);
      }
    }
    catch (reason) { app.setError(reason instanceof Error ? reason.message : "Status tiket gagal diperbarui."); }
    finally { setBusyId(""); }
  };

  const toggleOrTestAudio = () => {
    const ctx = getAudioContext();
    if (!audioEnabled) {
      setAudioEnabled(true);
      if (ctx) {
        setAudioUnlocked(true);
        void ctx.resume().then(() => playKitchenSound(ctx));
      } else {
        playKitchenSound(null);
      }
    } else {
      if (ctx) {
        setAudioUnlocked(true);
        void ctx.resume().then(() => playKitchenSound(ctx));
      } else {
        playKitchenSound(null);
      }
    }
  };

  const serverNow = new Date(app.data.serverTime).getTime();
  return (
    <div className="ops-app kds-app">
      <DevicePwaModal type="KDS" isOpen={pwaModalOpen} onClose={() => setPwaModalOpen(false)} />
      
      <header className="kds-header">
        <div className="kds-brand">
          <div className="kds-brand-logo">
            {app.data.profile.logo_url ? (
              <img src={app.data.profile.logo_url} alt={`Logo ${app.data.profile.nama}`} />
            ) : (
              <Image src="/logo.svg?v=2" width={42} height={42} alt="OKESIH" />
            )}
          </div>
          <div>
            <small>OKESIH <span>DAPUR · KDS</span></small>
            <strong>{app.data.profile.nama}</strong>
          </div>
        </div>

        <div className="kds-header-actions">
          <span className={app.online ? "kds-chip kds-online" : "kds-chip kds-offline"}>
            <i /> {app.online ? "Online" : "Offline"}
          </span>
          {app.pendingCount > 0 && (
            <span className="kds-chip kds-sync">
              ⚡ {app.pendingCount} antrean sync
            </span>
          )}
          <button
            type="button"
            className={`kds-btn kds-btn-bell ${audioEnabled && audioUnlocked ? "active" : ""}`}
            onClick={toggleOrTestAudio}
            title="Klik untuk tes suara bel dapur"
          >
            <span>🔔</span>
            <b>{audioEnabled ? (audioUnlocked ? "Bel Aktif" : "Aktifkan Bel") : "Bel Senyap"}</b>
          </button>
          <div className="kds-device-chip" title={app.data.device.name}>
            <span>KDS</span>
            <b>{app.data.device.name}</b>
          </div>
          <button
            type="button"
            className="kds-btn kds-btn-refresh"
            onClick={() => void app.refresh()}
            title="Sinkronkan pesanan terbaru"
          >
            <span>↻</span>
            <b>Sinkronkan</b>
          </button>
        </div>
      </header>

      {app.cachedAt && (
        <div className="kds-notice kds-notice-warning">
          Mode offline · perubahan status akan dikirim saat koneksi kembali.
        </div>
      )}
      {!audioUnlocked && (
        <div
          className="kds-notice kds-notice-audio"
          onClick={() => {
            const ctx = getAudioContext();
            if (ctx) {
              setAudioUnlocked(true);
              void ctx.resume();
            }
          }}
        >
          🔔 Ketuk layar tablet dapur sekali untuk mengaktifkan dering pesanan siap diantar otomatis.
        </div>
      )}
      {app.error && (
        <div className="kds-notice kds-notice-error">
          <span>{app.error}</span>
          <button onClick={() => app.setError("")}>×</button>
        </div>
      )}

      <main className="kds-board">
        {/* Kolom 1: Sedang Disiapkan */}
        <section className="kds-column kds-column-cooking">
          <header className="kds-col-header">
            <div className="kds-col-title">
              <span className="kds-col-tag cooking">PROSES DAPUR</span>
              <h1>Sedang Disiapkan</h1>
            </div>
            <div className="kds-badge cooking">
              <b>{cooking.length}</b>
              <span>Tiket Aktif</span>
            </div>
          </header>

          <div className="kds-grid">
            {cooking.length === 0 ? (
              <Empty icon="♨" title="Dapur Bersih" text="Belum ada pesanan yang perlu disiapkan." />
            ) : (
              cooking.map((order) => (
                <Ticket
                  key={order.id}
                  now={serverNow}
                  order={order}
                  action="✓ Siap Diantar"
                  busy={busyId === order.id}
                  onAction={() => void transition(order, "READY")}
                />
              ))
            )}
          </div>
        </section>

        {/* Kolom 2: Siap Diantar */}
        <section className="kds-column kds-column-ready">
          <header className="kds-col-header">
            <div className="kds-col-title">
              <span className="kds-col-tag ready">PENGANTARAN</span>
              <h2>Siap Diantar</h2>
            </div>
            <div className="kds-badge ready">
              <b>{ready.length}</b>
              <span>Siap Diambil</span>
            </div>
          </header>

          <div className="kds-grid">
            {ready.length === 0 ? (
              <Empty icon="✓" title="Semua Terantar" text="Belum ada pesanan yang menunggu diambil." />
            ) : (
              ready.map((order) => (
                <Ticket
                  key={order.id}
                  now={serverNow}
                  order={order}
                  action="★ Sudah Diambil"
                  busy={busyId === order.id}
                  onAction={() => void transition(order, "DONE")}
                />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Ticket({
  order,
  action,
  busy,
  onAction,
  now,
}: {
  order: DeviceOrder;
  action: string;
  busy: boolean;
  onAction: () => void;
  now: number;
}) {
  const age = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60_000));
  const isCooking = order.status_pesanan === "COOKING";
  const orderedAtCashier = order.waiter_name?.startsWith("Kasir:");
  const paymentLabel = orderedAtCashier
    ? (order.payment_method === "CASH" ? "TUNAI DI KASIR" : "QRIS DI KASIR")
    : (order.payment_method === "CASH" ? "TUNAI · TAGIH" : "QRIS LUNAS");

  const urgencyClass = age >= 15 ? "urgent" : age >= 8 ? "warn" : "normal";

  return (
    <article className={`kds-card ${isCooking ? "status-cooking" : "status-ready"} ${urgencyClass}`}>
      <header className="kds-card-header">
        <div className="kds-card-id">
          <strong>#{String(order.nomor_antrean).padStart(3, "0")}</strong>
          <span className="kds-card-location">
            {order.table_number === "Kasir" ? "PESANAN KASIR / TAKEAWAY" : `MEJA ${order.table_number}`}
          </span>
        </div>
        <div className={`kds-card-timer ${urgencyClass}`} title="Waktu sejak pesanan masuk">
          <span className="timer-icon">⏱</span>
          <b>{age}m</b>
        </div>
      </header>

      <div className="kds-card-items">
        {order.items.map((item) => (
          <div key={item.id} className="kds-item-row">
            <span className="kds-item-qty">{item.qty}×</span>
            <div className="kds-item-desc">
              <span className="kds-item-name">{item.nama_menu}</span>
              {item.notes && <span className="kds-item-notes">Catatan: {item.notes}</span>}
            </div>
          </div>
        ))}
      </div>

      <footer className="kds-card-footer">
        <div className="kds-card-meta">
          <span className={`kds-payment-pill ${order.payment_method === "CASH" ? "cash" : "qris"}`}>
            {paymentLabel}
          </span>
        </div>
        <button
          type="button"
          className={`kds-action-btn ${isCooking ? "btn-ready" : "btn-done"}`}
          disabled={busy}
          onClick={onAction}
        >
          {busy ? "Memproses..." : action}
        </button>
      </footer>
    </article>
  );
}

function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="kds-empty-box">
      <div className="kds-empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
