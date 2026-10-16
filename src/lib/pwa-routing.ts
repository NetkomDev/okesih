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
    name: "Okesih.com",
    shortName: "Okesih.com",
    description: "Platform Ekosistem Digital & Manajemen Bisnis OKESIH",
    allowedRoles: ["SUPERADMIN"],
    startUrl: "/login",
    scope: "/",
    manifest: "/manifest.webmanifest",
    themeColor: "#f4512c",
  },
  owner: {
    kind: "owner",
    name: "Okesih.com",
    shortName: "Okesih.com",
    description: "Platform Ekosistem Digital & Manajemen Bisnis OKESIH",
    allowedRoles: ["OWNER"],
    startUrl: "/login",
    scope: "/",
    manifest: "/manifest.webmanifest",
    themeColor: "#f4512c",
  },
  marketing: {
    kind: "marketing",
    name: "Okesih.com",
    shortName: "Okesih.com",
    description: "Platform Ekosistem Digital & Manajemen Bisnis OKESIH",
    allowedRoles: ["MARKETING"],
    startUrl: "/login",
    scope: "/",
    manifest: "/manifest.webmanifest",
    themeColor: "#f4512c",
  },
  pos: {
    kind: "pos",
    name: "OKESIH Kasir",
    shortName: "Kasir OKESIH",
    description: "Aplikasi kasir POS OKESIH untuk perangkat yang dipairing Owner.",
    allowedRoles: ["KASIR"],
    startUrl: "/pos?pwa=pos",
    scope: "/pos",
    manifest: "/pos/manifest.webmanifest",
    themeColor: "#f4512c",
  },
  kds: {
    kind: "kds",
    name: "OKESIH Dapur KDS",
    shortName: "Dapur OKESIH",
    description: "Layar antrean pesanan dapur (KDS) OKESIH untuk koki dan barista.",
    allowedRoles: ["DAPUR"],
    startUrl: "/kds?pwa=kds",
    scope: "/kds",
    manifest: "/kds/manifest.webmanifest",
    themeColor: "#1e293b",
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
const STANDALONE_PWA_KEY = "okesih_installed_pwa_role";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

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
      if (isStandaloneApp()) {
        try {
          localStorage.setItem(STANDALONE_PWA_KEY, validKind);
          setCookie("okesih_pwa", validKind);
        } catch {}
      }
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

  // 3. Jika sedang berjalan di standalone mode (aplikasi PWA yang sudah terpasang)
  if (isStandaloneApp()) {
    // 3a. Cek localStorage identitas PWA
    try {
      const localStored = localStorage.getItem(STANDALONE_PWA_KEY) as PwaRoleKind | null;
      if (localStored && (localStored in PWA_ROLE_CONFIGS)) {
        return localStored;
      }
    } catch {}

    // 3b. Cek cookie fallback
    try {
      const cookieStored = getCookie("okesih_pwa") as PwaRoleKind | null;
      if (cookieStored && (cookieStored in PWA_ROLE_CONFIGS)) {
        return cookieStored;
      }
    } catch {}

    // 3c. Simpulkan dari pathname saat ini
    const path = window.location.pathname;
    let inferred: PwaRoleKind | null = null;
    if (/^\/superadmin(\/|$)/.test(path)) inferred = "superadmin";
    else if (/^\/owner(\/|$)/.test(path)) inferred = "owner";
    else if (/^\/marketing(\/|$)/.test(path)) inferred = "marketing";
    else if (/^\/pos(\/|$)/.test(path)) inferred = "pos";
    else if (/^\/kds(\/|$)/.test(path)) inferred = "kds";

    if (inferred) {
      try {
        localStorage.setItem(STANDALONE_PWA_KEY, inferred);
        setCookie("okesih_pwa", inferred);
      } catch {}
      return inferred;
    }
  }

  return null;
}

/**
 * Set PWA aktif secara manual ke sessionStorage dan standalone storage.
 */
export function setActivePwaKind(kind: PwaRoleKind) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_ACTIVE_PWA_KEY, kind);
    localStorage.setItem(STANDALONE_PWA_KEY, kind);
    setCookie("okesih_pwa", kind);
  } catch {}
}

/**
 * Hapus penanda PWA aktif.
 */
export function clearActivePwaKind() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_ACTIVE_PWA_KEY);
    if (!isStandaloneApp()) {
      localStorage.removeItem(STANDALONE_PWA_KEY);
      document.cookie = "okesih_pwa=; path=/; max-age=0";
    }
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
