import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "OKESIH Super Admin", applicationName: "OKESIH Super Admin", manifest: "/manifest-superadmin.webmanifest", appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "OKESIH HQ" } };
export const viewport: Viewport = { themeColor: "#f4512c", width: "device-width", initialScale: 1 };
export default function SuperAdminLayout({children}:{children:React.ReactNode}) { return children; }
