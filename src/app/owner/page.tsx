"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthGuard, logoutUser } from "@/lib/auth-helpers";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: "Kopi" | "Dingin" | "Makanan" | "Camilan" | "Lainnya";
  description: string;
  isAvailable: boolean;
}

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
  const { isAuthorized, loading, currentUser } = useAuthGuard(["OWNER"]);

  // Warkop Details
  const [warkopName, setWarkopName] = useState<string>("Warkop Giras Nusantara");
  const [qrisMerchantName, setQrisMerchantName] = useState<string>("WARKOP GIRAS NUSANTARA (BCA)");
  const [uniqueCode] = useState<number>(145);
  const [saasFeePerReceipt, setSaasFeePerReceipt] = useState<number>(50);
  const todayReceiptCount = 124;
  const totalSaasBill = todayReceiptCount * saasFeePerReceipt + uniqueCode;

  useEffect(() => {
    fetch("/api/platform-settings", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload) => setSaasFeePerReceipt(payload.data.saasFeePerReceipt))
      .catch(() => undefined);
  }, []);

  // KATALOG MENU WARKOP (DIBUAT & DIKELOLA SENDIRI OLEH OWNER TENANT)
  const [menuList, setMenuList] = useState<MenuItem[]>([
    {
      id: "menu-01",
      name: "Kopi Hitam Tubruk Giras",
      price: 5000,
      category: "Kopi",
      description: "Robusta giling halus diseduh air mendidih kental khas warkop.",
      isAvailable: true,
    },
    {
      id: "menu-02",
      name: "Kopi Susu Panas Legendaris",
      price: 7000,
      category: "Kopi",
      description: "Susu kental manis berpadu espresso tubruk aroma sedap.",
      isAvailable: true,
    },
    {
      id: "menu-03",
      name: "Es Teh Manis Jumbo",
      price: 5000,
      category: "Dingin",
      description: "Teh melati wangi dingin segar porsi gelas besar.",
      isAvailable: true,
    },
    {
      id: "menu-04",
      name: "Extra Joss Susu Dingin",
      price: 8000,
      category: "Dingin",
      description: "Minuman energi segar dicampur susu dan es batu kristal.",
      isAvailable: true,
    },
    {
      id: "menu-05",
      name: "Indomie Goreng + Telur",
      price: 12000,
      category: "Makanan",
      description: "Indomie goreng dengan topping telur ceplok dan sawi hijau.",
      isAvailable: true,
    },
    {
      id: "menu-06",
      name: "Indomie Kuah Kari Dobel Telur",
      price: 16000,
      category: "Makanan",
      description: "Kuah kari kental dengan 2 butir telur setengah matang.",
      isAvailable: true,
    },
    {
      id: "menu-07",
      name: "Roti Bakar Coklat Keju",
      price: 10000,
      category: "Camilan",
      description: "Roti tawar tebal panggang mentega dengan meses coklat dan keju.",
      isAvailable: true,
    },
    {
      id: "menu-08",
      name: "Gorengan Tempe / Bakwan (3 Pcs)",
      price: 5000,
      category: "Camilan",
      description: "Gorengan renyah hangat disajikan dengan cabai rawit hijau.",
      isAvailable: true,
    },
  ]);

  // Filter Kategori Menu
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");

  // Modal Tambah Menu Baru
  const [isMenuModalOpen, setIsMenuModalOpen] = useState<boolean>(false);
  const [newMenuName, setNewMenuName] = useState<string>("");
  const [newMenuPrice, setNewMenuPrice] = useState<number>(5000);
  const [newMenuCategory, setNewMenuCategory] = useState<"Kopi" | "Dingin" | "Makanan" | "Camilan" | "Lainnya">("Kopi");
  const [newMenuDesc, setNewMenuDesc] = useState<string>("");

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

  const [isCentralPaymentModalOpen, setIsCentralPaymentModalOpen] = useState<boolean>(false);

  // Handler Menu
  const handleCreateMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuName || newMenuPrice <= 0) {
      alert("Harap isi nama menu dan harga yang valid!");
      return;
    }

    const newItem: MenuItem = {
      id: `menu-${Date.now()}`,
      name: newMenuName.trim(),
      price: newMenuPrice,
      category: newMenuCategory,
      description: newMenuDesc || "-",
      isAvailable: true,
    };

    setMenuList((prev) => [newItem, ...prev]);
    setIsMenuModalOpen(false);
    alert(`✓ Menu baru "${newItem.name}" seharga Rp ${newItem.price.toLocaleString("id-ID")} berhasil ditambahkan ke katalog warkop Anda!`);
  };

  const toggleMenuAvailability = (id: string) => {
    setMenuList((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, isAvailable: !m.isAvailable } : m
      )
    );
  };

  const handleDeleteMenu = (id: string, name: string) => {
    if (confirm(`Yakin ingin menghapus menu "${name}" dari katalog warkop?`)) {
      setMenuList((prev) => prev.filter((m) => m.id !== id));
    }
  };

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

  // Filtered Menu List
  const filteredMenuList = selectedCategory === "Semua"
    ? menuList
    : menuList.filter((m) => m.category === selectedCategory);

  if (loading || !isAuthorized) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--bg-deep-black)",
          color: "#FFF",
          gap: "1rem",
        }}
      >
        <div style={{ fontSize: "2.5rem" }}>☕</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--brand-orange-light)" }}>
          Memverifikasi Otoritas Owner Warkop...
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Pemeriksaan token peran &amp; hak akses portal bisnis tenant
        </div>
      </div>
    );
  }

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
          <img
            src="/logo.svg?v=2"
            alt="Logo OKESIH.COM"
            width={46}
            height={46}
            style={{ width: "46px", height: "46px", objectFit: "contain", display: "block", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
              {warkopName}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--brand-orange-light)", fontWeight: 700 }}>
              PORTAL OWNER BISNIS WARKOP
            </div>
          </div>
          <span className="badge badge-ready">● Warkop Buka &amp; Beroperasi</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {currentUser && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--brand-orange-light)",
                background: "rgba(255, 69, 0, 0.1)",
                border: "1px solid rgba(255, 69, 0, 0.3)",
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                fontWeight: 700,
              }}
            >
              👤 {currentUser.email || "owner1"}
            </span>
          )}

          <Link href="/pos" className="btn-secondary" style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem" }}>
            Layar Kasir
          </Link>
          <Link href="/kds" className="btn-secondary" style={{ padding: "0.5rem 0.85rem", fontSize: "0.8rem" }}>
            Layar Dapur
          </Link>
          <button
            onClick={logoutUser}
            className="btn-secondary"
            style={{
              padding: "0.5rem 0.85rem",
              fontSize: "0.8rem",
              color: "#F87171",
              borderColor: "rgba(239, 68, 68, 0.4)",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Owner Portal Body */}
      <main style={{ maxWidth: "1320px", margin: "1.5rem auto 3rem", padding: "0 1.5rem" }}>
        {/* SECTION 1: RINGKASAN OMZET & KEUANGAN BISNIS WARKOP SAYA */}
        <section style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em" }}>
                Ringkasan Penjualan Warkop Hari Ini
              </h1>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Pantau omzet tunai vs QRIS, kas di laci kasir, dan pembayaran sewa OKESIH (@ Rp {saasFeePerReceipt.toLocaleString("id-ID")}/struk).
              </p>
            </div>
            <Link
              href="/menu/giras-nusantara?table=01"
              target="_blank"
              className="btn-primary"
              style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}
            >
              📱 Preview Menu Meja Pelanggan
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Metric 1 */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "0.35rem" }}>
                TOTAL OMZET PENJUALAN TOKO
              </div>
              <div style={{ fontSize: "2.1rem", fontWeight: 900, color: "var(--brand-orange-light)" }}>
                Rp 1.450.000
              </div>
              <div style={{ fontSize: "0.75rem", color: "#10B981", marginTop: "0.4rem", fontWeight: 600 }}>
                100% langsung masuk ke rekening/kas warkop Anda
              </div>
            </div>

            {/* Metric 2 */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "0.35rem" }}>
                RINCIAN PEMBAYARAN PELANGGAN
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FFF", marginTop: "0.25rem" }}>
                💵 Tunai: <strong style={{ color: "#34D399" }}>Rp 820.000</strong>
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#FFF", marginTop: "0.25rem" }}>
                📱 QRIS: <strong style={{ color: "#60A5FA" }}>Rp 630.000</strong>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.4rem" }}>
                Total {todayReceiptCount} struk transaksi bon
              </div>
            </div>

            {/* Metric 3 */}
            <div className="glass-panel" style={{ padding: "1.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "0.35rem" }}>
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
            <div
              className="glass-panel"
              style={{
                padding: "1.5rem",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, marginBottom: "0.35rem" }}>
                SEWA SAAS OKESIH (124 STRUK)
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#FBBF24" }}>
                Rp {totalSaasBill.toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.3rem" }}>
                (Rp 6.200 pokok + Kode Unik #{uniqueCode})
              </div>
              <button
                onClick={() => setIsCentralPaymentModalOpen(true)}
                style={{
                  marginTop: "0.6rem",
                  width: "100%",
                  padding: "0.4rem",
                  borderRadius: "6px",
                  background: "rgba(245, 158, 11, 0.2)",
                  border: "1px solid #F59E0B",
                  color: "#FCD34D",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Lihat QRIS Pusat &amp; Setor Sewa →
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 2: KATALOG MENU WARKOP (DIBUAT & DIKELOLA SENDIRI OLEH OWNER TENANT) */}
        <section
          className="glass-panel"
          style={{
            padding: "1.75rem",
            marginBottom: "2rem",
            border: "1px solid rgba(255, 69, 0, 0.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Katalog Menu Warkop Anda</h2>
                <span className="badge badge-ready">Kelola Mandiri</span>
              </div>
              <div style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                Dibuat &amp; ditetapkan langsung oleh Anda. Tersinkronisasi otomatis ke QR Menu Meja pelanggan dan Layar Kasir POS.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {/* Category Filter Pills */}
              <div style={{ display: "flex", gap: "0.35rem", background: "rgba(255, 255, 255, 0.05)", padding: "3px", borderRadius: "8px" }}>
                {["Semua", "Kopi", "Dingin", "Makanan", "Camilan"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      border: "none",
                      background: selectedCategory === cat ? "var(--brand-orange)" : "transparent",
                      color: selectedCategory === cat ? "#FFF" : "var(--text-muted)",
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setNewMenuName("");
                  setNewMenuPrice(5000);
                  setNewMenuCategory("Kopi");
                  setNewMenuDesc("");
                  setIsMenuModalOpen(true);
                }}
                className="btn-primary"
                style={{ padding: "0.55rem 1.1rem", fontSize: "0.85rem", fontWeight: 800 }}
              >
                + Tambah Menu Baru
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.75rem" }}>
                  <th style={{ padding: "0.75rem 1rem" }}>Nama Menu</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Kategori</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Harga Jual</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Deskripsi</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Status Ketersediaan</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMenuList.map((menu) => (
                  <tr key={menu.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <td style={{ padding: "1rem", fontWeight: 800, color: "#FFF" }}>
                      {menu.name}
                    </td>

                    <td style={{ padding: "1rem" }}>
                      <span
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          padding: "0.2rem 0.55rem",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#E2E8F0",
                        }}
                      >
                        {menu.category}
                      </span>
                    </td>

                    <td style={{ padding: "1rem", fontWeight: 900, color: "var(--brand-orange-light)", fontSize: "0.95rem" }}>
                      Rp {menu.price.toLocaleString("id-ID")}
                    </td>

                    <td style={{ padding: "1rem", color: "var(--text-muted)", fontSize: "0.8rem", maxWidth: "260px" }}>
                      {menu.description}
                    </td>

                    <td style={{ padding: "1rem" }}>
                      <button
                        onClick={() => toggleMenuAvailability(menu.id)}
                        style={{
                          background: menu.isAvailable ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          border: menu.isAvailable ? "1px solid #10B981" : "1px solid #EF4444",
                          color: menu.isAvailable ? "#34D399" : "#FCA5A5",
                          padding: "0.3rem 0.7rem",
                          borderRadius: "var(--radius-pill)",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {menu.isAvailable ? "● Tersedia (Aktif)" : "○ Habis (Stok Kosong)"}
                      </button>
                    </td>

                    <td style={{ padding: "1rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => {
                            const newPriceStr = prompt(`Ubah harga untuk "${menu.name}" (saat ini Rp ${menu.price}):`, menu.price.toString());
                            if (newPriceStr) {
                              const p = parseInt(newPriceStr);
                              if (p > 0) {
                                setMenuList((prev) =>
                                  prev.map((item) => (item.id === menu.id ? { ...item, price: p } : item))
                                );
                              }
                            }
                          }}
                          className="btn-secondary"
                          style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }}
                        >
                          Ubah Harga
                        </button>
                        <button
                          onClick={() => handleDeleteMenu(menu.id, menu.name)}
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#FCA5A5",
                            padding: "0.35rem 0.65rem",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 3: MANAJEMEN STAF KASIR & BARISTA (NO OTP/EMAIL) */}
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

        {/* SECTION 4: MANAJEMEN DAFTAR WAITERS & REKONSILIASI KAS LACI */}
        <section className="glass-panel" style={{ padding: "1.75rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Daftar Waiters &amp; Rekonsiliasi Kas Laci</h2>
              <div style={{ fontSize: "0.825rem", color: "var(--text-muted)" }}>
                Kelola daftar pelayan meja, jam kerja aktif, dan pencocokan uang tunai yang ditagih ke meja pelanggan.
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

        {/* SECTION 5: PENGATURAN QRIS TOKO & CETAK QR MEJA */}
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
              onClick={() => alert("Silakan pilih gambar QRIS baru dari perangkat Anda untuk di-upload.")}
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

      {/* MODAL 1: TAMBAH MENU WARKOP BARU */}
      {isMenuModalOpen && (
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
          <div className="glass-panel" style={{ maxWidth: "480px", width: "100%", padding: "1.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--brand-orange-light)" }}>
                Tambah Menu Warkop Baru
              </h3>
              <button onClick={() => setIsMenuModalOpen(false)} className="btn-secondary" style={{ width: "32px", height: "32px", padding: 0 }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMenu} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                  Nama Menu (Contoh: Kopi Tarik Aceh, Es Milo Dinosaurus)
                </label>
                <input
                  type="text"
                  required
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  placeholder="Ketik nama hidangan..."
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                    Kategori
                  </label>
                  <select
                    value={newMenuCategory}
                    onChange={(e) => setNewMenuCategory(e.target.value as any)}
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
                    <option value="Kopi">Kopi</option>
                    <option value="Dingin">Minuman Dingin</option>
                    <option value="Makanan">Makanan</option>
                    <option value="Camilan">Camilan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    value={newMenuPrice}
                    onChange={(e) => setNewMenuPrice(parseInt(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      background: "var(--bg-surface-1)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--brand-orange-light)",
                      fontSize: "0.95rem",
                      fontWeight: 800,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                  Deskripsi / Keterangan Singkat
                </label>
                <textarea
                  rows={2}
                  value={newMenuDesc}
                  onChange={(e) => setNewMenuDesc(e.target.value)}
                  placeholder="Keterangan rasa, topping, atau takaran..."
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: "var(--bg-surface-1)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "0.5rem" }}>
                ✓ Simpan ke Katalog Menu
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TAMBAH STAF WARKOP BARU */}
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

      {/* MODAL 3: TAMBAH WAITERS BARU */}
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

      {/* MODAL 4: QRIS PEMBAYARAN SAAS PUSAT (SETOR SEWA) */}
      {isCentralPaymentModalOpen && (
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
          <div className="glass-panel" style={{ maxWidth: "480px", width: "100%", padding: "2rem", border: "2px solid #F59E0B" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#FBBF24" }}>
                Setor Biaya Sewa SaaS Platform OKESIH
              </h3>
              <button onClick={() => setIsCentralPaymentModalOpen(false)} className="btn-secondary" style={{ width: "32px", height: "32px", padding: 0 }}>
                ✕
              </button>
            </div>

            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <div
                style={{
                  width: "160px",
                  height: "160px",
                  background: "#FFF",
                  borderRadius: "10px",
                  margin: "0 auto 1rem",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ color: "#000", fontSize: "10px", fontWeight: 900 }}>QRIS RESMI OKESIH PUSAT</div>
                <div style={{ width: "105px", height: "105px", background: "#000", borderRadius: "4px", margin: "4px auto" }} />
                <div style={{ color: "#555", fontSize: "8px" }}>NMID: ID1029384756520</div>
              </div>

              <div style={{ fontSize: "0.9rem", color: "#94A3B8" }}>
                Total Transfer Wajib (Termasuk Kode Unik):
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#FBBF24", marginTop: "2px" }}>
                Rp 6.345
              </div>
              <div style={{ fontSize: "0.75rem", color: "#34D399", marginTop: "3px" }}>
                *Wajib transfer tepat hingga 3 digit terakhir (kode #{uniqueCode}) agar diverifikasi otomatis oleh OCR AI.
              </div>
            </div>

            <div
              style={{
                padding: "0.85rem",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.05)",
                fontSize: "0.8rem",
                color: "#E2E8F0",
                marginBottom: "1.25rem",
                lineHeight: 1.6,
              }}
            >
              <div><strong>Rekening Pusat:</strong> BCA 8001928374</div>
              <div><strong>Atas Nama:</strong> PT OKESIH KARYA DIGITAL</div>
            </div>

            <button
              onClick={() => {
                alert("Silakan unggah foto/screenshot bukti transfer m-banking Anda untuk diverifikasi OCR otomatis.");
                setIsCentralPaymentModalOpen(false);
              }}
              className="btn-primary"
              style={{ width: "100%", background: "linear-gradient(135deg, #F59E0B, #D97706)", fontWeight: 800 }}
            >
              📷 Upload Bukti Transfer Setoran
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
