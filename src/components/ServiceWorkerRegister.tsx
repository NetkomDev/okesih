"use client";

import { useEffect } from "react";

/**
 * Service Worker Registrasi untuk PWA OKESIH & Mode Offline
 * Memastikan /sw.js aktif di browser/tablet/PC kasir sehingga PWA
 * dapat berjalan dalam mode standalone, menerima cache offline,
 * dan menangkap event instalasi browser secara optimal.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Jangan daftarkan service worker di mode development localhost untuk menghindari cache stale dev
    if (process.env.NODE_ENV === "development") return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Cek update service worker secara berkala jika ada rilis baru
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener("statechange", () => {
              if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Versi baru siap
                console.log("[OKESIH PWA] Konten baru tersedia. Siap digunakan.");
              }
            });
          }
        });
      } catch (err) {
        console.warn("[OKESIH PWA] Gagal mendaftarkan Service Worker:", err);
      }
    };

    if (document.readyState === "complete") {
      void registerSW();
    } else {
      window.addEventListener("load", registerSW, { once: true });
    }
  }, []);

  return null;
}
