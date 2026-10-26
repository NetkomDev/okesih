/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const PRIVILEGED_HOSTS = new Set(["admin.okesih.com", "owner.okesih.com", "sales.okesih.com"]);

/**
 * Filter manifest precache per origin:
 * - POS/KDS tidak mem-precache chunk superadmin/owner/marketing untuk menghemat storage dan bandwidth.
 * - Tetap mempertahankan 100% chunk core, CSS, fonts, audio, dan layout yang dibutuhkan untuk offline.
 */
function filterPrecacheByOrigin(manifest: (PrecacheEntry | string)[] | undefined): (PrecacheEntry | string)[] | undefined {
  if (!manifest || !Array.isArray(manifest)) return manifest;

  const hostname = self.location.hostname;
  const isPos = hostname === "pos.okesih.com";
  const isKds = hostname === "kds.okesih.com";
  const isPrivileged = PRIVILEGED_HOSTS.has(hostname);
  const isPublic = hostname === "okesih.com" || hostname === "www.okesih.com";

  // Pada localhost / preview vercel: pertahankan seluruh manifest agar preview terpadu tetap lengkap
  if (!isPos && !isKds && !isPrivileged && !isPublic) {
    return manifest;
  }

  return manifest.filter((entry) => {
    const url = typeof entry === "string" ? entry : entry.url;

    // Aset inti framework, CSS, media, audio, icons: selalu di-cache untuk semua surface
    const isCore =
      url.includes("/framework-") ||
      url.includes("/main-") ||
      url.includes("/main-app-") ||
      url.includes("/webpack-") ||
      url.includes("/polyfills-") ||
      url.startsWith("/_next/static/css/") ||
      url.startsWith("/_next/static/media/") ||
      url.startsWith("/sound/") ||
      url.startsWith("/icons/") ||
      url === "/favicon.svg" ||
      url === "/logo.svg" ||
      url.includes("/app/layout-") ||
      url.includes("/app/~offline/") ||
      url.includes("/components/builtin/");

    if (isCore) return true;

    if (isPos) {
      if (url.includes("/app/pos/")) return true;
      if (url === "/manifest-pos.webmanifest") return true;
      // Jangan simpan chunk fitur lain di perangkat kasir
      if (
        url.includes("/app/superadmin/") ||
        url.includes("/app/owner/") ||
        url.includes("/app/marketing/") ||
        url.includes("/app/kds/") ||
        url.includes("/app/tv/") ||
        url.includes("/app/menu/") ||
        url.includes("/manifest-")
      ) {
        return false;
      }
      return true;
    }

    if (isKds) {
      if (url.includes("/app/kds/")) return true;
      if (url === "/manifest-kds.webmanifest") return true;
      // Jangan simpan chunk fitur lain di layar dapur
      if (
        url.includes("/app/superadmin/") ||
        url.includes("/app/owner/") ||
        url.includes("/app/marketing/") ||
        url.includes("/app/pos/") ||
        url.includes("/app/tv/") ||
        url.includes("/app/menu/") ||
        url.includes("/manifest-")
      ) {
        return false;
      }
      return true;
    }

    if (isPrivileged) {
      // Dashboard sensitif tidak disimpan offline secara permanen
      if (url.includes("/app/superadmin/") || url.includes("/app/owner/") || url.includes("/app/marketing/")) {
        return false;
      }
      return true;
    }

    if (isPublic) {
      if (
        url.includes("/app/superadmin/") ||
        url.includes("/app/owner/") ||
        url.includes("/app/pos/") ||
        url.includes("/app/kds/")
      ) {
        return false;
      }
      return true;
    }

    return true;
  });
}

function createOfflineCard(config: {
  title: string;
  desc: string;
  primaryActionLabel: string;
  primaryActionUrl?: string;
  secondaryActionLabel?: string;
  secondaryActionUrl?: string;
  badgeText: string;
  reloadTarget: string;
}): string {
  const primaryOnClick = config.primaryActionUrl
    ? `window.location.href='${config.primaryActionUrl}'`
    : `window.location.reload()`;

  const secondaryBtn = config.secondaryActionLabel && config.secondaryActionUrl
    ? `<a class="btn-secondary" href="${config.secondaryActionUrl}">${config.secondaryActionLabel}</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>${config.title} · OKESIH</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0b1018;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 20px;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #151d2a;
      border: 1px solid rgba(244, 81, 44, 0.3);
      border-radius: 20px;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      border-radius: 16px;
      background: rgba(244, 81, 44, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
      letter-spacing: -0.01em;
    }
    p {
      font-size: 13.5px;
      line-height: 1.55;
      color: #94a3b8;
      margin-bottom: 24px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    button, a {
      display: block;
      width: 100%;
      padding: 13px 18px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
      transition: opacity 0.15s ease;
    }
    .btn-primary {
      background: linear-gradient(135deg, #f4512c 0%, #ea580c 100%);
      color: #ffffff;
      border: 0;
      box-shadow: 0 4px 14px rgba(244, 81, 44, 0.35);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-primary:active, .btn-secondary:active { opacity: 0.85; }
    .status-badge {
      display: inline-block;
      margin-top: 18px;
      font-size: 11px;
      font-weight: 700;
      color: #f97316;
      background: rgba(249, 115, 22, 0.1);
      padding: 4px 10px;
      border-radius: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📶</div>
    <h1>${config.title}</h1>
    <p>${config.desc}</p>
    <div class="actions">
      <button class="btn-primary" onclick="${primaryOnClick}">${config.primaryActionLabel}</button>
      ${secondaryBtn}
    </div>
    <div class="status-badge" id="online-status">${config.badgeText}</div>
  </div>
  <script>
    window.addEventListener("online", function() {
      var badge = document.getElementById("online-status");
      if (badge) {
        badge.innerText = "✓ Terhubung kembali! Memuat ulang...";
        badge.style.color = "#10b981";
      }
      setTimeout(function() { window.location.href = "${config.reloadTarget}"; }, 600);
    });
  </script>
</body>
</html>`;
}

function getOfflineHtml(surface: "POS" | "KDS" | "PRIVILEGED" | "PUBLIC", pathname: string): string {
  if (surface === "POS") {
    return createOfflineCard({
      title: "Koneksi Kasir Terputus",
      desc: "Aplikasi kasir sedang offline atau koneksi internet tersendat. Perangkat tetap dapat beroperasi dengan batas offline yang aktif.",
      primaryActionLabel: "Muat Ulang Kasir",
      secondaryActionLabel: "Buka Layar Kasir",
      secondaryActionUrl: "/pos",
      badgeText: "Mode Offline Kasir Aktif",
      reloadTarget: "/pos",
    });
  }

  if (surface === "KDS") {
    return createOfflineCard({
      title: "Koneksi Layar Dapur Terputus",
      desc: "Layar dapur (KDS) sedang offline atau koneksi internet tersendat. Pesanan yang telah disinkronkan tetap dapat dikerjakan.",
      primaryActionLabel: "Muat Ulang Dapur",
      secondaryActionLabel: "Buka Layar Dapur",
      secondaryActionUrl: "/kds",
      badgeText: "Mode Offline Dapur Aktif",
      reloadTarget: "/kds",
    });
  }

  if (surface === "PRIVILEGED") {
    const isSuperAdmin = pathname.startsWith("/admin") || pathname.startsWith("/superadmin") || self.location.hostname === "admin.okesih.com";
    const isOwner = pathname.startsWith("/owner") || self.location.hostname === "owner.okesih.com";
    const isMarketing = pathname.startsWith("/marketing") || self.location.hostname === "sales.okesih.com";

    if (isSuperAdmin) {
      return createOfflineCard({
        title: "Koneksi Super Admin Terputus",
        desc: "Akses portal Super Admin memerlukan koneksi internet aktif demi keamanan akun, validasi hak akses, dan integritas data platform.",
        primaryActionLabel: "Coba Sambungkan Kembali",
        secondaryActionLabel: "Kembali ke Dashboard Super Admin",
        secondaryActionUrl: "/superadmin",
        badgeText: "Memerlukan Internet",
        reloadTarget: pathname,
      });
    }

    if (isOwner) {
      return createOfflineCard({
        title: "Koneksi Dashboard Owner Terputus",
        desc: "Akses dashboard Owner memerlukan koneksi internet untuk memantau outlet, sinkronisasi laporan pendapatan, dan pengelolaan menu usaha.",
        primaryActionLabel: "Coba Sambungkan Kembali",
        secondaryActionLabel: "Kembali ke Dashboard Owner",
        secondaryActionUrl: "/owner",
        badgeText: "Memerlukan Internet",
        reloadTarget: pathname,
      });
    }

    if (isMarketing) {
      return createOfflineCard({
        title: "Koneksi Portal Mitra Terputus",
        desc: "Akses portal kemitraan memerlukan internet untuk memantau komisi, pencairan saldo, dan jaringan mitra binaan.",
        primaryActionLabel: "Coba Sambungkan Kembali",
        secondaryActionLabel: "Kembali ke Dashboard Mitra",
        secondaryActionUrl: "/marketing/dashboard",
        badgeText: "Memerlukan Internet",
        reloadTarget: pathname,
      });
    }

    return createOfflineCard({
      title: "Koneksi Dashboard Terputus",
      desc: "Akses dashboard pengelolaan memerlukan koneksi internet stabil demi keamanan dan integritas data platform.",
      primaryActionLabel: "Coba Sambungkan Kembali",
      secondaryActionLabel: "Kembali ke Beranda",
      secondaryActionUrl: "/",
      badgeText: "Memerlukan Internet",
      reloadTarget: pathname,
    });
  }

  return createOfflineCard({
    title: "Koneksi Internet Terputus",
    desc: "Halaman tidak dapat dimuat karena perangkat Anda sedang tidak terhubung ke internet. Periksa koneksi data atau Wi-Fi Anda.",
    primaryActionLabel: "Coba Muat Ulang",
    secondaryActionLabel: "Buka Beranda",
    secondaryActionUrl: "/",
    badgeText: "Menunggu koneksi internet...",
    reloadTarget: pathname,
  });
}

const filteredManifest = filterPrecacheByOrigin(self.__SW_MANIFEST);

const serwist = new Serwist({
  precacheEntries: filteredManifest,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Dashboard berautentikasi tidak disimpan sebagai dokumen offline agar
    // halaman sensitif tidak dapat dibuka dari cache setelah sesi berakhir.
    {
      matcher: ({ request, url }) => request.mode === "navigate" && PRIVILEGED_HOSTS.has(url.hostname),
      handler: new NetworkOnly({ networkTimeoutSeconds: 15 }),
    },
    // 1. Dokumen navigasi publik dan aplikasi perangkat (POS/KDS).
    // Menggunakan NetworkFirst dengan timeout cepat (4 detik) agar PWA instan fallback ke cache offline jika offline/lambat
    {
      matcher: ({ request, url }) => request.mode === "navigate" && !PRIVILEGED_HOSTS.has(url.hostname),
      handler: new NetworkFirst({
        cacheName: "pages-navigation",
        networkTimeoutSeconds: 4,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 40,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 hari simpan cache navigasi shell
          }),
        ],
      }),
    },
    // 2. Bypass API Device & Supabase Auth ke NetworkOnly
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnly({ networkTimeoutSeconds: 15 }),
    },
    // 3. Cache bawaan Serwist untuk script, CSS, fonts, dan images
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document" || request.mode === "navigate";
        },
      },
    ],
  },
});

// Tangkap semua unhandled error di Serwist dengan pemisahan fallback sesuai surface
serwist.setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate" || request.destination === "document") {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const hostname = url.hostname;

    const isPos = hostname === "pos.okesih.com" || pathname.startsWith("/pos");
    const isKds = hostname === "kds.okesih.com" || pathname.startsWith("/kds");
    const isPrivileged =
      PRIVILEGED_HOSTS.has(hostname) ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/superadmin") ||
      pathname.startsWith("/owner") ||
      pathname.startsWith("/marketing");

    const surfaceKind: "POS" | "KDS" | "PRIVILEGED" | "PUBLIC" = isPos
      ? "POS"
      : isKds
        ? "KDS"
        : isPrivileged
          ? "PRIVILEGED"
          : "PUBLIC";

    // 1. Dashboard sensitif tidak pernah disajikan dari cache kadaluwarsa
    if (isPrivileged) {
      const offlineMatched = await caches.match("/~offline");
      if (offlineMatched) return offlineMatched;
      return new Response(getOfflineHtml("PRIVILEGED", pathname), {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // 2. Coba cari di cache 'pages-navigation' untuk URL yang diminta persis
    const navCache = await caches.open("pages-navigation");
    const matched = await navCache.match(request);
    if (matched) return matched;

    // 3. Fallback cache KHUSUS SESUAI SURFACE (POS hanya fallback ke /pos, KDS hanya ke /kds, publik TIDAK PERNAH ke /pos)
    if (isPos) {
      const posMatched = await navCache.match("/pos");
      if (posMatched) return posMatched;
    } else if (isKds) {
      const kdsMatched = await navCache.match("/kds");
      if (kdsMatched) return kdsMatched;
    }

    // 4. Coba cari di cache bawaan untuk request tersebut
    const anyMatched = await caches.match(request);
    if (anyMatched) return anyMatched;

    const offlineMatched = await caches.match("/~offline");
    if (offlineMatched) return offlineMatched;

    // 5. Fallback darurat: sajikan dokumen offline sesuai surface (bukan halaman kasir untuk semua rute)
    return new Response(getOfflineHtml(surfaceKind, pathname), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.error();
});

// Pre-warming cache sesuai surface saat service worker diinstal
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("pages-navigation").then(async (cache) => {
      try {
        const hostname = self.location.hostname;
        const prewarmUrls = ["/~offline"];
        if (hostname === "pos.okesih.com") {
          prewarmUrls.push("/pos");
        } else if (hostname === "kds.okesih.com") {
          prewarmUrls.push("/kds");
        }
        await cache.addAll(prewarmUrls);
      } catch {
        // Abaikan jika saat install sedang offline
      }
    })
  );
});

// Listener untuk pesan SKIP_WAITING dari client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

serwist.addEventListeners();

