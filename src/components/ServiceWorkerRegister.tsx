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

    // Jangan daftarkan service worker di mode development localhost
    if (process.env.NODE_ENV === "development") return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Jika ada service worker baru yang sedang menunggu, suruh dia segera aktif
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        // Cek update service worker secara berkala jika ada rilis baru
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener("statechange", () => {
              if (installingWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  // Versi baru siap - pemicu skip waiting
                  installingWorker.postMessage({ type: "SKIP_WAITING" });
                  console.log("[OKESIH PWA] Pembaruan aplikasi kasir siap diterapkan.");
                } else {
                  console.log("[OKESIH PWA] Konten offline kasir berhasil di-cache.");
                }
              }
            });
          }
        });

        // Trigger update otomatis saat online kembali
        const handleOnline = () => {
          void registration.update().catch(() => {});
        };
        window.addEventListener("online", handleOnline);

        // Periksa update setiap 15 menit
        const intervalId = window.setInterval(() => {
          void registration.update().catch(() => {});
        }, 15 * 60 * 1000);

        return () => {
          window.removeEventListener("online", handleOnline);
          window.clearInterval(intervalId);
        };
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
