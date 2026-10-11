import Link from "next/link";

interface MenuPageProps {
  params: Promise<{
    warkopId: string;
  }>;
}

export default async function CustomerMenuPage({ params }: MenuPageProps) {
  const { warkopId } = await params;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-deep-black)", color: "#FFF", paddingBottom: "5rem" }}>
      {/* Top Banner Warkop */}
      <div
        style={{
          padding: "2.5rem 1.5rem",
          background: "linear-gradient(180deg, rgba(255, 69, 0, 0.25) 0%, rgba(13, 13, 14, 0) 100%)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span className="badge badge-ready">Buka & Siap Melayani</span>
            <Link href="/" style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
              Beranda OKESIH
            </Link>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 900, marginBottom: "0.25rem" }}>
            Katalog Digital Warkop: {warkopId}
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            Pilih menu favoritmu, dapatkan barcode tiket pesanan, lalu tunjukkan ke kasir untuk bayar!
          </p>
        </div>
      </div>

      {/* Menu List */}
      <div style={{ maxWidth: "600px", margin: "1.5rem auto", padding: "0 1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {[
          { name: "Kopi Hitam Tubruk Giras", price: "Rp 5.000", desc: "Biji kopi robusta giling halus seduh air mendidih." },
          { name: "Kopi Susu Panas Legendaris", price: "Rp 7.000", desc: "Racikan susu kental manis + kopi tubruk khas warkop." },
          { name: "Es Teh Manis Jumbo", price: "Rp 5.000", desc: "Teh melati wangi dingin segar gelas besar." },
          { name: "Indomie Goreng Dobel Telur", price: "Rp 15.000", desc: "2 bungkus mie goreng dengan 2 butir telur dan sawi." },
        ].map((menu) => (
          <div
            key={menu.name}
            className="glass-panel"
            style={{
              padding: "1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", marginBottom: "0.25rem" }}>{menu.name}</div>
              <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>{menu.desc}</div>
              <div style={{ fontWeight: 800, color: "var(--brand-orange-light)", fontSize: "1rem" }}>{menu.price}</div>
            </div>
            <button className="btn-primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
              + Tambah
            </button>
          </div>
        ))}
      </div>

      {/* Floating Order Cart Bar */}
      <div
        style={{
          position: "fixed",
          bottom: "1rem",
          left: "1rem",
          right: "1rem",
          maxWidth: "580px",
          margin: "0 auto",
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius-lg)",
          background: "linear-gradient(135deg, #1C1C21, #151518)",
          border: "1px solid rgba(255, 69, 0, 0.4)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 100,
        }}
      >
        <div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Total Keranjang (1 Item):</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#FFF" }}>Rp 7.000</div>
        </div>

        <button className="btn-primary" style={{ padding: "0.75rem 1.5rem" }}>
          Buat Tiket Barcode →
        </button>
      </div>
    </div>
  );
}
