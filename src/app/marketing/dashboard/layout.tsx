import type { Metadata } from "next";
import { MarketingProvider } from "./MarketingContext";
import MarketingBottomNav from "./MarketingBottomNav";
import MarketingSyncIndicator from "./MarketingSyncIndicator";

export const metadata: Metadata = {
  title: "Dashboard Marketing",
  applicationName: "Okesih.com",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Okesih.com" },
};

export default function MarketingDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingProvider>
      {children}
      <MarketingSyncIndicator />
      <MarketingBottomNav />
    </MarketingProvider>
  );
}
