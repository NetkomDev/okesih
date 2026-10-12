import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://okesih.vercel.app"),
  title: {
    default: "OKESIH - Platform Kasir & Operasional Kafe & Resto",
    template: "%s | OKESIH POS & Operasional Usaha",
  },
  description:
    "Software POS Kasir Offline-First, Kitchen Display (KDS), QR Menu Meja, dan Antrean Smart TV untuk Kafe, Rumah Makan, Resto, dan Warkop. Tanpa beli alat mahal, bayar sewa hanya Rp 50 per transaksi.",
  keywords: [
    "aplikasi kasir",
    "pos kasir warkop",
    "pos kafe dan resto",
    "software kasir offline",
    "qr menu meja",
    "kds dapur restoran",
    "antrean smart tv",
    "pos kasir hemat",
    "aplikasi f&b indonesia",
    "sistem kasir rp 50 per struk",
  ],
  authors: [{ name: "OKESIH Team" }],
  creator: "PT OKESIH KARYA DIGITAL",
  publisher: "OKESIH.COM",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "OKESIH - Aplikasi Kasir POS & Self-Order Cerdas untuk Segala Usaha Kuliner",
    description:
      "Pesanan ngalir cepat, usaha bebas macet! POS Kasir Offline-First, KDS Dapur, QR Menu Meja, dan Antrean TV. Cocok untuk Kafe, Rumah Makan, Resto & Warkop. Hanya Rp 50/struk.",
    url: "https://okesih.vercel.app",
    siteName: "OKESIH.COM",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OKESIH - Aplikasi Kasir POS & Antrean Cerdas untuk Kafe, Resto & Warkop",
    description:
      "Tingkatkan kecepatan pesanan dan omzet usaha kuliner Anda dengan POS Offline-First dan QR Menu Meja. Cukup pakai HP sendiri, hanya Rp 50/struk.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://okesih.vercel.app",
  },
  applicationName: "OKESIH",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OKESIH",
  },
  icons: {
    icon: [{ url: "/favicon.svg?v=2", type: "image/svg+xml" }],
    shortcut: "/favicon.svg?v=2",
    apple: "/logo.svg?v=2",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF4500",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/logo.svg?v=2" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("okesih-theme");var p=s||(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",p);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
