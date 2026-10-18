import type { Metadata, Viewport } from "next";
import "@/styles/pos.css";

export const metadata: Metadata = { title: "OKESIH Kasir", manifest: "/pos/manifest.webmanifest", applicationName: "OKESIH Kasir", icons: { icon: "/logo.svg", apple: "/icons/apple-touch-icon.png" }, appleWebApp: { capable: true, title: "OKESIH Kasir" } };
export const viewport: Viewport = { themeColor: "#f4512c", width: "device-width", initialScale: 1, maximumScale: 1 };
export default function PosLayout({ children }: { children: React.ReactNode }) { return children; }
