import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type ObjectPath = { bucket: string; path: string };
type Job = { id: string; entity_id: string; entity_type: "TENANT" | "MARKETING"; user_ids: string[]; objects: ObjectPath[]; prefixes: ObjectPath[] };
const buckets = new Set(["menu-images", "business-logos", "qris-warkop", "bukti-transfer", "partner-photos"]);

// Never interpret an arbitrary external URL as one of our Storage objects.
export function deletionStoragePath(admin: SupabaseClient, object: ObjectPath) {
  if (!buckets.has(object.bucket)) throw new Error("Unexpected cleanup bucket");
  let path = object.path;
  if (/^https?:\/\//.test(path)) {
    const base = admin.storage.from(object.bucket).getPublicUrl("").data.publicUrl;
    const url = new URL(path), expected = new URL(base);
    if (url.origin !== expected.origin || !url.pathname.startsWith(expected.pathname)) return null;
    path = decodeURIComponent(url.pathname.slice(expected.pathname.length));
  }
  if (!path || path.startsWith("/") || path.split("/").some(p => p === ".." || p === ".")) throw new Error("Invalid cleanup path");
  return path;
}

async function cleanJob(admin: SupabaseClient, job: Job) {
  for (const object of job.objects) {
    const path = deletionStoragePath(admin, object);
    if (!path) continue;
    // Only files in this entity's namespace can be removed, even for legacy URLs.
    if (!job.prefixes.some(p => p.bucket === object.bucket && path.startsWith(p.path))) throw new Error("Cleanup path outside entity namespace");
    const result = await admin.storage.from(object.bucket).remove([path]);
    if (result.error) throw result.error;
    const cleared = await admin.from("storage_cleanup_jobs").delete().eq("bucket", object.bucket).in("path", [path, object.path]);
    if (cleared.error) throw cleared.error;
  }
  // Enumerate entire folders, including superseded files no longer referenced by rows.
  async function removeFolder(bucket: string, prefix: string) {
    for (;;) {
      const listed = await admin.storage.from(bucket).list(prefix, { limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } });
      if (listed.error) throw listed.error;
      if (!listed.data?.length) break;
      const files: string[] = [];
      for (const entry of listed.data) {
        const path = `${prefix.replace(/\/$/, "")}/${entry.name}`;
        if (entry.id) files.push(path);
        else await removeFolder(bucket, path);
      }
      if (files.length) {
        const removed = await admin.storage.from(bucket).remove(files);
        if (removed.error) throw removed.error;
        const cleared = await admin.from("storage_cleanup_jobs").delete().eq("bucket", bucket).in("path", files);
        if (cleared.error) throw cleared.error;
      }
      // Supabase folders are virtual: removing descendants removes the folder too.
      // Always restart at zero so deleting a page never skips the following page.
    }
  }
  for (const prefix of job.prefixes) {
    if (!buckets.has(prefix.bucket) || ![`${job.entity_id}/`, `saas-billings/${job.entity_id}/`].includes(prefix.path)) throw new Error("Invalid cleanup prefix");
    await removeFolder(prefix.bucket, prefix.path);
  }
  for (const userId of job.user_ids) {
    // A shared account must survive if it was linked elsewhere since the job was queued.
    const [members, partners] = await Promise.all([
      admin.from("warkop_members").select("user_id").eq("user_id", userId).limit(1),
      admin.from("marketing_partners").select("user_id").eq("user_id", userId).limit(1),
    ]);
    if (members.error || partners.error) throw members.error || partners.error;
    if (members.data?.length || partners.data?.length) continue;
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error && result.error.code !== "user_not_found" && result.error.status !== 404) throw result.error;
  }
  const removed = await admin.from("entity_deletion_jobs").delete().eq("id", job.id);
  if (removed.error) throw removed.error;
}

export async function processEntityDeletionJobs(admin: SupabaseClient, jobId?: string, limit = 10) {
  let query = admin.from("entity_deletion_jobs").select("*").order("attempted_at", { ascending: true, nullsFirst: true }).limit(jobId ? 1 : limit);
  if (jobId) query = query.eq("id", jobId);
  const { data, error } = await query;
  if (error) throw error;
  let pending = 0, completed = 0;
  for (const job of (data || []) as Job[]) {
    try {
      await cleanJob(admin, job);
      completed++;
    } catch (error) {
      pending++;
      console.error("Entity cleanup will retry", { jobId: job.id, error });
      const update = await admin.from("entity_deletion_jobs").update({ attempted_at: new Date().toISOString() }).eq("id", job.id);
      if (update.error) console.error("Cleanup attempt timestamp failed", { jobId: job.id });
    }
  }
  return { pending, completed };
}

export async function permanentlyDeleteEntity(admin: SupabaseClient, type: "TENANT" | "MARKETING", id: string, actor: string) {
  const result = await admin.rpc("delete_entity_permanently", { p_type: type, p_id: id, p_actor: actor });
  if (result.error || !result.data?.jobId) throw result.error || new Error("Deletion job missing");
  // Database removal committed atomically. External failure is explicitly reported and retried by cron.
  let cleanupPending = true;
  try { cleanupPending = (await processEntityDeletionJobs(admin, result.data.jobId)).pending > 0; }
  catch (error) { console.error("Entity cleanup deferred", error); }
  return { success: true, cleanupPending, detachedTenantsCount: result.data.detachedTenantsCount || 0 };
}
