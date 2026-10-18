"use client";

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

interface MarketingFaqProps {
  faqs: FaqItem[];
}

export default function MarketingFaq({ faqs }: MarketingFaqProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {faqs.map((faq, idx) => (
        <div
          key={idx}
          className="glass-panel"
          style={{
            borderRadius: "14px",
            overflow: "hidden",
            border: openFaq === idx ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border-subtle)",
          }}
        >
          <button
            type="button"
            className="faq-item-button"
            onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
            style={{
              width: "100%",
              padding: "1.15rem 1.25rem",
              background: "none",
              border: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              textAlign: "left",
              color: "var(--text-pure-white)",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                color: openFaq === idx ? "#059669" : "var(--text-pure-white)",
                transition: "color 0.2s ease",
              }}
            >
              {faq.q}
            </span>
            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "#10B981", marginLeft: "1rem" }}>
              {openFaq === idx ? "−" : "+"}
            </span>
          </button>

          {openFaq === idx && (
            <div
              style={{
                padding: "0 1.25rem 1.25rem",
                fontSize: "0.875rem",
                color: "var(--text-muted)",
                lineHeight: 1.6,
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: "0.85rem",
              }}
            >
              {faq.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
