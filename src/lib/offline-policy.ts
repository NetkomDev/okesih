export type OfflineSnapshot = { serverTime: string; device: { id: string; expiresAt: string }; profile: { is_active: boolean; offline_limit_hours: number } };
export function canOperateOffline(snapshot: OfflineSnapshot | null | undefined, now = Date.now()) {
  if (!snapshot?.profile.is_active) return false;
  const validated = Date.parse(snapshot.serverTime);
  const expires = Date.parse(snapshot.device.expiresAt);
  const limit = snapshot.profile.offline_limit_hours * 3_600_000;
  return Number.isFinite(validated) && Number.isFinite(expires) && limit > 0 && now >= validated - 60_000 && now - validated <= limit && now < expires;
}
export function syncFailureKind(status: number): "retry" | "blocked" {
  return status === 408 || status === 429 || status >= 500 ? "retry" : "blocked";
}
