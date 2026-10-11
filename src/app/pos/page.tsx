import Link from "next/link";

export default function PosModulePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-deep-black)" }}>
      {/* Top Bar Kasir */}
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
            ☕ OKESIH <span style={{ color: "var(--brand-orange-light)" }}>POS</span>
          </Link>
          <span className="badge badge-ready">Online / Synced</span>
          <span className="badge" style={{ background: "rgba(255, 69, 0, 0.15)", color: "var(--brand-orange-light)" }}>
            Shift #1 - Aktif
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
            🖨️ Printer Bluetooth
          </button>
          <button
            className="btn-primary"
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.85rem",
              background: "linear-gradient(135deg, #EF4444, #DC2626)",
            }}
          >
            🔒 Tutup Shift & Setor
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", gap: "1px", background: "var(--border-subtle)" }}>
        {/* Left: Product Grid for Fast Tap */}
        <div style={{ background: "var(--bg-deep-black)", padding: "1.5rem", overflowY: "auto" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
            {["Semua Menu", "Kopi & Teh", "Minuman Dingin", "Mie & Makanan", "Camilan & Rokok"].map((cat, i) => (
              <button
                key={cat}
                className={i === 0 ? "btn-primary" : "btn-secondary"}
                style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "1rem",
            }}
          >
            {[
              { name: "Kopi Hitam Tubruk", price: "Rp 5.000", cat: "Kopi" },
              { name: "Kopi Susu Panas", price: "Rp 7.000", cat: "Kopi" },
              { name: "Es Teh Manis Jumbo", price: "Rp 5.000", cat: "Dingin" },
              { name: "Nutrisari Dingin", price: "Rp 6.000", cat: "Dingin" },
              { name: "Indomie Goreng + Telur", price: "Rp 12.000", cat: "Makanan" },
              { name: "Indomie Rebus Kuah Kental", price: "Rp 12.000", cat: "Makanan" },
              { name: "Roti Bakar Coklat Keju", price: "Rp 10.000", cat: "Camilan" },
              { name: "Gorengan Bakwan (3 pcs)", price: "Rp 5.000", cat: "Camilan" },
            ].map((item) => (
              <button
                key={item.name}
                className="glass-panel"
                style={{
                  padding: "1.25rem 1rem",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "130px",
                  border: "1px solid var(--border-subtle)",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--brand-orange-light)", fontWeight: 700 }}>
                    {item.cat}
                  </span>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, marginTop: "0.25rem", color: "#FFF" }}>
                    {item.name}
                  </div>
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#FFF" }}>
                  {item.price}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Order Cart & High-Throughput Checkout */}
        <div style={{ background: "var(--bg-surface-1)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>Pesanan Aktif</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Nomor Antrean Berikutnya: #014</div>
          </div>

          <div style={{ flex: 1, padding: "1.25rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="glass-panel" style={{ padding: "0.875rem", display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Kopi Susu Panas</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>2x @ Rp 7.000 (Manis sedang)</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Rp 14.000</div>
            </div>

            <div className="glass-panel" style={{ padding: "0.875rem", display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Indomie Goreng + Telur</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>1x @ Rp 12.000 (Setengah matang, pedas)</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>Rp 12.000</div>
            </div>
          </div>

          <div style={{ padding: "1.25rem", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Subtotal (2 Item):</span>
              <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Rp 26.000</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "1rem" }}>
              *Sewa Micro-SaaS OKESIH: Rp 50 (akumulasi tagihan harian)
            </div>

            <button
              className="btn-primary"
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1.1rem",
                letterSpacing: "0.02em",
              }}
            >
              BAYAR & KIRIM KE DAPUR (Rp 26.000)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
