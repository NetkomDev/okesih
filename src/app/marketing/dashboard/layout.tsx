import type { Metadata } from "next";
import { MarketingProvider } from "./MarketingContext";

export const metadata: Metadata = {
  title: "Dashboard Marketing",
  applicationName: "Okesih.com",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Okesih.com" },
};

export default function MarketingDashboardLayout({ children }: { children: React.ReactNode }) {
  return <MarketingProvider>{children}</MarketingProvider>;
}
