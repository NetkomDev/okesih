import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "OKESIH Owner", manifest: "/manifest.webmanifest", applicationName: "OKESIH POS" };
export const viewport: Viewport = { themeColor: "#f4512c", width: "device-width", initialScale: 1 };
export default function OwnerLayout({ children }: { children: React.ReactNode }) { return children; }
