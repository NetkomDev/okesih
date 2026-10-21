"use client";
import type { QueuedOperation } from "@/lib/device-offline";
export function DeviceSyncQueue({ operations, resolve }: { operations: QueuedOperation[]; resolve: (id: string, discard: boolean) => Promise<void> }) {
  const failed = operations.filter((operation) => operation.failure);
  if (!failed.length) return null;
  return <section className="ops-error" aria-label="Perubahan belum tersinkron">
    <strong>Perubahan perlu diperiksa</strong>
    {failed.map((operation) => <div key={operation.id}>
      <p>{String(operation.body.status || "Pesanan")}: {operation.failure}</p>
      <button onClick={() => void resolve(operation.id, false)}>Coba lagi</button>
      <button onClick={() => { if (window.confirm("Pastikan status pesanan sudah diperiksa. Abaikan perubahan lokal ini? Data di server tidak dihapus.")) void resolve(operation.id, true); }}>Abaikan perubahan</button>
    </div>)}
  </section>;
}
