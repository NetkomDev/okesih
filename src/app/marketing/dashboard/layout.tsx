import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard Marketing",
  applicationName: "OKESIH Marketing",
  manifest: "/manifest-marketing.webmanifest",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "OKESIH Marketing" },
};

export default function MarketingDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
