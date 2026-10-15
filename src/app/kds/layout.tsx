import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "OKESIH Dapur KDS", manifest: "/manifest.webmanifest", applicationName: "Okesih.com", icons: { icon: "/logo.svg", apple: "/icons/apple-touch-icon.png" }, appleWebApp: { capable: true, title: "Okesih.com" } };
export const viewport: Viewport = { themeColor: "#f59e0b", width: "device-width", initialScale: 1, maximumScale: 1 };
export default function KdsLayout({ children }: { children: React.ReactNode }) { return children; }
