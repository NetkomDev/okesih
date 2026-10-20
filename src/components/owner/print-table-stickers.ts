import { printTableSigns } from "@/lib/table-sign";
import type { BusinessTable, Profile } from "./types";

export async function printTableStickers(
  data: { profile: Profile; tables: BusinessTable[] },
  _unusedConfig: unknown,
  setError: (message: string) => void,
  singleTableId?: string
) {
  if (!data?.tables.length) return setError("Tambahkan meja terlebih dahulu.");
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://okesih.com";
    await printTableSigns(data.profile, data.tables, origin, singleTableId);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Gagal mencetak papan meja.");
  }
}
