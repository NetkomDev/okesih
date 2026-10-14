import type { MetadataRoute } from "next";

export default function dashboardManifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "OKESIH POS",
    short_name: "OKESIH POS",
    description: "Sistem POS Kasir, Kitchen Display, dan Antrean TV untuk Warkop Berkecepatan Tinggi",
    start_url: "/login",
    scope: "/login",
    display: "standalone",
    orientation: "any",
    background_color: "#0D0D0E",
    theme_color: "#FF4500",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Kasir (POS)",
        url: "/pos",
        description: "Buka Modul Kasir POS",
      },
      {
        name: "Dapur (KDS)",
        url: "/kds",
        description: "Buka Modul Kitchen Display System",
      },
      {
        name: "Antrean TV",
        url: "/tv",
        description: "Buka Layar Antrean Smart TV",
      },
      {
        name: "Dashboard Admin",
        url: "/login",
        description: "Buka Dashboard Manajemen Warkop",
      },
    ],
  };
}
