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
  return <div className="ops-app kds-app">
    <DevicePwaModal type="KDS" isOpen={pwaModalOpen} onClose={() => setPwaModalOpen(false)}/>
    <header className="ops-header"><div className="ops-brand">{app.data.profile.logo_url ? <img src={app.data.profile.logo_url} alt={`Logo ${app.data.profile.nama}`}/> : <Image src="/logo.svg?v=2" width={42} height={42} alt="OKESIH"/>}<div><small>OKESIH DAPUR / KDS</small><strong>{app.data.profile.nama}</strong></div></div><div className="ops-actions"><span className={app.online ? "ops-online" : "ops-offline"}>● {app.online ? "Online" : "Offline"}</span>{app.pendingCount > 0 && <span className="ops-sync">{app.pendingCount} antrean sync</span>}<button className="pwa-install compact" onClick={() => setPwaModalOpen(true)} title="Pasang aplikasi Dapur KDS ke Layar Utama (Landscape Fullscreen)">📲 Pasang KDS</button><button onClick={toggleOrTestAudio} title="Klik untuk tes suara bel dapur">🔊 {audioEnabled ? (audioUnlocked ? "Bel Dapur Aktif (Tes)" : "Aktifkan Bel") : "Bel Senyap"}</button><button onClick={() => void app.refresh()}>↻ Sinkronkan</button></div></header>
    {app.cachedAt && <div className="ops-warning">Mode offline · perubahan status akan dikirim saat koneksi kembali.</div>}
    {!audioUnlocked && <div className="ops-warning" style={{ background: "#eff6ff", color: "#1d4ed8", cursor: "pointer" }} onClick={() => { const ctx = getAudioContext(); if (ctx) { setAudioUnlocked(true); void ctx.resume(); } }}>🔔 Ketuk layar tablet dapur sekali untuk mengaktifkan dering pesanan siap diantar otomatis.</div>}
    {app.error && <div className="ops-error">{app.error}<button onClick={() => app.setError("")}>×</button></div>}
    <main className="kds-board"><section><header><div><small>SEDANG DISIAPKAN</small><h1>{cooking.length} Tiket Aktif</h1></div></header><div className="kds-grid">{cooking.length === 0 && <Empty text="Belum ada pesanan yang perlu disiapkan."/>}{cooking.map((order) => <Ticket key={order.id} now={serverNow} order={order} action="Siap Diantar" busy={busyId === order.id} onAction={() => void transition(order, "READY")}/>)}</div></section><section className="ready-column"><header><div><small>SIAP DIANTAR</small><h2>{ready.length} Tiket</h2></div></header><div className="kds-grid">{ready.length === 0 && <Empty text="Belum ada pesanan siap."/>}{ready.map((order) => <Ticket key={order.id} now={serverNow} order={order} action="Sudah Diambil" busy={busyId === order.id} onAction={() => void transition(order, "DONE")}/>)}</div></section></main>
  </div>;
}

function Ticket({ order, action, busy, onAction, now }: { order: DeviceOrder; action: string; busy: boolean; onAction: () => void; now: number }) {
  const age = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60_000));
  return <article className={`kds-ticket ${age >= 15 ? "late" : age >= 8 ? "warn" : ""}`}><header><div><strong>#{String(order.nomor_antrean).padStart(3, "0")}</strong><b>Meja {order.table_number}</b></div><span>{age} menit</span></header><div className="kds-ticket-items">{order.items.map((item) => <div key={item.id}><b>{item.qty}×</b><span>{item.nama_menu}{item.notes && <small>Catatan: {item.notes}</small>}</span></div>)}</div><footer><span className={order.payment_method === "CASH" ? "cash" : "qris"}>{order.payment_method === "CASH" ? "TUNAI — WAJIB TAGIH" : "QRIS LUNAS"}</span><button disabled={busy} onClick={onAction}>{busy ? "Menyimpan..." : action}</button></footer></article>;
}

function Empty({ text }: { text: string }) { return <div className="ops-empty"><span>✓</span><p>{text}</p></div>; }
