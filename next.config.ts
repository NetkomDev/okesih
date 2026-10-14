import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/superadmin/login",
        destination: "/login?from_pwa=superadmin",
      },
      {
        source: "/owner/login",
        destination: "/login?from_pwa=owner",
      },
      {
        source: "/marketing/login",
        destination: "/login?from_pwa=marketing",
      },
      {
        source: "/pos/login",
        destination: "/login?from_pwa=pos",
      },
      {
        source: "/kds/login",
        destination: "/login?from_pwa=kds",
      },
    ];
  },
};

export default withSerwist(nextConfig);
