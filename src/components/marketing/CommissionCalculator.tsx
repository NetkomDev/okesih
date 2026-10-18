"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

interface CommissionCalculatorProps {
  initialCommissionPerReceipt?: number;
}

export default function CommissionCalculator({
  initialCommissionPerReceipt = 15,
}: CommissionCalculatorProps) {
  const [tenantCount, setTenantCount] = useState<number>(20);
  const [avgReceipts, setAvgReceipts] = useState<number>(120);
  const [commissionPerReceipt, setCommissionPerReceipt] = useState<number>(initialCommissionPerReceipt);

  useEffect(() => {
    fetch("/api/platform-settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload) => {
        if (payload?.data?.defaultMarketingCommission) {
          setCommissionPerReceipt(payload.data.defaultMarketingCommission);
        }
      })
      .catch(() => undefined);
  }, []);

  const dailyReceiptsTotal = tenantCount * avgReceipts;
  const dailyCommission = dailyReceiptsTotal * commissionPerReceipt;
  const monthlyCommission = dailyCommission * 30;

  return (
    <section
      id="simulasi"
      style={{
        position: "relative",
        zIndex: 1,
        padding: "4rem 1.5rem",
        maxWidth: "980px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        className="glass-panel-glow"
        style={{
          padding: "3rem 2.25rem",
          borderRadius: "24px",
          border: "1px solid rgba(16, 185, 129, 0.35)",
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 13, 14, 0.98) 100%)",
          boxShadow: "0 16px 50px rgba(0, 0, 0, 0.7)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.35rem 0.95rem",
              borderRadius: "var(--radius-pill)",
              backgroundColor: "rgba(251, 191, 36, 0.15)",
              border: "1px solid rgba(251, 191, 36, 0.4)",
              color: "#FBBF24",
              fontSize: "0.8rem",
              fontWeight: 800,
              marginBottom: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            📊 KALKULATOR POTENSI PENDAPATAN
          </div>
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.1rem)", fontWeight: 900, letterSpacing: "-0.02em" }}>
            Berapa Penghasilan Pasif yang Bisa Anda Dapatkan?
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", maxWidth: "600px", margin: "0.5rem auto 0" }}>
            Geser slider di bawah ini untuk mensimulasikan jumlah tenant aktif dan rata-rata struk harian:
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "2rem",
            alignItems: "center",
          }}
        >
          {/* Slider Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-pure-white)" }}>
                  Jumlah Tenant / Kafe Binaan:
                </label>
                <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#34D399" }}>
                  {tenantCount} Tenant
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={tenantCount}
                onChange={(e) => setTenantCount(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#10B981", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                <span>1 Tenant</span>
                <span>50 Tenant</span>
                <span>100 Tenant</span>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-pure-white)" }}>
                  Rata-rata Transaksi per Toko / Hari:
                </label>
                <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#FBBF24" }}>
                  {avgReceipts} Struk / Hari
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="300"
                step="10"
                value={avgReceipts}
                onChange={(e) => setAvgReceipts(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#FBBF24", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "0.25rem" }}>
                <span>30 Struk</span>
                <span>150 Struk</span>
                <span>300 Struk</span>
              </div>
            </div>
          </div>

          {/* Hasil Kalkulasi Card */}
          <div
            className="calc-result-box"
            style={{
              padding: "2rem",
              borderRadius: "20px",
              background: "rgba(0, 0, 0, 0.55)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Estimasi Pendapatan Pasif Bulanan
            </div>
            <div
              style={{
                fontSize: "clamp(2rem, 4vw, 2.75rem)",
                fontWeight: 900,
                color: "#34D399",
                margin: "0.5rem 0 1rem",
                letterSpacing: "-0.02em",
              }}
            >
              Rp {monthlyCommission.toLocaleString("id-ID")}
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Berasal dari <strong>{dailyReceiptsTotal.toLocaleString("id-ID")} struk/hari</strong> × Rp {commissionPerReceipt.toLocaleString("id-ID")} ={" "}
              <span style={{ color: "#FBBF24" }}>Rp {dailyCommission.toLocaleString("id-ID")}/hari</span>.
            </div>
            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1.25rem",
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              <Link
                href="/marketing/daftar"
                className="btn-primary"
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  padding: "0.85rem",
                  fontSize: "0.95rem",
                  fontWeight: 900,
                  borderRadius: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  textDecoration: "none",
                  color: "#FFF",
                }}
              >
                <span>Daftar Sekarang &amp; Amankan Wilayah Anda</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
