import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const BILLING_PROOF_RETENTION_DAYS = 90;

export function billingProofStoragePath(value: string) {
  if (!value.startsWith("http")) return value;
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    const marker = "/bukti-transfer/";
    const index = pathname.indexOf(marker);
    return index >= 0 ? pathname.slice(index + marker.length) : null;
  } catch {
    return null;
  }
}

export async function deleteExpiredBillingProofs(admin: SupabaseClient, warkopId?: string) {
  const cutoff = new Date(Date.now() - BILLING_PROOF_RETENTION_DAYS * 24 * 60 * 60_000).toISOString().slice(0, 10);
  let query = admin
    .from("saas_billings")
    .select("id,warkop_id,bukti_transfer_url")
    .not("bukti_transfer_url", "is", null)
    .lte("tanggal", cutoff)
    .limit(100);
  if (warkopId) query = query.eq("warkop_id", warkopId);

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows?.length) return { deleted: 0 };

  const paths = rows.flatMap((row) => {
    const path = billingProofStoragePath(row.bukti_transfer_url);
    return path ? [path] : [];
  });
  if (paths.length) {
    const { error: storageError } = await admin.storage.from("bukti-transfer").remove(paths);
    if (storageError) throw storageError;
  }

  const ids = rows.map((row) => row.id);
  const { error: updateError } = await admin
    .from("saas_billings")
    .update({ bukti_transfer_url: null, ocr_raw_text: null })
    .in("id", ids);
  if (updateError) throw updateError;

  return { deleted: rows.length };
}
