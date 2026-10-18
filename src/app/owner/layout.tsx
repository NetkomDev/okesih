import { OwnerProvider } from "@/components/owner/provider";
import OwnerShell from "@/components/owner/Shell";
import type { Metadata, Viewport } from "next";
import "@/styles/owner.css";
import "@/styles/owner-mobile.css";

export const metadata: Metadata = {
  title: "OKESIH Owner",
  manifest: "/manifest-owner.webmanifest",
  applicationName: "OKESIH Owner",
  icons: { icon: "/logo.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OKESIH Owner",
  },
};
export const viewport: Viewport = {
  themeColor: "#f4512c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OwnerProvider>
      <OwnerShell>{children}</OwnerShell>
    </OwnerProvider>
  );
}
