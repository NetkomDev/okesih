import type { Pagination as PageInfo } from "@/lib/reporting";

export default function Pagination({ pagination, onPage, loading = false }: { pagination: PageInfo; onPage: (page: number) => void; loading?: boolean }) {
  return <nav aria-label="Navigasi halaman" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between", padding: "1rem 0" }}>
    <span aria-live="polite">Halaman {pagination.page} / {pagination.totalPages} · {pagination.total.toLocaleString("id-ID")} hasil</span>
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button type="button" className="btn-secondary" disabled={loading || pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Sebelumnya</button>
      <button type="button" className="btn-secondary" disabled={loading || pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Berikutnya</button>
    </div>
  </nav>;
}
