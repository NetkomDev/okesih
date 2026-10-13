"use client";

import Image from "next/image";
import { useState } from "react";
import DevicePairing from "@/components/DevicePairing";
import PwaInstallButton from "@/components/PwaInstallButton";
import { type DeviceOrder, useDeviceApp } from "@/lib/use-device-app";

export default function KdsModulePage() {
  const app = useDeviceApp("KDS");
  const [busyId, setBusyId] = useState("");
  if (app.authorized === false) return <DevicePairing type="KDS" pairing={app.pairing} error={app.error} onBegin={app.beginPairing}/>;
  if (!app.data) return <div className="device-loading"><Image src="/okesih-logo-animated.svg" width={90} height={90} alt="OKESIH"/><b>{app.error || "Menyiapkan Dapur..."}</b></div>;

  const transition = async (order: DeviceOrder, status: "READY" | "DONE") => {
    setBusyId(order.id); app.setError("");
    try { await app.transitionOrder(order.id, status); }
    catch (reason) { app.setError(reason instanceof Error ? reason.message : "Status tiket gagal diperbarui."); }
    finally { setBusyId(""); }
  };

  const cooking = app.data.orders.filter((order) => order.status_pesanan === "COOKING");
  const ready = app.data.orders.filter((order) => order.status_pesanan === "READY");
  const serverNow = new Date(app.data.serverTime).getTime();
  return <div className="ops-app kds-app">
    <header className="ops-header"><div className="ops-brand">{app.data.profile.logo_url ? <img src={app.data.profile.logo_url} alt={`Logo ${app.data.profile.nama}`}/> : <Image src="/logo.svg?v=2" width={42} height={42} alt="OKESIH"/>}<div><small>OKESIH DAPUR / KDS</small><strong>{app.data.profile.nama}</strong></div></div><div className="ops-actions"><span className={app.online ? "ops-online" : "ops-offline"}>● {app.online ? "Online" : "Offline"}</span>{app.pendingCount > 0 && <span className="ops-sync">{app.pendingCount} antrean sync</span>}<PwaInstallButton compact label="Install KDS"/><button onClick={() => void app.refresh()}>↻ Sinkronkan</button></div></header>
    {app.cachedAt && <div className="ops-warning">Mode offline · perubahan status akan dikirim saat koneksi kembali.</div>}{app.error && <div className="ops-error">{app.error}<button onClick={() => app.setError("")}>×</button></div>}
    <main className="kds-board"><section><header><div><small>SEDANG DISIAPKAN</small><h1>{cooking.length} Tiket Aktif</h1></div></header><div className="kds-grid">{cooking.length === 0 && <Empty text="Belum ada pesanan yang perlu disiapkan."/>}{cooking.map((order) => <Ticket key={order.id} now={serverNow} order={order} action="Siap Diantar" busy={busyId === order.id} onAction={() => void transition(order, "READY")}/>)}</div></section><section className="ready-column"><header><div><small>SIAP DIANTAR</small><h2>{ready.length} Tiket</h2></div></header><div className="kds-grid">{ready.length === 0 && <Empty text="Belum ada pesanan siap."/>}{ready.map((order) => <Ticket key={order.id} now={serverNow} order={order} action="Sudah Diambil" busy={busyId === order.id} onAction={() => void transition(order, "DONE")}/>)}</div></section></main>
  </div>;
}

function Ticket({ order, action, busy, onAction, now }: { order: DeviceOrder; action: string; busy: boolean; onAction: () => void; now: number }) {
  const age = Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60_000));
  return <article className={`kds-ticket ${age >= 15 ? "late" : age >= 8 ? "warn" : ""}`}><header><div><strong>#{String(order.nomor_antrean).padStart(3, "0")}</strong><b>Meja {order.table_number}</b></div><span>{age} menit</span></header><div className="kds-ticket-items">{order.items.map((item) => <div key={item.id}><b>{item.qty}×</b><span>{item.nama_menu}{item.notes && <small>Catatan: {item.notes}</small>}</span></div>)}</div><footer><span className={order.payment_method === "CASH" ? "cash" : "qris"}>{order.payment_method === "CASH" ? "TUNAI — WAJIB TAGIH" : "QRIS LUNAS"}</span><button disabled={busy} onClick={onAction}>{busy ? "Menyimpan..." : action}</button></footer></article>;
}

function Empty({ text }: { text: string }) { return <div className="ops-empty"><span>✓</span><p>{text}</p></div>; }
