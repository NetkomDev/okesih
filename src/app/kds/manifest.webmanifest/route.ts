export const dynamic = "force-static";

export function GET() {
  return Response.json({
    id: "/kds",
    name: "OKESIH Dapur KDS",
    short_name: "Dapur OKESIH",
    description: "Layar antrean pesanan dapur (KDS) OKESIH untuk koki dan barista.",
    start_url: "/kds?pwa=kds",
    scope: "/kds",
    display: "standalone",
    orientation: "landscape",
    background_color: "#0f172a",
    theme_color: "#1e293b",
    icons: [
      { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=0, must-revalidate" } });
}
