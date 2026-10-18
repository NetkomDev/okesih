"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import OwnerSkeleton from "./OwnerSkeleton";
const Staff = dynamic(() => import("./Staff"), {
  loading: () => <OwnerSkeleton variant="staff" />,
});
const Waiters = dynamic(() => import("./Waiters"), {
  loading: () => <OwnerSkeleton variant="waiters" />,
});
export default function Team({
  initialTab = "staff",
}: {
  initialTab?: "staff" | "waiters";
}) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="owner-team">
      <div className="owner-segmented" role="tablist" aria-label="Kelola tim">
        {(["staff", "waiters"] as const).map((value) => (
          <button
            key={value}
            id={`team-tab-${value}`}
            role="tab"
            aria-selected={tab === value}
            aria-controls="team-panel"
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "staff"
                    : event.key === "End"
                      ? "waiters"
                      : value === "staff"
                        ? "waiters"
                        : "staff";
                setTab(next);
                document.getElementById(`team-tab-${next}`)?.focus();
              }
            }}
          >
            {value === "staff" ? "Akun staf" : "Waiter"}
          </button>
        ))}
      </div>
      <p className="owner-team-description">
        {tab === "staff"
          ? "Akun untuk kasir, barista, dan dapur."
          : "Daftar pelayan yang menangani pesanan meja."}
      </p>
      <div id="team-panel" role="tabpanel" aria-labelledby={`team-tab-${tab}`}>
        {tab === "staff" ? <Staff /> : <Waiters />}
      </div>
    </div>
  );
}
