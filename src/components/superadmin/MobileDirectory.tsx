"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import ModalFrame from "./ModalFrame";

const query = "(max-width: 640px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
export function useDirectoryPageSize() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false) ? 10 : 25;
}
export function MobileDirectory({ label, headers, rows, onSelect, numericLast = false, thirdAlign = "left" }: {
  label: string; numericLast?: boolean; headers: [string, string, string];
  rows: { id: string; name: string; second: string; third: ReactNode; coordinator?: boolean }[];
  onSelect: (id: string) => void;
  thirdAlign?: "left" | "right";
}) {
  return <div className="sa-phone-directory" data-numeric-last={numericLast || undefined}><table aria-label={label}>
    <colgroup><col style={{ width: "44%" }} /><col style={{ width: "28%" }} /><col style={{ width: "28%" }} /></colgroup>
    <thead>
      <tr>
        <th scope="col">{headers[0]}</th>
        <th scope="col">{headers[1]}</th>
        <th scope="col" style={thirdAlign === "right" ? { textAlign: "right" } : undefined}>{headers[2]}</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 ? (
        <tr>
          <td colSpan={3} style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--text-muted)" }}>
            Tidak ada data yang cocok.
          </td>
        </tr>
      ) : (
        rows.map(row => (
          <tr key={row.id} onClick={() => onSelect(row.id)} style={{ cursor: "pointer" }}>
            <td>
              <button type="button" onClick={() => onSelect(row.id)} aria-label={`Lihat detail ${row.name}`}>
                <span className="sa-phone-clamp">{row.name}</span>
                {row.coordinator && <span className="sa-kormit-badge"><i aria-hidden="true" />KorMit</span>}
              </button>
            </td>
            <td><span className="sa-phone-clamp">{row.second || "—"}</span></td>
            <td style={thirdAlign === "right" ? { textAlign: "right" } : undefined}>
              <span className="sa-phone-clamp">{row.third ?? "—"}</span>
            </td>
          </tr>
        ))
      )}
    </tbody>
  </table></div>;
}
export function DirectoryDetail({ title, subtitle, fields, actions, onClose }: {
  title: string; subtitle: string; fields: [string, ReactNode][]; actions: ReactNode; onClose: () => void;
}) {
  return <ModalFrame label={`Detail ${title}`} onClose={onClose}>
    <section className="glass-panel sa-directory-detail">
      <header>
        <div>
          <p>{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <button type="button" className="btn-secondary" aria-label="Tutup detail" onClick={onClose}>✕</button>
      </header>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === undefined || value === null || value === "" ? "—" : value}</dd>
          </div>
        ))}
      </dl>
      <footer onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button:not(:disabled), a[href]")) {
          onClose();
        }
      }}>
        {actions}
      </footer>
    </section>
  </ModalFrame>;
}
