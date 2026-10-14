import type { Metadata } from "next";
import { MarketingProvider } from "./MarketingContext";

export const metadata: Metadata = {
  title: "Dashboard Marketing",
  applicationName: "OKESIH Marketing",
  manifest: "/manifest-marketing.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "OKESIH Marketing" },
};

export default function MarketingDashboardLayout({ children }: { children: React.ReactNode }) {
  return <MarketingProvider>{children}</MarketingProvider>;
}
