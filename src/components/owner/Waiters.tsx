"use client";
import { useState } from "react";
import { ownerFetch } from "./helpers";
import { useOwnerData } from "./provider";
import OwnerSkeleton from "./OwnerSkeleton";
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="owner-modal-backdrop"><div className="owner-modal"><header><h3>{title}</h3><button onClick={onClose}>×</button></header>{children}</div></div>;
}
function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="owner-empty"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div>;
}
export default function WaitersFeature() {
const { ready, refreshing, data, error, setError, notice, setNotice, busy, mutate, loadDashboard } = useOwnerData("waiters");

const [waiterModal, setWaiterModal] = useState(false);
const [waiterForm, setWaiterForm] = useState({ name: "", phone: "" });
const createWaiter = (event: React.FormEvent) => {
    event.preventDefault();
    void mutate(async () => {
      await ownerFetch("/api/owner/waiters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(waiterForm) });
      setWaiterModal(false);
      setWaiterForm({ name: "", phone: "" });
    });
  };
if (!ready) {
  if (error)
    return (
      <div className="owner-main">
        <div className="owner-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="owner-error-retry-btn"
            disabled={refreshing}
            onClick={() => { setError(""); void loadDashboard().catch(() => {}); }}
          >
            {refreshing ? "Memuat..." : "Coba lagi"}
          </button>
        </div>
        <OwnerSkeleton variant="waiters" />
      </div>
    );
  return <OwnerSkeleton variant="waiters" />;
}
return (<>{error && <div className="owner-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}{true && <section id="waiter" className="owner-panel owner-page-panel">
            <div className="owner-section-heading"><div><h2>Daftar Waiter</h2><p>Kelola pelayan sesuai kondisi nyata usaha.</p></div><button className="btn-primary" onClick={() => setWaiterModal(true)}>+ Tambah Waiter</button></div>
            <div className="owner-card-grid">{data.waiters.length === 0 && <EmptyState icon="♙" title="Daftar waiter masih kosong" text="Tambahkan waiter sesuai kondisi aktual usaha Anda." />}{data.waiters.map((waiter) => <article key={waiter.id} className="owner-small-card"><span className="owner-avatar">{waiter.name.slice(0, 1).toUpperCase()}</span><b>{waiter.name}</b><span>{waiter.phone || "Tanpa nomor telepon"}</span><button className="link-button danger" onClick={() => confirm(`Hapus ${waiter.name}?`) && void mutate(() => ownerFetch(`/api/owner/waiters?id=${waiter.id}`, { method: "DELETE" }))}>Hapus</button></article>)}</div>
          </section>}{waiterModal && <Modal title="Tambah Waiter" onClose={() => setWaiterModal(false)}><form onSubmit={createWaiter}><input required placeholder="Nama waiter" value={waiterForm.name} onChange={(e) => setWaiterForm({ ...waiterForm, name: e.target.value })}/><input inputMode="tel" placeholder="Nomor telepon" value={waiterForm.phone} onChange={(e) => setWaiterForm({ ...waiterForm, phone: e.target.value })}/><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setWaiterModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">Oke</button></div></form></Modal>}</>);
}
