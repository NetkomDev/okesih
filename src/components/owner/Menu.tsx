"use client";
import Link from "next/link";
import { useState } from "react";
import { ownerFetch } from "./helpers";
import { useOwnerData } from "./provider";
import OwnerSkeleton from "./OwnerSkeleton";
function money(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="owner-modal-backdrop"><div className="owner-modal"><header><h3>{title}</h3><button onClick={onClose}>×</button></header>{children}</div></div>;
}
function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="owner-empty"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div>;
}
export default function MenuFeature() {
const { ready, data, error, setError, notice, setNotice, busy, mutate } = useOwnerData("menu");

const [menuModal, setMenuModal] = useState(false);
const [menuForm, setMenuForm] = useState({ name: "", price: "", category: "Kopi", description: "" });
const [editingMenu, setEditingMenu] = useState<{ id: string; name: string; price: string; category: string; description: string; isAvailable: boolean } | null>(null);
const createMenu = (event: React.FormEvent) => {
    event.preventDefault();
    void mutate(async () => {
      await ownerFetch("/api/owner/menus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...menuForm, price: Number(menuForm.price) }) });
      setMenuModal(false);
      setMenuForm({ name: "", price: "", category: "Kopi", description: "" });
    });
  };
const updateMenu = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingMenu) return;
    void mutate(async () => {
      await ownerFetch("/api/owner/menus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingMenu.id,
          name: editingMenu.name,
          price: Number(editingMenu.price),
          category: editingMenu.category,
          description: editingMenu.description,
          isAvailable: editingMenu.isAvailable,
        }),
      });
      setEditingMenu(null);
    });
  };
if (!ready) {
  if (error) return <div className="owner-error" role="alert">{error}</div>;
  return <OwnerSkeleton variant="menu" />;
}
const { profile } = data;
const categorySuggestions = Array.from(new Set(["Kopi", "Dingin", "Makanan", "Camilan", "Lainnya", ...data.menus.map((menu) => menu.category)])).sort((a, b) => a.localeCompare(b, "id"));
return (<>{error && <div className="owner-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}{notice && <div className="owner-success">{notice}<button onClick={() => setNotice("")}>×</button></div>}{true && <section id="menu" className="owner-panel owner-page-panel owner-menu-catalog-page">
            <div className="owner-section-heading owner-menu-heading">
              <div className="owner-menu-heading-title">
                <h2>Katalog Menu</h2>
              </div>
              <div className="owner-menu-actions">
                <Link
                  href={`/menu/${profile.slug}${data.tables[0] ? `?tableId=${encodeURIComponent(data.tables[0].id)}` : ""}`}
                  target="_blank"
                  className="owner-menu-btn owner-menu-btn-preview"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>
                    Preview Menu
                    <small>Pelanggan</small>
                  </span>
                </Link>
                <button
                  type="button"
                  className="owner-menu-btn owner-menu-btn-add"
                  onClick={() => setMenuModal(true)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>
                    Tambah
                    <small>Menu Baru</small>
                  </span>
                </button>
              </div>
            </div>

            {/* Desktop / Tablet Table View */}
            <div className="owner-table-wrap owner-menu-desktop-table">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kategori</th>
                    <th>Harga</th>
                    <th>Deskripsi</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.menus.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon="◫" title="Katalog masih kosong" text="Tambahkan menu pertama agar langsung tampil di kasir dan menu pelanggan." />
                      </td>
                    </tr>
                  )}
                  {data.menus.map((menu) => (
                    <tr key={menu.id}>
                      <td><b>{menu.name}</b></td>
                      <td><span className="owner-category">{menu.category}</span></td>
                      <td><strong>{money(menu.price)}</strong></td>
                      <td>{menu.description}</td>
                      <td>
                        <button
                          className={menu.isAvailable ? "pill active" : "pill"}
                          disabled={busy}
                          onClick={() => void mutate(() => ownerFetch("/api/owner/menus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menu.id, isAvailable: !menu.isAvailable }) }))}
                        >
                          {menu.isAvailable ? "● Tersedia" : "○ Habis"}
                        </button>
                      </td>
                      <td>
                        <button
                          className="link-button"
                          onClick={() => setEditingMenu({
                            id: menu.id,
                            name: menu.name,
                            price: String(menu.price),
                            category: menu.category,
                            description: menu.description === "-" ? "" : menu.description,
                            isAvailable: menu.isAvailable,
                          })}
                        >
                          Edit
                        </button>
                        <button className="link-button danger" onClick={() => confirm(`Hapus ${menu.name}?`) && void mutate(() => ownerFetch(`/api/owner/menus?id=${menu.id}`, { method: "DELETE" }))}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile PWA Card List View */}
            <div className="owner-menu-mobile-list">
              {data.menus.length === 0 && (
                <EmptyState icon="◫" title="Katalog masih kosong" text="Tambahkan menu pertama agar langsung tampil di kasir dan menu pelanggan." />
              )}
              {data.menus.map((menu) => (
                <article key={menu.id} className={`owner-menu-card ${menu.isAvailable ? "is-available" : "is-out"}`}>
                  <div className="owner-menu-card-head">
                    <div className="owner-menu-card-title">
                      <b>{menu.name}</b>
                      <span className="owner-category">{menu.category}</span>
                    </div>
                    <strong className="owner-menu-card-price">{money(menu.price)}</strong>
                  </div>
                  {menu.description && (
                    <p className="owner-menu-card-desc">{menu.description}</p>
                  )}
                  <div className="owner-menu-card-footer">
                    <button
                      type="button"
                      className={`pill ${menu.isAvailable ? "active" : ""}`}
                      disabled={busy}
                      onClick={() => void mutate(() => ownerFetch("/api/owner/menus", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: menu.id, isAvailable: !menu.isAvailable }) }))}
                    >
                      {menu.isAvailable ? "● Tersedia" : "○ Habis"}
                    </button>
                    <div className="owner-menu-card-actions">
                      <button
                        type="button"
                        className="owner-menu-btn-edit"
                        onClick={() => setEditingMenu({
                          id: menu.id,
                          name: menu.name,
                          price: String(menu.price),
                          category: menu.category,
                          description: menu.description === "-" ? "" : menu.description,
                          isAvailable: menu.isAvailable,
                        })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="owner-menu-btn-delete"
                        onClick={() => confirm(`Hapus ${menu.name}?`) && void mutate(() => ownerFetch(`/api/owner/menus?id=${menu.id}`, { method: "DELETE" }))}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>}{menuModal && <Modal title="Tambah Menu" onClose={() => setMenuModal(false)}><form onSubmit={createMenu}><input required placeholder="Nama menu" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}/><input required min="1" type="number" placeholder="Harga" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}/><label className="owner-category-field">Kategori<input required list="owner-menu-categories" maxLength={50} placeholder="Pilih atau ketik kategori baru" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}/><small>Pilih kategori yang ada atau ketik kategori baru.</small></label><datalist id="owner-menu-categories">{categorySuggestions.map((item) => <option key={item} value={item}/>)}</datalist><textarea placeholder="Deskripsi" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}/><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setMenuModal(false)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">Oke</button></div></form></Modal>}
{editingMenu && <Modal title="Edit Menu" onClose={() => setEditingMenu(null)}><form onSubmit={updateMenu}><label className="owner-category-field">Nama Menu<input required placeholder="Nama menu" value={editingMenu.name} onChange={(e) => setEditingMenu({ ...editingMenu, name: e.target.value })}/></label><label className="owner-category-field">Harga (Rp)<input required min="1" type="number" placeholder="Harga" value={editingMenu.price} onChange={(e) => setEditingMenu({ ...editingMenu, price: e.target.value })}/></label><label className="owner-category-field">Kategori<input required list="owner-menu-categories-edit" maxLength={50} placeholder="Pilih atau ketik kategori baru" value={editingMenu.category} onChange={(e) => setEditingMenu({ ...editingMenu, category: e.target.value })}/><small>Pilih kategori yang ada atau ketik kategori baru.</small></label><datalist id="owner-menu-categories-edit">{categorySuggestions.map((item) => <option key={item} value={item}/>)}</datalist><label className="owner-category-field">Deskripsi<textarea placeholder="Deskripsi menu" value={editingMenu.description} onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}/></label><label className="owner-category-field" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "4px" }}><input type="checkbox" checked={editingMenu.isAvailable} onChange={(e) => setEditingMenu({ ...editingMenu, isAvailable: e.target.checked })} style={{ width: "20px", height: "20px", margin: 0 }}/><span>Status Menu Tersedia untuk Dipesan</span></label><div className="owner-modal-actions"><button type="button" className="btn-secondary" onClick={() => setEditingMenu(null)}>Batal</button><button disabled={busy} className="btn-primary" type="submit">{busy ? "Menyimpan..." : "Oke"}</button></div></form></Modal>}</>);
}
