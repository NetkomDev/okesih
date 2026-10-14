export type UserRole = "SUPERADMIN" | "OWNER" | "MARKETING" | "KASIR" | "DAPUR";

export function getTrustedUserRole(user: unknown): UserRole | null {
  if (!user || typeof user !== "object") return null;
  const appMetadata = (user as { app_metadata?: unknown }).app_metadata;
  if (!appMetadata || typeof appMetadata !== "object") return null;
  const role = String((appMetadata as { role?: unknown }).role || "").toUpperCase();
  if (role === "SUPERADMIN" || role === "OWNER" || role === "MARKETING" || role === "KASIR" || role === "DAPUR") {
    return role;
  }
  return null;
}
