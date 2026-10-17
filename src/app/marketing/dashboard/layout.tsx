import type { Metadata } from "next";
import { MarketingProvider } from "./MarketingContext";
import MarketingBottomNav from "./MarketingBottomNav";
import MarketingSyncIndicator from "./MarketingSyncIndicator";

export const metadata: Metadata = {
  title: "Dashboard Marketing",
  applicationName: "OKESIH Sales",
  manifest: "/manifest-marketing.webmanifest",
  icons: {
    icon: "/logo.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "OKESIH Sales" },
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
