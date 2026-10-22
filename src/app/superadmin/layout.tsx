import type { Metadata, Viewport } from "next";
import "@/styles/superadmin.css";

export const metadata: Metadata = { title: "OKESIH Super Admin", applicationName: "OKESIH Super Admin", manifest: "/manifest-superadmin.webmanifest", icons: { icon: "/logo.svg", apple: "/icons/apple-touch-icon.png" }, appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "OKESIH Admin" } };
export const viewport: Viewport = { themeColor: "#f4512c", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function SuperAdminLayout({children}:{children:React.ReactNode}) { return children; }
