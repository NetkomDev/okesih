import type { PostgrestError } from "@supabase/supabase-js";
// A full page is followed by another read even when the server caps rows below
// the requested page size. Never infer completeness from a short page.
export async function readAllRows<T>(query: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }> }) {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await query().range(rows.length, rows.length + 499);
    if (error) return { data: null, error };
    if (!data?.length) return { data: rows, error: null };
    rows.push(...data);
    if (rows.length > 50_000) throw new Error("Data operasional melebihi batas. Hubungi Admin.");
  }
}
