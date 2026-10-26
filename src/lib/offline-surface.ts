import { surfaceForHostname, type AppSurface } from "@/lib/app-origins";
import { type PwaRoleKind } from "@/lib/pwa-routing";

export interface OfflineContextConfig {
  surface: AppSurface;
  badge: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  secondaryHref: string;
}

const OFFLINE_CONFIGS: Record<AppSurface, Omit<OfflineContextConfig, "surface">> = {
  SUPERADMIN: {
    badge: "SUPER ADMIN",
    title: "Koneksi Super Admin Terputus",
    description:
      "Koneksi internet perangkat Anda sedang terputus. Akses portal Super Admin memerlukan koneksi internet aktif demi keamanan akun, validasi hak akses, dan integritas data platform.",
    primaryAction: "Coba Sambungkan Ulang",
    secondaryAction: "Kembali ke Dashboard Super Admin",
    secondaryHref: "/superadmin",
  },
  OWNER: {
    badge: "DASHBOARD OWNER",
    title: "Koneksi Dashboard Terputus",
    description:
      "Koneksi internet perangkat Anda sedang terputus. Akses dashboard Owner memerlukan internet untuk memantau outlet, sinkronisasi laporan pendapatan, dan pengelolaan menu usaha.",
    primaryAction: "Coba Sambungkan Ulang",
    secondaryAction: "Kembali ke Dashboard Owner",
    secondaryHref: "/owner",
  },
  MARKETING: {
    badge: "PORTAL MITRA & KORMIT",
    title: "Koneksi Portal Mitra Terputus",
    description:
      "Koneksi internet perangkat Anda sedang terputus. Akses portal kemitraan memerlukan internet untuk memantau komisi, pencairan saldo, dan jaringan mitra binaan.",
    primaryAction: "Coba Sambungkan Ulang",
    secondaryAction: "Kembali ke Dashboard Mitra",
    secondaryHref: "/marketing/dashboard",
  },
  POS: {
    badge: "KASIR (POS)",
    title: "Koneksi Kasir Terputus",
    description:
      "Koneksi internet kasir sedang terputus. Tenang, pesanan kasir tetap tersimpan aman di database lokal dan akan disinkronkan otomatis saat sinyal kembali!",
    primaryAction: "Coba Sambungkan Ulang",
    secondaryAction: "Buka Layar Kasir (POS)",
    secondaryHref: "/pos",
  },
  KDS: {
    badge: "LAYAR DAPUR (KDS)",
    title: "Koneksi Layar Dapur Terputus",
    description:
      "Koneksi internet dapur sedang terputus. Pesanan yang telah disinkronkan tetap dapat dikerjakan oleh tim dapur dan barista.",
    primaryAction: "Coba Sambungkan Ulang",
    secondaryAction: "Buka Layar Dapur (KDS)",
    secondaryHref: "/kds",
  },
  PUBLIC: {
    badge: "OKESIH OFFLINE",
    title: "Koneksi Internet Terputus",
    description:
      "Koneksi internet perangkat Anda sedang terputus. Silakan periksa jaringan Wi-Fi atau paket data seluler perangkat Anda.",
    primaryAction: "Coba Sambungkan Ulang",
    secondaryAction: "Kembali ke Beranda",
    secondaryHref: "/",
  },
};

export function resolveOfflineContext(opts?: {
  hostname?: string | null;
  pathname?: string | null;
  referrer?: string | null;
  pwaKind?: PwaRoleKind | null;
}): OfflineContextConfig {
  const hostname = opts?.hostname || "";
  const pathname = opts?.pathname || "";
  const referrer = opts?.referrer || "";
  const pwaKind = opts?.pwaKind;

  // 1. Deteksi lewat hostname produksi resmi
  const surfaceByHost = surfaceForHostname(hostname);
  if (surfaceByHost && surfaceByHost !== "PUBLIC") {
    return { surface: surfaceByHost, ...OFFLINE_CONFIGS[surfaceByHost] };
  }

  // 2. Deteksi lewat PWA role terpasang (standalone storage/session)
  if (pwaKind) {
    const roleUpper = pwaKind.toUpperCase() as AppSurface;
    if (roleUpper in OFFLINE_CONFIGS) {
      return { surface: roleUpper, ...OFFLINE_CONFIGS[roleUpper] };
    }
  }

  // 3. Deteksi lewat pathname jika bukan /~offline
  if (pathname && pathname !== "/~offline") {
    if (/^\/(superadmin|admin)(\/|$)/.test(pathname)) {
      return { surface: "SUPERADMIN", ...OFFLINE_CONFIGS.SUPERADMIN };
    }
    if (/^\/owner(\/|$)/.test(pathname)) {
      return { surface: "OWNER", ...OFFLINE_CONFIGS.OWNER };
    }
    if (/^\/marketing(\/|$)/.test(pathname)) {
      return { surface: "MARKETING", ...OFFLINE_CONFIGS.MARKETING };
    }
    if (/^\/pos(\/|$)/.test(pathname)) {
      return { surface: "POS", ...OFFLINE_CONFIGS.POS };
    }
    if (/^\/kds(\/|$)/.test(pathname)) {
      return { surface: "KDS", ...OFFLINE_CONFIGS.KDS };
    }
  }

  // 4. Deteksi lewat referrer halaman sebelumnya
  if (referrer) {
    try {
      const refUrl = new URL(referrer);
      const refSurface = surfaceForHostname(refUrl.hostname);
      if (refSurface && refSurface !== "PUBLIC") {
        return { surface: refSurface, ...OFFLINE_CONFIGS[refSurface] };
      }
      if (/^\/(superadmin|admin)(\/|$)/.test(refUrl.pathname)) {
        return { surface: "SUPERADMIN", ...OFFLINE_CONFIGS.SUPERADMIN };
      }
      if (/^\/owner(\/|$)/.test(refUrl.pathname)) {
        return { surface: "OWNER", ...OFFLINE_CONFIGS.OWNER };
      }
      if (/^\/marketing(\/|$)/.test(refUrl.pathname)) {
        return { surface: "MARKETING", ...OFFLINE_CONFIGS.MARKETING };
      }
      if (/^\/pos(\/|$)/.test(refUrl.pathname)) {
        return { surface: "POS", ...OFFLINE_CONFIGS.POS };
      }
      if (/^\/kds(\/|$)/.test(refUrl.pathname)) {
        return { surface: "KDS", ...OFFLINE_CONFIGS.KDS };
      }
    } catch {}
  }

  return { surface: "PUBLIC", ...OFFLINE_CONFIGS.PUBLIC };
}
