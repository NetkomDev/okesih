"use client";

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {items.map((faq, idx) => (
        <div
          key={idx}
          className="glass-panel mobile-compact-panel"
          style={{
            padding: "1.25rem 1.5rem",
            cursor: "pointer",
            border: openFaq === idx ? "1px solid rgba(255, 69, 0, 0.4)" : "1px solid var(--border-subtle)",
          }}
          onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: openFaq === idx ? "var(--brand-orange-text)" : "var(--text-pure-white)",
                transition: "color 0.2s ease",
              }}
            >
              {faq.q}
            </h3>
            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--brand-orange-text)" }}>
              {openFaq === idx ? "−" : "+"}
            </span>
          </div>
          {openFaq === idx && (
            <p style={{ marginTop: "0.85rem", fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              {faq.a}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
