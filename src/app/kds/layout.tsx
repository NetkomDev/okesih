import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "OKESIH Dapur KDS", manifest: "/manifest-kds.webmanifest", applicationName: "OKESIH KDS", appleWebApp: { capable: true, title: "OKESIH KDS" } };
export const viewport: Viewport = { themeColor: "#f59e0b", width: "device-width", initialScale: 1, maximumScale: 1 };
export default function KdsLayout({ children }: { children: React.ReactNode }) { return children; }
