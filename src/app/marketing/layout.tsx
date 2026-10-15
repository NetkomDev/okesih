import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OKESIH Marketing",
  applicationName: "Okesih.com",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Okesih.com",
  },
};

export default function MarketingRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
