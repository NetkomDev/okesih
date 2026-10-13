"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import DevicePairing from "@/components/DevicePairing";
import PwaInstallButton from "@/components/PwaInstallButton";
import { type DeviceOrder, useDeviceApp } from "@/lib/use-device-app";

export default function PosModulePage() {
  const app = useDeviceApp("POS");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [selected, setSelected] = useState<DeviceOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const pending = app.data?.orders.filter((order) => order.status_pesanan === "AWAITING_CONFIRMATION") || [];

  useEffect(() => {
    if (!audioEnabled || pending.length === 0) return;
    const beep = () => {
      const context = audio.current;
      if (!context) return;
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.frequency.setValueAtTime(880, context.currentTime); gain.gain.setValueAtTime(0.18, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.35);
    };
    beep(); const timer = window.setInterval(beep, 1800); return () => window.clearInterval(timer);
  }, [audioEnabled, pending.length]);

  if (app.authorized === false) return <DevicePairing type="POS" pairing={app.pairing} error={app.error} onBegin={app.beginPairing}/>;
  if (!app.data) return <div className="device-loading"><Image src="/okesih-logo-animated.svg" width={90} height={90} alt="OKESIH"/><b>{app.error || "Menyiapkan Kasir..."}</b></div>;

  const update = async (order: DeviceOrder, status: "COOKING" | "DONE" | "REJECTED") => {
    setBusy(true); app.setError("");
    try { await app.transitionOrder(order.id, status); setSelected(null); }
    catch (reason) { app.setError(reason instanceof Error ? reason.message : "Pesanan gagal diperbarui."); }
    finally { setBusy(false); }
  };

  return <div className="ops-app pos-app">
    <header className="ops-header"><div className="ops-brand"><Image src="/logo.svg?v=2" width={42} height={42} alt="OKESIH"/><div><small>OKESIH KASIR</small><strong>{app.data.profile.nama}</strong></div></div><div className="ops-actions"><span className={app.online ? "ops-online" : "ops-offline"}>● {app.online ? "Online" : "Offline"}</span>{app.pendingCount > 0 && <span className="ops-sync">{app.pendingCount} menunggu sinkronisasi</span>}<PwaInstallButton compact label="Install Kasir"/><button onClick={() => { const Audio = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext; audio.current ||= new Audio(); void audio.current.resume(); setAudioEnabled(true); }}>🔊 {audioEnabled ? "Audio Aktif" : "Aktifkan Audio"}</button></div></header>
    {app.cachedAt && <div className="ops-warning">Mode offline · data terakhir {new Date(app.cachedAt).toLocaleTimeString("id-ID")}. Perubahan akan disinkronkan otomatis.</div>}
    {app.error && <div className="ops-error">{app.error}<button onClick={() => app.setError("")}>×</button></div>}
    <main className="ops-main"><section className="ops-summary"><div><small>MENUNGGU KONFIRMASI</small><strong>{pending.length}</strong></div><div><small>SEDANG DIMASAK</small><strong>{app.data.orders.filter((order) => order.status_pesanan === "COOKING").length}</strong></div><div><small>SIAP DIANTAR</small><strong>{app.data.orders.filter((order) => order.status_pesanan === "READY").length}</strong></div><div><small>PERANGKAT</small><strong>{app.data.device.name}</strong></div></section>
      <section className="ops-section"><div className="ops-title"><div><small>TRANSAKSI MASUK</small><h1>Konfirmasi Pesanan</h1></div><button onClick={() => void app.refresh()}>↻ Muat Ulang</button></div><div className="ops-order-grid">{pending.length === 0 && <div className="ops-empty"><span>✓</span><h2>Semua pesanan sudah ditangani</h2><p>Pesanan baru akan muncul otomatis.</p></div>}{pending.map((order) => <OrderCard key={order.id} order={order} onOpen={() => setSelected(order)}/>)}</div></section>
      <section className="ops-section"><div className="ops-title"><div><small>PROSES BERJALAN</small><h2>Dapur &amp; Pengantaran</h2></div></div><div className="ops-order-grid compact">{app.data.orders.filter((order) => order.status_pesanan !== "AWAITING_CONFIRMATION").map((order) => <OrderCard key={order.id} order={order} onOpen={() => setSelected(order)}/>)}</div></section>
    </main>
    {selected && <div className="ops-modal-backdrop"><section className="ops-modal"><button className="ops-modal-close" onClick={() => setSelected(null)}>×</button><small>ANTREAN #{String(selected.nomor_antrean).padStart(3, "0")}</small><h2>Meja {selected.table_number}</h2><div className={`ops-payment ${selected.payment_method.toLowerCase()}`}>{selected.payment_method === "CASH" ? "💵 BAYAR TUNAI" : "▣ QRIS — VERIFIKASI BUKTI"}</div>{selected.payment_proof_url && <a className="ops-proof" href={selected.payment_proof_url} target="_blank" rel="noreferrer">Buka Bukti Pembayaran</a>}<div className="ops-items">{selected.items.map((item) => <div key={item.id}><span>{item.qty}× {item.nama_menu}{item.notes && <small>{item.notes}</small>}</span><b>Rp {(Number(item.harga_satuan) * item.qty).toLocaleString("id-ID")}</b></div>)}</div><strong className="ops-total">Total Rp {Number(selected.total_harga).toLocaleString("id-ID")}</strong>{selected.status_pesanan === "AWAITING_CONFIRMATION" ? <div className="ops-modal-actions"><button disabled={busy} className="danger" onClick={() => void update(selected, "REJECTED")}>Tolak</button><button disabled={busy} className="primary" onClick={() => void update(selected, "COOKING")}>{busy ? "Menyimpan..." : "Konfirmasi & Kirim ke Dapur"}</button></div> : selected.status_pesanan === "READY" ? <button disabled={busy} className="primary" onClick={() => void update(selected, "DONE")}>Tandai Sudah Diantar</button> : <p>Status: {selected.status_pesanan}</p>}</section></div>}
  </div>;
}

function OrderCard({ order, onOpen }: { order: DeviceOrder; onOpen: () => void }) {
  return <button className={`ops-order-card ${order.status_pesanan.toLowerCase()}`} onClick={onOpen}><div><span>#{String(order.nomor_antrean).padStart(3, "0")}</span><b>Meja {order.table_number}</b></div><small>{order.items.reduce((sum, item) => sum + item.qty, 0)} item · {new Date(order.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</small><strong>Rp {Number(order.total_harga).toLocaleString("id-ID")}</strong><em>{order.payment_method === "CASH" ? "TUNAI" : "QRIS"}</em></button>;
}
