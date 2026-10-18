import React from "react";

type SkeletonVariant =
  | "overview"
  | "staff"
  | "waiters"
  | "menu"
  | "devices"
  | "qris-tables"
  | "generic";

interface OwnerSkeletonProps {
  variant?: SkeletonVariant;
}

export default function OwnerSkeleton({
  variant = "overview",
}: OwnerSkeletonProps) {
  switch (variant) {
    case "overview":
      return (
        <div
          className="owner-home owner-skeleton-container"
          role="status"
          aria-label="Memuat ringkasan penjualan"
        >
          <div
            className="owner-skeleton-box"
            style={{ width: "70%", height: 38 }}
          />
          <div
            className="owner-skeleton-card"
            style={{ minHeight: 226, borderRadius: 22 }}
          >
            <div
              className="owner-skeleton-box"
              style={{ width: "45%", height: 16 }}
            />
            <div
              className="owner-skeleton-box"
              style={{ width: "75%", height: 40, marginTop: 18 }}
            />
            <div
              className="owner-skeleton-box"
              style={{ width: "100%", height: 48, marginTop: 24 }}
            />
          </div>
          <div className="owner-home-tiles">
            {[0, 1].map((item) => (
              <div
                className="owner-skeleton-card"
                key={item}
                style={{ minHeight: 146 }}
              >
                <div
                  className="owner-skeleton-box"
                  style={{ width: 30, height: 30 }}
                />
                <div
                  className="owner-skeleton-box"
                  style={{ width: "100%", height: 24, marginTop: 18 }}
                />
              </div>
            ))}
          </div>
          <div className="owner-skeleton-card" style={{ minHeight: 82 }}>
            <div
              className="owner-skeleton-box"
              style={{ width: "75%", height: 24 }}
            />
          </div>
        </div>
      );

    case "staff":
      return (
        <div
          className="owner-skeleton-container"
          aria-label="Memuat akun staf..."
          role="status"
        >
          <div className="owner-section-heading">
            <div>
              <div
                className="owner-skeleton-box"
                style={{ width: "250px", height: "24px", marginBottom: "8px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "310px", maxWidth: "70%", height: "13px" }}
              />
            </div>
            <div
              className="owner-skeleton-box"
              style={{ width: "120px", height: "38px", borderRadius: "10px" }}
            />
          </div>
          <div
            className="owner-skeleton-card"
            style={{ padding: "0", overflow: "hidden" }}
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  borderBottom:
                    "1px solid var(--ow-border, rgba(148, 163, 184, 0.1))",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    className="owner-skeleton-box"
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                    }}
                  />
                  <div>
                    <div
                      className="owner-skeleton-box"
                      style={{
                        width: "120px",
                        height: "14px",
                        marginBottom: "6px",
                      }}
                    />
                    <div
                      className="owner-skeleton-box"
                      style={{ width: "75px", height: "11px" }}
                    />
                  </div>
                </div>
                <div
                  className="owner-skeleton-box"
                  style={{
                    width: "80px",
                    height: "26px",
                    borderRadius: "999px",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      );

    case "waiters":
      return (
        <div
          className="owner-skeleton-container"
          aria-label="Memuat daftar waiter..."
          role="status"
        >
          <div className="owner-section-heading">
            <div>
              <div
                className="owner-skeleton-box"
                style={{ width: "190px", height: "24px", marginBottom: "8px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "270px", maxWidth: "70%", height: "13px" }}
              />
            </div>
            <div
              className="owner-skeleton-box"
              style={{ width: "130px", height: "38px", borderRadius: "10px" }}
            />
          </div>
          <div className="owner-card-grid">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="owner-skeleton-card"
                style={{ padding: "16px", minHeight: "110px" }}
              >
                <div
                  className="owner-skeleton-box"
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    marginBottom: "10px",
                  }}
                />
                <div
                  className="owner-skeleton-box"
                  style={{
                    width: "110px",
                    height: "15px",
                    marginBottom: "6px",
                  }}
                />
                <div
                  className="owner-skeleton-box"
                  style={{ width: "85px", height: "12px" }}
                />
              </div>
            ))}
          </div>
        </div>
      );

    case "menu":
      return (
        <div
          className="owner-skeleton-container"
          aria-label="Memuat katalog menu..."
          role="status"
        >
          <div className="owner-section-heading">
            <div>
              <div
                className="owner-skeleton-box"
                style={{ width: "200px", height: "24px", marginBottom: "8px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "300px", maxWidth: "70%", height: "13px" }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <div
                className="owner-skeleton-box"
                style={{ width: "110px", height: "38px", borderRadius: "10px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "120px", height: "38px", borderRadius: "10px" }}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              margin: "16px 0",
              overflowX: "hidden",
            }}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="owner-skeleton-box"
                style={{
                  width: "72px",
                  height: "32px",
                  borderRadius: "999px",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "14px",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="owner-skeleton-card"
                style={{ padding: "16px", minHeight: "130px" }}
              >
                <div style={{ display: "flex", gap: "12px" }}>
                  <div
                    className="owner-skeleton-box"
                    style={{
                      width: "54px",
                      height: "54px",
                      borderRadius: "10px",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      className="owner-skeleton-box"
                      style={{
                        width: "85%",
                        height: "15px",
                        marginBottom: "6px",
                      }}
                    />
                    <div
                      className="owner-skeleton-box"
                      style={{
                        width: "50%",
                        height: "13px",
                        marginBottom: "8px",
                      }}
                    />
                    <div
                      className="owner-skeleton-box"
                      style={{
                        width: "64px",
                        height: "20px",
                        borderRadius: "6px",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "devices":
      return (
        <div
          className="owner-skeleton-container"
          aria-label="Memuat perangkat..."
          role="status"
        >
          <div className="owner-device-setup">
            <div className="owner-skeleton-card" style={{ minHeight: "160px" }}>
              <div
                className="owner-skeleton-box"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  marginBottom: "10px",
                }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "180px", height: "18px", marginBottom: "8px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "100%", height: "13px", marginBottom: "14px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "120px", height: "36px", borderRadius: "8px" }}
              />
            </div>
            <div className="owner-skeleton-card" style={{ minHeight: "160px" }}>
              <div
                className="owner-skeleton-box"
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  marginBottom: "10px",
                }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "160px", height: "18px", marginBottom: "8px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "100%", height: "13px", marginBottom: "14px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "140px", height: "36px", borderRadius: "8px" }}
              />
            </div>
          </div>
          <div
            className="owner-skeleton-card"
            style={{ marginTop: "16px", minHeight: "180px" }}
          >
            <div
              className="owner-skeleton-box"
              style={{ width: "160px", height: "18px", marginBottom: "16px" }}
            />
            {[1, 2].map((i) => (
              <div
                key={i}
                className="owner-skeleton-box"
                style={{
                  width: "100%",
                  height: "64px",
                  borderRadius: "12px",
                  marginBottom: "10px",
                }}
              />
            ))}
          </div>
        </div>
      );

    case "qris-tables":
      return (
        <div
          className="owner-skeleton-container"
          aria-label="Memuat QRIS & meja..."
          role="status"
        >
          <div className="owner-settings-grid">
            <div className="owner-skeleton-card" style={{ minHeight: "260px" }}>
              <div
                className="owner-skeleton-box"
                style={{ width: "160px", height: "18px", marginBottom: "8px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "100%", height: "13px", marginBottom: "16px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "14px",
                  margin: "0 auto 16px",
                }}
              />
              <div
                className="owner-skeleton-box"
                style={{
                  width: "100%",
                  height: "40px",
                  borderRadius: "8px",
                  marginBottom: "10px",
                }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "100%", height: "70px", borderRadius: "8px" }}
              />
            </div>
            <div className="owner-skeleton-card" style={{ minHeight: "260px" }}>
              <div
                className="owner-skeleton-box"
                style={{ width: "140px", height: "18px", marginBottom: "8px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "100%", height: "13px", marginBottom: "16px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{
                  width: "140px",
                  height: "140px",
                  borderRadius: "12px",
                  margin: "0 auto 16px",
                }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "100%", height: "42px", borderRadius: "8px" }}
              />
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div
          className="owner-skeleton-container"
          aria-label="Memuat data..."
          role="status"
        >
          <div className="owner-section-heading">
            <div>
              <div
                className="owner-skeleton-box"
                style={{ width: "200px", height: "24px", marginBottom: "8px" }}
              />
              <div
                className="owner-skeleton-box"
                style={{ width: "300px", maxWidth: "70%", height: "13px" }}
              />
            </div>
          </div>
          <div className="owner-skeleton-card" style={{ minHeight: "180px" }}>
            <div
              className="owner-skeleton-box"
              style={{ width: "100%", height: "120px" }}
            />
          </div>
        </div>
      );
  }
}
