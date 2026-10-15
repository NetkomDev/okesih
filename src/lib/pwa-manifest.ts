import type { MetadataRoute } from "next";

export default function dashboardManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Okesih.com",
    short_name: "Okesih.com",
    description: "Platform Ekosistem Digital & Manajemen Bisnis OKESIH",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b1018",
    theme_color: "#f4512c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
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
        name: "Login OKESIH",
        url: "/login",
        description: "Masuk ke Akun OKESIH",
      },
    ],
  };
}
