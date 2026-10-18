"use client";
import { APP_HOSTS,appUrl } from "@/lib/app-origins";
import { useState } from "react";
import { ownerFetch } from "./helpers";
import { useOwnerData } from "./provider";
function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="owner-empty"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div>;
}
export default function DevicesFeature() {
const { ready, error, setError, notice, setNotice, busy, setBusy, devices, loadDeviceCenter } = useOwnerData("devices");

const [pairingCode, setPairingCode] = useState("");
const deviceAction = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      await ownerFetch("/api/owner/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setPairingCode("");
      await loadDeviceCenter();
    } catch (err) { setError(err instanceof Error ? err.message : "Perangkat gagal diperbarui."); }
    finally { setBusy(false); }
  };
if (!ready) return <p role="status">{error || "Memuat data..."}</p>;
return (<>{error && <div className="owner-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}{true && <section className="owner-device-page owner-page-panel">
            <div className="owner-device-setup">
              <article className="owner-panel"><span className="device-step">01</span><h2>Buka aplikasi di perangkat tujuan</h2><p>Pada tablet Kasir buka <b>{APP_HOSTS.POS}</b>. Pada layar dapur buka <b>{APP_HOSTS.KDS}</b>, kemudian pilih Buat Kode Pairing.</p><div className="owner-device-links"><a href={appUrl("POS", "/pos")} target="_blank" rel="noopener noreferrer">Buka Kasir ↗</a><a href={appUrl("KDS", "/kds")} target="_blank" rel="noopener noreferrer">Buka KDS ↗</a></div></article>
              <article className="owner-panel"><span className="device-step">02</span><h2>Setujui kode pairing</h2><p>Masukkan enam digit yang tampil pada perangkat. Kode hanya berlaku lima menit dan sekali pakai.</p><div className="owner-pair-form"><input inputMode="numeric" maxLength={6} placeholder="000000" value={pairingCode} onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, ""))}/><button className="btn-primary" disabled={busy || pairingCode.length !== 6} onClick={() => void deviceAction({ action: "approve", code: pairingCode })}>{busy ? "Memproses..." : "Setujui Perangkat"}</button></div></article>
            </div>
            <article className="owner-panel owner-device-list"><div className="owner-section-heading"><div><h2>Perangkat Terdaftar</h2><p>Cabut akses segera jika perangkat hilang atau tidak lagi digunakan.</p></div>{devices.some((device) => device.status === "ACTIVE") && <button className="link-button danger" onClick={() => confirm("Cabut seluruh perangkat Kasir dan KDS?") && void deviceAction({ action: "revoke_all" })}>Cabut Semua</button>}</div>
              {devices.length === 0 ? <EmptyState icon="⌁" title="Belum ada perangkat" text="Buka Kasir atau KDS pada perangkat tujuan untuk memulai pairing."/> : <div className="owner-device-grid">{devices.map((device) => <div key={device.id} className={`owner-device-card ${device.status.toLowerCase()}`}><span>{device.device_type === "POS" ? "▤" : "♨"}</span><div><small>{device.device_type === "POS" ? "KASIR / POS" : "DAPUR / KDS"}</small><b>{device.device_name}</b><p>Terakhir aktif {new Date(device.last_seen_at).toLocaleString("id-ID")}</p><em>{device.status === "ACTIVE" ? "● Aktif" : device.status === "REVOKED" ? "○ Dicabut" : "○ Kedaluwarsa"}</em></div>{device.status === "ACTIVE" && <button className="link-button danger" onClick={() => confirm(`Cabut akses ${device.device_name}?`) && void deviceAction({ action: "revoke", deviceId: device.id })}>Cabut</button>}{device.status === "REVOKED" && <button className="link-button danger" onClick={() => confirm(`Hapus permanen ${device.device_name}?`) && void deviceAction({ action: "delete", deviceId: device.id })}>Hapus</button>}</div>)}</div>}
            </article>
          </section>}</>);
}
