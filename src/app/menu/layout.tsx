import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/scan/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Scanner Meja", statusBarStyle: "black-translucent" },
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
