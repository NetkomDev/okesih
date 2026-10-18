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
export default function StaffFeature() {
const { ready, data, error, setError, notice, setNotice, busy, setBusy, loadDashboard, mutate } = useOwnerData("staff");

const [staffModal, setStaffModal] = useState(false);
const [staffForm, setStaffForm] = useState({ username: "", name: "", password: "", role: "KASIR" });
const closeActiveCashierShift = async () => {
    if (!data?.activeCashier) return;
    const amount = window.prompt(`Masukkan kas fisik yang diserahkan oleh ${data.activeCashier.name} (Rp)`, "0");
    if (amount === null) return;
    const actualCash = Number(amount.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(actualCash) || actualCash < 0) return setError("Nominal kas fisik tidak valid.");
    setBusy(true); setError("");
    try {
      await ownerFetch("/api/owner/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: data.activeCashier.shiftId, actualCash, notes: "Ditutup oleh Owner dari Dashboard Owner." }),
      });
      setNotice("Shift kasir berhasil diakhiri.");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shift kasir gagal diakhiri.");
    } finally {
      setBusy(false);
    }
  };
const createStaff = (event: React.FormEvent) => {
    event.preventDefault();
    const username = staffForm.username.trim().toLowerCase();
    void mutate(async () => {
      await ownerFetch("/api/owner/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...staffForm, username }) });
      setStaffModal(false);
      setStaffForm({ username: "", name: "", password: "", role: "KASIR" });
    }, `Akun staf @${username} berhasil dibuat.`);
  };
if (!ready) {
  if (error) return <div className="owner-error" role="alert">{error}</div>;
  return <OwnerSkeleton variant="staff" />;
}
return (<>{error && <div className="owner-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}{true && <section id="staf" className="owner-panel owner-page-panel">
            <div className="owner-section-heading"><div><h2>Manajemen Akun Staf (Kasir &amp; Barista, dll.)</h2><p>Akun login staf tersimpan dan terisolasi untuk usaha ini.</p></div><button className="btn-primary" onClick={() => setStaffModal(true)}>+ Tambah Staf</button></div>
            <div className="owner-table-wrap"><table><thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{data.staff.length === 0 && <tr><td colSpan={5}><EmptyState icon="♟" title="Belum ada akun staf" text="Buat akun kasir atau barista agar akses operasional terpisah dan aman." /></td></tr>}{data.staff.map((staff) => <tr key={staff.id}><td><b>{staff.username}</b></td><td>{staff.name}</td><td><span className="owner-category">{staff.role}</span></td><td><span className={staff.onShift ? "owner-dot shift" : staff.status === "ACTIVE" ? "owner-dot active" : "owner-dot"}>{staff.onShift ? "● Sedang shift" : staff.status === "ACTIVE" ? "● Aktif" : "○ Nonaktif"}</span></td><td><button className="link-button" onClick={() => { const password = prompt(`Password baru untuk ${staff.username} (minimal 6 karakter)`); if (password) void mutate(() => ownerFetch("/api/owner/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: staff.id, password }) })); }}>Reset Password</button>{staff.onShift && <button className="link-button danger" disabled={busy} onClick={() => void closeActiveCashierShift()}>Akhiri Shift</button>}<button className="link-button" disabled={staff.onShift} onClick={() => void mutate(() => ownerFetch("/api/owner/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: staff.id, isActive: staff.status !== "ACTIVE" }) }))}>{staff.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}</button></td></tr>)}</tbody></table></div>
          </section>}{staffModal && <Modal title="Tambah Akun Staf" onClose={() => { if (!busy) setStaffModal(false); }}><form onSubmit={createStaff} className="owner-staff-form"><label>Username<input required minLength={3} maxLength={40} pattern="[a-z0-9][a-z0-9._-]*[a-z0-9_-]" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="Contoh: kasir.baru" value={staffForm.username} onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value.toLowerCase() })}/><small>Gunakan huruf kecil, angka, titik, garis bawah, atau tanda hubung.</small></label><label>Nama staf<input required minLength={2} maxLength={150} autoComplete="name" placeholder="Nama lengkap staf" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}/></label><label>Password awal<input required minLength={6} maxLength={72} type="password" autoComplete="new-password" placeholder="Minimal 6 karakter" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}/></label><label>Peran<select value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}><option value="KASIR">Kasir POS</option><option value="DAPUR">Barista / Dapur</option></select></label><div className="owner-modal-actions"><button type="button" className="btn-secondary" disabled={busy} onClick={() => setStaffModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">{busy ? "Membuat akun..." : "Buat Akun"}</button></div></form></Modal>}</>);
}
