import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    default: "OKESIH - Aplikasi Kasir POS & Self-Order untuk Warung, Kafe, Resto & Warkop",
    template: "%s | OKESIH POS & Operasional Usaha",
  },
  description:
    "Software POS Kasir Offline-First, Kitchen Display (KDS), QR Menu Meja, dan Antrean Smart TV untuk Warung Makan, Kafe, Rumah Makan, Resto, dan Warkop. Tanpa beli alat mahal, bayar sewa hanya Rp 50 per transaksi.",
  keywords: [
    "aplikasi kasir",
    "pos kasir warkop",
    "aplikasi kasir warung makan",
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
      "Pesanan ngalir cepat, usaha bebas macet! POS Kasir Offline-First, KDS Dapur, QR Menu Meja, dan Antrean TV. Cocok untuk Warung, Kafe, Rumah Makan, & Warkop. Hanya Rp 50/struk.",
    url: "https://okesih.vercel.app",
    siteName: "OKESIH.COM",
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OKESIH - Aplikasi Kasir POS & Antrean Cerdas untuk Warung, Kafe & Resto",
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
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
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
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
