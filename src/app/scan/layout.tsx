import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Scanner Meja - OKESIH",
  description: "Pemindai QR Code Meja Kafe & Resto OKESIH",
  manifest: "/scan/manifest.webmanifest",
  applicationName: "OKESIH Scanner Meja",
  icons: { icon: "/logo.svg?v=2", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Scanner Meja", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
