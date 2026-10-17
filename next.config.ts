import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  // Registration and update listeners are owned by ServiceWorkerRegister.
  register: false,
  // Marketing artwork is fetched on demand, not by every POS/KDS install.
  globPublicPatterns: ["icons/**/*", "sound/**/*", "*.svg", "*.webmanifest"],
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/owner/billing": [
      "./node_modules/tesseract.js/src/worker-script/node/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/**/*",
    ],
  },
};

export default withSerwist(nextConfig);
