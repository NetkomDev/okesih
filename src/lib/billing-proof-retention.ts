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

export async function deleteExpiredBillingProofs(admin: SupabaseClient) {
  const { error: enqueueError } = await admin.rpc("enqueue_expired_billing_proofs");
  if (enqueueError) throw enqueueError;
  const { data: jobs, error } = await admin.from("storage_cleanup_jobs").select("id,bucket,path").order("created_at").limit(100);
  if (error) throw error;
  let deleted = 0;
  for (const job of jobs || []) {
    const path = billingProofStoragePath(job.path);
    if (!path || job.bucket !== "bukti-transfer") continue;
    // A queued path must never remove a proof still referenced by a current row.
    const [billing, transaction] = await Promise.all([
      admin.from("saas_billings").select("id").eq("bukti_transfer_url", job.path).limit(1),
      admin.from("transactions").select("id").eq("payment_proof_url", job.path).limit(1),
    ]);
    if (billing.error || transaction.error) throw billing.error || transaction.error;
    if (!billing.data?.length && !transaction.data?.length) {
      const { error: removeError } = await admin.storage.from(job.bucket).remove([path]);
      if (removeError) throw removeError;
      deleted++;
    }
    const { error: deleteError } = await admin.from("storage_cleanup_jobs").delete().eq("id", job.id);
    if (deleteError) throw deleteError;
  }
  return { deleted };
}
