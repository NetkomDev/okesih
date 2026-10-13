import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "OKESIH Kasir", manifest: "/manifest-pos.webmanifest", applicationName: "OKESIH Kasir" };
export const viewport: Viewport = { themeColor: "#f4512c", width: "device-width", initialScale: 1, maximumScale: 1 };
export default function PosLayout({ children }: { children: React.ReactNode }) { return children; }
