"use client";

import Link from "next/link";
import { useState } from "react";

interface StaffMember {
  id: string;
  username: string;
  name: string;
  role: "KASIR" | "DAPUR";
  status: "ACTIVE" | "INACTIVE";
}

interface WaiterRoster {
  id: string;
  name: string;
  phone: string;
  status: "BERTUGAS" | "OFF";
  todayShiftHours: string;
  cashCollectedToday: number;
}

export default function TenantOwnerDashboardPage() {
  // Warkop Details
  const [warkopName, setWarkopName] = useState<string>("Warkop Giras Nusantara");
  const [qrisMerchantName, setQrisMerchantName] = useState<string>("GIRAS NUSANTARA (BCA)");

  // Staf Warkop (Kasir & Barista)
  const [staffList, setStaffList] = useState<StaffMember[]>([
    { id: "st-01", username: "kasir1", name: "Rina Kasir", role: "KASIR", status: "ACTIVE" },
    { id: "st-02", username: "dapur", name: "Budi Barista", role: "DAPUR", status: "ACTIVE" },
  ]);

  // Daftar Waiters Warkop
  const [waiterList, setWaiterList] = useState<WaiterRoster[]>([
    { id: "wt-01", name: "Rian", phone: "081233445566", status: "BERTUGAS", todayShiftHours: "4 Jam (08:00 - Sekarang)", cashCollectedToday: 34000 },
    { id: "wt-02", name: "Dani", phone: "085677889900", status: "OFF", todayShiftHours: "8 Jam (00:00 - 08:00)", cashCollectedToday: 145000 },
    { id: "wt-03", name: "Bagas", phone: "087811223344", status: "OFF", todayShiftHours: "Shift Malam Nanti", cashCollectedToday: 0 },
  ]);

  // Modal States
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [newStaffUsername, setNewStaffUsername] = useState<string>("");
  const [newStaffPassword, setNewStaffPassword] = useState<string>("");
  const [newStaffRole, setNewStaffRole] = useState<"KASIR" | "DAPUR">("KASIR");

  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState<boolean>(false);
  const [newWaiterName, setNewWaiterName] = useState<string>("");
  const [newWaiterPhone, setNewWaiterPhone] = useState<string>("");

  // Handler Buat Staf Instan
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffUsername || !newStaffPassword) {
      alert("Harap isi username dan password staf!");
      return;
    }

    const newMember: StaffMember = {
      id: `st-${Date.now()}`,
      username: newStaffUsername.toLowerCase().trim(),
      name: newStaffUsername,
      role: newStaffRole,
      status: "ACTIVE",
    };

    setStaffList((prev) => [...prev, newMember]);
    setIsStaffModalOpen(false);

    alert(
      `✓ AKUN STAF BARU BERHASIL DIBUAT!\n\n` +
      `Username: ${newMember.username}\n` +
      `Password: ${newStaffPassword}\n` +
      `Peran: ${newMember.role === "KASIR" ? "Kasir POS" : "Barista Dapur KDS"}\n\n` +
      `Bagikan username & password ini langsung ke staf. Staf dapat langsung login di aplikasi kasir/dapur tanpa OTP!`
    );
  };

  // Handler Tambah Waiters Baru
  const handleAddWaiter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaiterName) {
      alert("Harap isi nama waiters!");
      return;
    }

    const newW: WaiterRoster = {
      id: `wt-${Date.now()}`,
      name: newWaiterName.trim(),
      phone: newWaiterPhone || "-",
      status: "OFF",
      todayShiftHours: "Belum bertugas",
      cashCollectedToday: 0,
    };

    setWaiterList((prev) => [...prev, newW]);
    setIsWaiterModalOpen(false);
    alert(`✓ Waiters "${newW.name}" berhasil ditambahkan ke daftar pelayan warkop!`);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-deep-black)", color: "#FFF" }}>
      {/* Top Header Tenant Owner */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "linear-gradient(180deg, rgba(255, 69, 0, 0.15) 0%, rgba(13, 13, 14, 0.95) 100%)",
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #FF5722, #FF4500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "1.2rem",
              boxShadow: "0 0 15px var(--brand-orange-glow)",
            }}
          >
            ☕
          </div>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
              {warkopName}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--brand-orange-light)", fontWeight: 700 }}>
              DASHBOARD OWNER WARKOP (TENANT PORTAL)
            </div>
          </div>
          <span className="badge badge-ready">● Warkop Buka &amp; Beroperasi</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link
            href="/superadmin"
            style={{
              background: "rgba(14, 165, 233, 0.15)",
              border: "1px solid rgba(14, 165, 233, 0.4)",
              color: "#38BDF8",
              fontSize: "0.8rem",
              fontWeight: 800,
              padding: "0.45rem 0.85rem",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            🛡️ Buka HQ Superadmin →
          </Link>

          <Link href="/pos" className="btn-secondary" style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem" }}>
            Layar Kasir
          </Link>
          <Link href="/kds" className="btn-secondary" style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem" }}>
            Layar Dapur
          </Link>
          <Link href="/" className="btn-secondary" style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem" }}>
            Logout
          </Link>
        </div>
      </header>

      {/* Main Owner Portal Body */}
      <main style={{ maxWidth: "1280px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* SECTION 1: RINGKASAN OMZET & KEUANGAN BISNIS WARKOP SAYA HARI INI */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
                Ringkasan Penjualan Warkop Hari Ini
              </h1>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Pantau omzet tunai vs QRIS, kas di laci kasir, dan estimasi biaya sewa OKESIH (@ Rp 50/struk).
              </p>
            </div>
            <Link
              href="/menu/giras-nusantara?table=01"
              target="_blank"
              className="btn-primary"
              style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}
            >
              📱 Buka Menu Meja Pelanggan
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Metric 1 */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "0.35rem" }}>
                TOTAL OMZET PENJUALAN TOKO
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "var(--brand-orange-light)" }}>
                Rp 1.450.000
              </div>
              <div style={{ fontSize: "0.75rem", color: "#10B981", marginTop: "0.4rem", fontWeight: 600 }}>
                100% langsung masuk ke kas/rekening warkop
              </div>
            </div>

            {/* Metric 2 */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "0.35rem" }}>
                RINCIAN PEMBAYARAN PELANGGAN
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#FFF", marginTop: "0.25rem" }}>
                💵 Tunai: <strong style={{ color: "#34D399" }}>Rp 820.000</strong>
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#FFF", marginTop: "0.25rem" }}>
                📱 QRIS: <strong style={{ color: "#60A5FA" }}>Rp 630.000</strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.4rem" }}>
                Total 124 transaksi / struk bon
              </div>
            </div>

            {/* Metric 3 */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "0.35rem" }}>
                UANG FISIK DI LACI KASIR
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "#10B981" }}>
                Rp 820.000
              </div>
              <div style={{ fontSize: "0.75rem", color: "#34D399", marginTop: "0.4rem", fontWeight: 600 }}>
                ✓ Rekonsiliasi kas klop (Selisih Rp 0)
              </div>
            </div>

            {/* Metric 4 */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "0.35rem" }}>
                TAGIHAN SEWA OKESIH (@ Rp 50)
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "#FBBF24" }}>
                Rp 6.200
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.4rem" }}>
                + Kode Unik 145 = Total Rp 6.345 (Dibayar saat tutup shift)
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: MANAJEMEN STAF KASIR & BARISTA DAPUR (NO OTP/EMAIL) */}
        <section className="glass-panel" style={{ padding: "1.75rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Manajemen Akun Staf (Kasir &amp; Barista)</h2>
              <div style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                Buat akun staf instan (Username &amp; Password) tanpa perlu verifikasi email atau OTP yang merepotkan.
              </div>
            </div>

            <button
              onClick={() => {
                setNewStaffUsername("");
                setNewStaffPassword("");
                setIsStaffModalOpen(true);
              }}
              className="btn-primary"
              style={{ padding: "0.55rem 1.1rem", fontSize: "0.85rem", fontWeight: 800 }}
            >
              + Tambah Staf Baru
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.75rem" }}>
                  <th style={{ padding: "0.75rem 1rem" }}>Username Login</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Nama Staf</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Peran Operasional</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Akses Modul</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((st) => (
                  <tr key={st.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "1rem", fontWeight: 800, color: "var(--brand-orange-light)" }}>
                      {st.username}
                    </td>
                    <td style={{ padding: "1rem", fontWeight: 600 }}>{st.name}</td>
                    <td style={{ padding: "1rem" }}>
                      <span className={st.role === "KASIR" ? "badge badge-ready" : "badge badge-cooking"}>
                        {st.role === "KASIR" ? "Kasir POS" : "Kitchen KDS"}
                      </span>
                    </td>
                    <td style={{ padding: "1rem", color: "var(--text-dim)", fontSize: "0.8rem" }}>
                      {st.role === "KASIR" ? "Modul /pos" : "Modul /kds"}
                    </td>
                    <td style={{ padding: "1rem", color: "#10B981", fontWeight: 700 }}>● Aktif</td>
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <button
                        onClick={() => alert(`Password untuk ${st.username} di-reset menjadi default: 123456`)}
                        className="btn-secondary"
                        style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                      >
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3: MANAJEMEN DAFTAR WAITERS & REKONSILIASI KAS LACI */}
        <section className="glass-panel" style={{ padding: "1.75rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Daftar Waiters &amp; Rekonsiliasi Kas Laci</h2>
              <div style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                Kelola daftar pelayan meja, jam kerja aktif, dan pencocokan uang tunai yang ditagih ke pelanggan.
              </div>
            </div>

            <button
              onClick={() => {
                setNewWaiterName("");
                setNewWaiterPhone("");
                setIsWaiterModalOpen(true);
              }}
              className="btn-primary"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
                padding: "0.55rem 1.1rem",
                fontSize: "0.85rem",
                fontWeight: 800,
              }}
            >
              + Tambah Waiters Baru
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.75rem" }}>
                  <th style={{ padding: "0.75rem 1rem" }}>Nama Waiters</th>
                  <th style={{ padding: "0.75rem 1rem" }}>No. Telepon</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Status Shift</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Jam Kerja Hari Ini</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Total Uang Ditagih</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {waiterList.map((w) => (
                  <tr key={w.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "1rem", fontWeight: 800, fontSize: "0.95rem" }}>
                      {w.name}
                    </td>
                    <td style={{ padding: "1rem", color: "var(--text-dim)" }}>{w.phone}</td>
                    <td style={{ padding: "1rem" }}>
                      <span
                        style={{
                          background: w.status === "BERTUGAS" ? "rgba(16, 185, 129, 0.2)" : "rgba(100, 116, 139, 0.2)",
                          border: w.status === "BERTUGAS" ? "1px solid #10B981" : "1px solid #64748B",
                          color: w.status === "BERTUGAS" ? "#34D399" : "#94A3B8",
                          padding: "0.2rem 0.55rem",
                          borderRadius: "var(--radius-pill)",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                        }}
                      >
                        {w.status === "BERTUGAS" ? "● Sedang Bertugas" : "○ Off / Siap Shift"}
                      </span>
                    </td>
                    <td style={{ padding: "1rem", color: "#E2E8F0" }}>{w.todayShiftHours}</td>
                    <td style={{ padding: "1rem", fontWeight: 900, color: "#10B981" }}>
                      Rp {w.cashCollectedToday.toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <Link href="/pos" className="btn-secondary" style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}>
                        Cek Laci Kasir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 4: PENGATURAN QRIS TOKO, CETAK QR MEJA & KATALOG MENU */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "3rem" }}>
          {/* Card 1: QRIS Toko Warkop (100% uang langsung ke Owner) */}
          <div className="glass-panel" style={{ padding: "1.75rem" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              💳 QRIS Statis Toko (Rekening Warkop Anda)
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
              QRIS ini otomatis ditampilkan ke layar HP pelanggan saat memesan dari meja. Uang pembayaran 100% langsung masuk ke rekening Anda tanpa perantara.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
              <div
                style={{
                  width: "70px",
                  height: "70px",
                  background: "#FFF",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#000",
                  fontSize: "9px",
                  fontWeight: 900,
                  textAlign: "center",
                  padding: "4px",
                }}
              >
                <div>QRIS WARKOP</div>
                <div style={{ width: "36px", height: "36px", background: "#000", margin: "3px auto", borderRadius: "3px" }} />
                <div>NMID: OKESIH</div>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-dim)", display: "block", marginBottom: "0.25rem" }}>
                  Nama Merchant / Rekening:
                </label>
                <input
                  type="text"
                  value={qrisMerchantName}
                  onChange={(e) => setQrisMerchantName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.85rem",
                  }}
                />
              </div>
            </div>

            <button
              onClick={() => alert("Silakan pilih gambar QRIS baru dari perangkat Anda untuk di-upload ke Supabase Storage.")}
              className="btn-secondary"
              style={{ width: "100%", fontSize: "0.85rem" }}
            >
              📷 Ganti Gambar QRIS Toko
            </button>
          </div>

          {/* Card 2: Cetak Stiker QR Code Meja Pelanggan */}
          <div className="glass-panel" style={{ padding: "1.75rem" }}>
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.5rem" }}>
              📍 Cetak Stiker QR Code Meja Warkop
            </h3>
            <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginBottom: "1.25rem", lineHeight: 1.5 }}>
              Cetak QR Code meja untuk ditempel di meja pelanggan. Pelanggan cukup memindai dengan kamera HP untuk memilih menu dan memesan.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem", marginBottom: "1.25rem" }}>
              {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"].map((meja) => (
                <Link
                  key={meja}
                  href={`/menu/giras-nusantara?table=${meja}`}
                  target="_blank"
                  className="btn-secondary"
                  style={{ textAlign: "center", padding: "0.5rem 0", fontSize: "0.8rem", fontWeight: 800 }}
                >
                  Meja #{meja}
                </Link>
              ))}
            </div>

            <button
              onClick={() => alert("Mempersiapkan lembar PDF cetak stiker QR untuk Meja 01 s/d Meja 10.")}
              className="btn-primary"
              style={{ width: "100%", fontSize: "0.85rem" }}
            >
              🖨️ Download &amp; Cetak Semua Stiker QR Meja (PDF)
            </button>
          </div>
        </div>
      </main>

      {/* MODAL 1: TAMBAH STAF WARKOP BARU */}
      {isStaffModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div className="glass-panel" style={{ maxWidth: "460px", width: "100%", padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Tambah Akun Staf Warkop</h3>
              <button onClick={() => setIsStaffModalOpen(false)} className="btn-secondary" style={{ width: "32px", height: "32px", padding: 0 }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                  Username Staf (Contoh: kasir2, barista_pagi)
                </label>
                <input
                  type="text"
                  required
                  value={newStaffUsername}
                  onChange={(e) => setNewStaffUsername(e.target.value)}
                  placeholder="Ketik username..."
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                  Password Login
                </label>
                <input
                  type="password"
                  required
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Ketik password..."
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                  Peran / Tugas Staf
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as "KASIR" | "DAPUR")}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.9rem",
                  }}
                >
                  <option value="KASIR">Kasir POS (Akses /pos)</option>
                  <option value="DAPUR">Barista Dapur KDS (Akses /kds)</option>
                </select>
              </div>

              <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "0.5rem" }}>
                Simpan &amp; Rilis Akun Staf
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TAMBAH WAITERS BARU */}
      {isWaiterModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div className="glass-panel" style={{ maxWidth: "460px", width: "100%", padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>Tambah Waiters / Pelayan Meja</h3>
              <button onClick={() => setIsWaiterModalOpen(false)} className="btn-secondary" style={{ width: "32px", height: "32px", padding: 0 }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddWaiter} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                  Nama Waiters (Contoh: Dimas, Farhan)
                </label>
                <input
                  type="text"
                  required
                  value={newWaiterName}
                  onChange={(e) => setNewWaiterName(e.target.value)}
                  placeholder="Ketik nama pelayan..."
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                  Nomor WhatsApp (Opsional)
                </label>
                <input
                  type="text"
                  value={newWaiterPhone}
                  onChange={(e) => setNewWaiterPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%", background: "linear-gradient(135deg, #10B981, #059669)", marginTop: "0.5rem" }}
              >
                Simpan Waiters ke Roster
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
