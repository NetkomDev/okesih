import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "OKESIH Super Admin", applicationName: "Okesih.com", manifest: "/manifest.webmanifest", icons: { icon: "/logo.svg", apple: "/icons/apple-touch-icon.png" }, appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Okesih.com" } };
export const viewport: Viewport = { themeColor: "#f4512c", width: "device-width", initialScale: 1 };
export default function SuperAdminLayout({children}:{children:React.ReactNode}) { return children; }
