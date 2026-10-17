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

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Kasir OKESIH · Mode Cadangan Offline</title>
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
    <h1>Koneksi Kasir Terputus</h1>
    <p>Aplikasi kasir sedang offline atau koneksi internet tersendat. Silakan muat ulang saat jaringan stabil, atau buka kembali halaman kasir.</p>
    <div class="actions">
      <button class="btn-primary" onclick="window.location.reload()">Muat Ulang Kasir</button>
      <a class="btn-secondary" href="/pos">Buka Layar Kasir</a>
    </div>
    <div class="status-badge" id="online-status">Menunggu koneksi internet...</div>
  </div>
  <script>
    window.addEventListener("online", function() {
      var badge = document.getElementById("online-status");
      if (badge) {
        badge.innerText = "✓ Terhubung kembali! Memuat ulang...";
        badge.style.color = "#10b981";
      }
      setTimeout(function() { window.location.href = "/pos"; }, 600);
    });
  </script>
</body>
</html>`;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
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

// Tangkap semua unhandled error di Serwist agar browser TIDAK PERNAH menampilkan error "This page couldn't load"
serwist.setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate" || request.destination === "document") {
    const isPrivilegedOrigin = PRIVILEGED_HOSTS.has(new URL(request.url).hostname);
    if (isPrivilegedOrigin) {
      const offlineMatched = await caches.match("/~offline");
      if (offlineMatched) return offlineMatched;
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // 1. Coba cari di cache 'pages-navigation' untuk URL yang diminta
    const navCache = await caches.open("pages-navigation");
    const matched = await navCache.match(request);
    if (matched) return matched;

    // 2. Coba cari di cache untuk '/pos' atau URL tanpa query param
    const posMatched = await navCache.match("/pos");
    if (posMatched) return posMatched;

    // 3. Coba cari di cache bawaan
    const anyMatched = await caches.match(request);
    if (anyMatched) return anyMatched;

    const offlineMatched = await caches.match("/~offline");
    if (offlineMatched) return offlineMatched;

    // 4. Fallback mutlak: Sajikan halaman offline emergency dengan HTTP 200
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.error();
});

// Pre-warming cache untuk /pos dan /~offline saat service worker diinstal
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("pages-navigation").then(async (cache) => {
      try {
        await cache.addAll(["/~offline"]);
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
