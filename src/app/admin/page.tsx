import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-deep-black)", color: "#FFF" }}>
      {/* Admin Top Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2rem",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/" style={{ fontSize: "1.25rem", fontWeight: 800 }}>
            🛡️ OKESIH <span style={{ color: "var(--brand-orange-light)" }}>MANAGEMENT</span>
          </Link>
          <span className="badge" style={{ background: "rgba(255, 255, 255, 0.1)", color: "#E5E7EB" }}>
            Superadmin & Tenant Portal
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Login sebagai: <strong style={{ color: "#FFF" }}>owner@warkop-demo</strong>
          </span>
          <Link href="/" className="btn-secondary" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}>
            Keluar
          </Link>
        </div>
      </header>

      {/* Main Admin Content */}
      <main style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem" }}>
        {/* Metric Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1.25rem",
            marginBottom: "2rem",
          }}
        >
          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Total Transaksi Hari Ini
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900 }}>248 Struk</div>
            <div style={{ fontSize: "0.8rem", color: "var(--brand-orange-light)", marginTop: "0.25rem" }}>
              Termasuk 3 pesanan VOID
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Akumulasi Tagihan SaaS (@ Rp 50)
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--brand-orange-light)" }}>
              Rp 12.400
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
              Kode Unik Alokasi: +145 (Total Rp 12.545)
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Status Shift Kasir
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#10B981" }}>Aktif</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
              Kasir: kasir1 (Shift Siang)
            </div>
          </div>

          <div className="glass-panel" style={{ padding: "1.5rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              Validasi OCR Terakhir
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#3B82F6" }}>LUNAS</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
              Shift Kemarin: Rp 14.645 (Verified)
            </div>
          </div>
        </div>

        {/* Section: Generate Akun Staf Praktis (No OTP / Email) */}
        <section className="glass-panel" style={{ padding: "2rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>Manajemen Akun Staf Warkop</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Buat username &amp; password instan untuk kasir atau tim dapur tanpa perlu registrasi email atau OTP.
              </p>
            </div>
            <button className="btn-primary" style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem" }}>
              + Buat Staf Baru
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "0.75rem 1rem" }}>Username</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Peran (Role)</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Status</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Warkop Tenant</th>
                  <th style={{ padding: "0.75rem 1rem" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "1rem", fontWeight: 700 }}>kasir1</td>
                  <td style={{ padding: "1rem" }}><span className="badge badge-ready">Kasir POS</span></td>
                  <td style={{ padding: "1rem", color: "#10B981" }}>Aktif</td>
                  <td style={{ padding: "1rem", color: "var(--text-dim)" }}>Warkop Demo</td>
                  <td style={{ padding: "1rem" }}>
                    <button className="btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                      Reset Password
                    </button>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "1rem", fontWeight: 700 }}>dapur</td>
                  <td style={{ padding: "1rem" }}><span className="badge badge-cooking">Kitchen KDS</span></td>
                  <td style={{ padding: "1rem", color: "#10B981" }}>Aktif</td>
                  <td style={{ padding: "1rem", color: "var(--text-dim)" }}>Warkop Demo</td>
                  <td style={{ padding: "1rem" }}>
                    <button className="btn-secondary" style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}>
                      Reset Password
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
