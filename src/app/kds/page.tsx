import Link from "next/link";

export default function KdsModulePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-deep-black)" }}>
      {/* KDS Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/" style={{ fontSize: "1.2rem", fontWeight: 800 }}>
            🍳 OKESIH <span style={{ color: "#FBBF24" }}>KITCHEN DISPLAY (KDS)</span>
          </Link>
          <span className="badge badge-ready">● Realtime WebSocket Aktif</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Pesanan Mengantre: <strong style={{ color: "#FFF" }}>3 Tiket</strong>
          </div>
          <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            🔊 Test Audio Bel
          </button>
        </div>
      </header>

      {/* Ticket Grid */}
      <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
        {/* Ticket 1: Cooking */}
        <div className="glass-panel" style={{ padding: "1.25rem", border: "1px solid rgba(245, 158, 11, 0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
            <div>
              <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#FBBF24" }}>#012</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginLeft: "0.5rem" }}>12 Menit lalu</span>
            </div>
            <span className="badge badge-cooking">Sedang Digarap</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>2x Indomie Goreng Telur</span>
              <span style={{ color: "var(--brand-orange-light)", fontWeight: 700 }}>Pedas level 3</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>1x Es Teh Manis Jumbo</span>
              <span style={{ color: "var(--text-dim)" }}>Normal</span>
            </div>
          </div>

          <button
            className="btn-primary"
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #10B981, #059669)",
              boxShadow: "0 4px 16px rgba(16, 185, 129, 0.35)",
            }}
          >
            ✓ SELESAI & PANGGIL PELANGGAN
          </button>
        </div>

        {/* Ticket 2: New Order */}
        <div className="glass-panel" style={{ padding: "1.25rem", border: "1px solid rgba(59, 130, 246, 0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
            <div>
              <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#60A5FA" }}>#013</span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginLeft: "0.5rem" }}>2 Menit lalu</span>
            </div>
            <span className="badge badge-new">Pesanan Baru</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>1x Kopi Susu Panas</span>
              <span style={{ color: "var(--text-dim)" }}>Gula aren sedikit</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: "1rem" }}>1x Roti Bakar Keju</span>
              <span style={{ color: "var(--text-dim)" }}>Susu kental manis</span>
            </div>
          </div>

          <button className="btn-secondary" style={{ width: "100%", fontWeight: 700, borderColor: "rgba(59, 130, 246, 0.4)" }}>
            MULAI GARAP TIKET INI →
          </button>
        </div>
      </div>
    </div>
  );
}
