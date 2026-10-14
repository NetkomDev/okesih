export type InstallationKind = "POS" | "KDS" | "OWNER" | "MARKETING" | "SUPERADMIN" | "DASHBOARD";
export type PwaRoleKind = "superadmin" | "owner" | "marketing" | "pos" | "kds";

export interface PwaRoleMeta {
  kind: PwaRoleKind;
  name: string;
  shortName: string;
  description: string;
  allowedRoles: string[];
  startUrl: string;
  scope: string;
  manifest: string;
  themeColor: string;
}

export const PWA_ROLE_CONFIGS: Record<PwaRoleKind, PwaRoleMeta> = {
  superadmin: {
    kind: "superadmin",
    name: "OKESIH Super Admin",
    shortName: "OKESIH HQ",
    description: "Command Center Super Admin OKESIH",
    allowedRoles: ["SUPERADMIN"],
    startUrl: "/superadmin?pwa=superadmin",
    scope: "/",
    manifest: "/manifest-superadmin.webmanifest",
    themeColor: "#f4512c",
  },
  owner: {
    kind: "owner",
    name: "OKESIH Owner",
    shortName: "OKESIH Owner",
    description: "Dashboard Pengelolaan Usaha & Omset Tenant",
    allowedRoles: ["OWNER"],
    startUrl: "/owner?pwa=owner",
    scope: "/",
    manifest: "/manifest-owner.webmanifest",
    themeColor: "#f4512c",
  },
  marketing: {
    kind: "marketing",
    name: "OKESIH Marketing",
    shortName: "OKESIH Marketing",
    description: "Dashboard Mitra Marketing & Pendaftaran Tenant",
    allowedRoles: ["MARKETING"],
    startUrl: "/marketing/dashboard?pwa=marketing",
    scope: "/",
    manifest: "/manifest-marketing.webmanifest",
    themeColor: "#0f766e",
  },
  pos: {
    kind: "pos",
    name: "OKESIH Kasir",
    shortName: "OKESIH KASIR",
    description: "Kasir POS Tenant OKESIH",
    allowedRoles: ["KASIR"],
    startUrl: "/pos?pwa=pos",
    scope: "/",
    manifest: "/manifest-pos.webmanifest",
    themeColor: "#f4512c",
  },
  kds: {
    kind: "kds",
    name: "OKESIH KDS",
    shortName: "OKESIH KDS",
    description: "Kitchen Display System Dapur Resto",
    allowedRoles: ["DAPUR"],
    startUrl: "/kds?pwa=kds",
    scope: "/",
    manifest: "/manifest-kds.webmanifest",
    themeColor: "#f59e0b",
  },
};

export function installationKind(path: string): InstallationKind {
  if (/^\/pos(\/|$)/.test(path)) return "POS";
  if (/^\/kds(\/|$)/.test(path)) return "KDS";
  if (/^\/owner(\/|$)/.test(path)) return "OWNER";
  if (/^\/marketing(\/|$)/.test(path)) return "MARKETING";
  if (/^\/superadmin(\/|$)/.test(path)) return "SUPERADMIN";
  return "DASHBOARD";
}

export function isDashboardLaunch(path: string) {
  return path === "/" || /^\/(owner|superadmin|marketing|admin)(\/|$)/.test(path);
}

/**
 * Cek apakah halaman dibuka di dalam mode standalone PWA (terinstal).
 */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

const STORAGE_ACTIVE_PWA_KEY = "okesih_active_pwa";

/**
 * Deteksi PWA mana yang sedang aktif dijalankan (dari query param, storage, atau path standalone).
 */
export function detectActivePwaKind(): PwaRoleKind | null {
  if (typeof window === "undefined") return null;

  // 1. Cek query param ?pwa=... atau ?from_pwa=...
  try {
    const params = new URLSearchParams(window.location.search);
    const pwaParam = (params.get("pwa") || params.get("from_pwa") || "").toLowerCase().trim();
    if (pwaParam && (pwaParam in PWA_ROLE_CONFIGS)) {
      const validKind = pwaParam as PwaRoleKind;
      sessionStorage.setItem(STORAGE_ACTIVE_PWA_KEY, validKind);
      return validKind;
    }
  } catch {}

  // 2. Cek sessionStorage (tersimpan dari launch sebelumnya pada session yang sama)
  try {
    const stored = sessionStorage.getItem(STORAGE_ACTIVE_PWA_KEY) as PwaRoleKind | null;
    if (stored && (stored in PWA_ROLE_CONFIGS)) {
      return stored;
    }
  } catch {}

  // 3. Jika sedang berjalan di standalone mode, simpulkan dari pathname
  if (isStandaloneApp()) {
    const path = window.location.pathname;
    if (/^\/superadmin(\/|$)/.test(path)) return "superadmin";
    if (/^\/owner(\/|$)/.test(path)) return "owner";
    if (/^\/marketing(\/|$)/.test(path)) return "marketing";
    if (/^\/pos(\/|$)/.test(path)) return "pos";
    if (/^\/kds(\/|$)/.test(path)) return "kds";
  }

  return null;
}

/**
 * Set PWA aktif secara manual ke sessionStorage.
 */
export function setActivePwaKind(kind: PwaRoleKind) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_ACTIVE_PWA_KEY, kind);
  } catch {}
}

/**
 * Hapus penanda PWA aktif.
 */
export function clearActivePwaKind() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_ACTIVE_PWA_KEY);
  } catch {}
}

/**
 * Validasi apakah role akun pengguna diizinkan untuk mengakses PWA tertentu.
 */
export function isRoleAllowedForPwa(role: string | null | undefined, pwaKind: PwaRoleKind): boolean {
  if (!role) return false;
  const config = PWA_ROLE_CONFIGS[pwaKind];
  if (!config) return false;
  return config.allowedRoles.includes(role.toUpperCase());
}

/**
 * Format nama peran yang ramah dan mudah dipahami pengguna.
 */
export function getRoleDisplayName(role: string | null | undefined): string {
  if (!role) return "Tidak Dikenal";
  const r = role.toUpperCase();
  switch (r) {
    case "SUPERADMIN":
      return "Super Admin";
    case "OWNER":
      return "Owner Tenant";
    case "MARKETING":
      return "Marketing";
    case "KASIR":
      return "Kasir";
    case "DAPUR":
      return "Dapur / KDS";
    default:
      return role;
  }
}
