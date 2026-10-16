export const dynamic = "force-static";

export function GET() {
  return Response.json({
    id: "/pos",
    name: "OKESIH Kasir",
    short_name: "Kasir OKESIH",
    description: "Aplikasi kasir POS OKESIH untuk perangkat yang dipairing Owner.",
    start_url: "/pos?pwa=pos",
    scope: "/pos",
    display: "standalone",
    orientation: "landscape",
    background_color: "#f5f7fb",
    theme_color: "#f4512c",
    related_applications: [
      { platform: "webapp", url: "/pos/manifest.webmanifest", id: "/pos" },
    ],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=0, must-revalidate" } });
}
