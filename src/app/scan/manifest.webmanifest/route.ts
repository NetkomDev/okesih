export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      id: "/scan",
      name: "OKESIH Scanner Meja",
      short_name: "Scanner Meja",
      description: "Aplikasi Scanner QR Meja Kafe & Resto OKESIH",
      start_url: "/scan",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#0a0a0c",
      theme_color: "#f4512c",
      related_applications: [
        { platform: "webapp", url: "/scan/manifest.webmanifest", id: "/scan" },
      ],
      prefer_related_applications: false,
      icons: [
        { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    }
  );
}
