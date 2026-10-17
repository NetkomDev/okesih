export type AppSurface = "PUBLIC" | "SUPERADMIN" | "OWNER" | "MARKETING" | "POS" | "KDS";

export const APP_HOSTS: Record<AppSurface, string> = {
  PUBLIC: "www.okesih.com",
  SUPERADMIN: "admin.okesih.com",
  OWNER: "owner.okesih.com",
  MARKETING: "sales.okesih.com",
  POS: "pos.okesih.com",
  KDS: "kds.okesih.com",
};

export const APP_ORIGINS: Record<AppSurface, string> = Object.fromEntries(
  Object.entries(APP_HOSTS).map(([surface, hostname]) => [surface, `https://${hostname}`]),
) as Record<AppSurface, string>;

export const APP_ENTRY_PATHS: Record<Exclude<AppSurface, "PUBLIC">, string> = {
  SUPERADMIN: "/superadmin",
  OWNER: "/owner",
  MARKETING: "/marketing/dashboard",
  POS: "/pos",
  KDS: "/kds",
};

const HOST_SURFACES = new Map<string, AppSurface>([
  ["okesih.com", "PUBLIC"],
  [APP_HOSTS.PUBLIC, "PUBLIC"],
  [APP_HOSTS.SUPERADMIN, "SUPERADMIN"],
  [APP_HOSTS.OWNER, "OWNER"],
  [APP_HOSTS.MARKETING, "MARKETING"],
  [APP_HOSTS.POS, "POS"],
  [APP_HOSTS.KDS, "KDS"],
]);

export function normalizeHostname(value: string | null | undefined) {
  return (value || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function surfaceForHostname(value: string | null | undefined): AppSurface | null {
  return HOST_SURFACES.get(normalizeHostname(value)) || null;
}

export function surfaceForPath(pathname: string): AppSurface {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "SUPERADMIN";
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) return "SUPERADMIN";
  if (pathname === "/owner" || pathname.startsWith("/owner/")) return "OWNER";
  if (pathname === "/marketing/dashboard" || pathname.startsWith("/marketing/dashboard/")) return "MARKETING";
  if (pathname === "/pos" || pathname.startsWith("/pos/")) return "POS";
  if (pathname === "/kds" || pathname.startsWith("/kds/")) return "KDS";
  return "PUBLIC";
}

export function surfaceForApiPath(pathname: string): AppSurface | null {
  if (pathname === "/api/superadmin" || pathname.startsWith("/api/superadmin/")) return "SUPERADMIN";
  if (pathname === "/api/owner" || pathname.startsWith("/api/owner/")) return "OWNER";
  if (pathname === "/api/device" || pathname.startsWith("/api/device/")) return null;
  if (pathname === "/api/marketing/dashboard" || pathname.startsWith("/api/marketing/dashboard/")) return "MARKETING";
  if (pathname === "/api/marketing/withdrawals" || pathname.startsWith("/api/marketing/withdrawals/")) return "MARKETING";
  return "PUBLIC";
}

export function isApiAllowedOnSurface(pathname: string, surface: AppSurface) {
  if (pathname === "/api/auth/handoff/start") return surface === "PUBLIC";
  if (pathname === "/api/auth/handoff/consume") return surface !== "PUBLIC";
  const requiredSurface = surfaceForApiPath(pathname);
  if (pathname === "/api/device" || pathname.startsWith("/api/device/")) {
    return surface === "POS" || surface === "KDS";
  }
  if (pathname === "/api/platform-settings") {
    return surface === "PUBLIC" || surface === "SUPERADMIN";
  }
  return requiredSurface === surface;
}

export function appUrl(surface: AppSurface, pathname = "") {
  const normalizedPath = pathname ? (pathname.startsWith("/") ? pathname : `/${pathname}`) : "";
  return `${APP_ORIGINS[surface]}${normalizedPath}`;
}

export function roleSurface(role: string | null | undefined): Exclude<AppSurface, "PUBLIC"> | null {
  switch (role?.toUpperCase()) {
    case "SUPERADMIN": return "SUPERADMIN";
    case "OWNER": return "OWNER";
    case "MARKETING": return "MARKETING";
    case "KASIR": return "POS";
    case "DAPUR": return "KDS";
    default: return null;
  }
}

export function roleHomeUrl(role: string | null | undefined) {
  const surface = roleSurface(role);
  return surface ? appUrl(surface, APP_ENTRY_PATHS[surface]) : appUrl("PUBLIC", "/login");
}
