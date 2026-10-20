import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mitra OKESIH",
  applicationName: "Mitra Okesih",
  manifest: "/manifest-marketing.webmanifest",
  icons: {
    icon: "/logo.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mitra Okesih",
  },
};

export default function MarketingRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
