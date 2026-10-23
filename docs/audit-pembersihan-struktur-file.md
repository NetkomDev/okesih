# Audit pembersihan struktur file OKESIH.COM

Tanggal: 23 Oktober 2026. Audit lanjutan memeriksa source, aset publik, skrip, migrasi, dokumentasi, konfigurasi, dependensi, dan artefak lokal. File Next.js berbasis konvensi (page, route, layout, error, icon, favicon, proxy) diperiksa sebagai entry point, bukan dinilai dari jumlah import saja.

## Pembersihan source dan dependensi

| File/dependensi yang dihapus | Bukti dan pengganti aktif |
|---|---|
| `src/components/PwaLaunchBoundary.tsx` | Tidak diimpor. Implementasi lama memaksa dashboard ke login ketika resume; alur aktif memakai autentikasi route, StandaloneLauncher, dan PwaBackExitGuard. |
| `isDashboardLaunch` di `src/lib/pwa-routing.ts` | Hanya dipakai komponen lama di atas dan tesnya. Helper serta asersi khususnya ikut dihapus. |
| `src/components/CashierPinGate.tsx` | Tidak diimpor. POS aktif memakai CashierShiftGate dengan sesi kasir dan kepemilikan shift. |
| `src/components/cashier-pin.css` dan `src/lib/device-pin.ts` | Hanya mendukung komponen PIN lokal yang tidak aktif. Dua tes helper lama ikut dihapus. PIN keamanan Owner dan PIN audit kasir tetap dipakai. |
| `public/icons/icon-192.png` dan `public/icons/icon-512.png` | Tidak dirujuk source atau manifest aktif; semua manifest memakai pwa-192.png/pwa-512.png. |
| Dependensi langsung `@serwist/sw` | Tidak diimpor; service worker memakai serwist dan @serwist/next/worker. Paket @serwist/next tidak bergantung pada paket ini. |
| Dependensi dev langsung `pngjs` versi 7 | Tidak digunakan source, skrip, atau konfigurasi. pngjs versi 5 sebagai dependensi qrcode tetap dipertahankan oleh npm. |

`package.json` dan lockfile diselaraskan melalui npm uninstall. Panduan `docs/pwa-launch.md` diperbarui karena sebelumnya masih menjelaskan redirect login, manifest bersama, dan PIN lokal yang sudah tidak berlaku. Penelusuran import terhadap 213 file TS/TSX/CSS setelah pembersihan tidak menemukan modul tanpa pemanggil di luar entry point framework.

## Artefak lokal

Sebanyak 875,23 MiB artefak lokal dihapus. Setelah validasi, cache `.next/`, `tsconfig.tsbuildinfo`, dan service worker hasil build `public/sw.js` dibersihkan. Artefak tersebut dibuat ulang saat menjalankan build; untuk menjalankan `npm start` setelah pembersihan, jalankan `npm run build` terlebih dahulu. Tidak ada salinan `.bak` atau folder karantina dibuat di proyek. Hasil tes sementara disimpan di luar folder aplikasi.

Pembersihan sebelumnya (commit afca4ad) telah menghapus cache eksperimen WhatsApp, stub blueprint root, print-table-stickers.ts yang tidak digunakan, direktori types kosong, dan metadata .DS_Store. Audit ini tidak mengklaim menghapus ulang berkas tersebut.

## File yang tetap diperlukan

- `.env.local`, konfigurasi proyek Supabase lokal, `.git`, dan node_modules: konfigurasi, riwayat, serta dependensi pengembangan aktif.
- Seluruh migrasi 01–34, fixtures, CI, skrip uji konkurensi, OCR, dan seed: digunakan untuk rekonstruksi database, operasi, atau validasi, meski bukan import runtime.
- Manifest POS/KDS statis: kompatibilitas URL instalasi terdahulu.
- logo.svg dan favicon.svg mempunyai isi identik, tetapi kedua URL masih dirujuk. Ikon/favikon di src/app juga merupakan metadata otomatis Next.js.
- Laporan audit historis tetap menjadi catatan kondisi pada tanggal audit; bukan spesifikasi runtime saat ini.

## Validasi

`npm run check` memeriksa lint, seluruh tes, build produksi, dan secret pada bundle client. Hasil: 85 tes lulus (dua tes helper PIN lokal usang dihapus), lint 0 error dengan 18 warning yang sudah ada, build 77 halaman lulus, dan 146 file client lolos pemeriksaan secret. Build lokal mencatat fetch platform_settings gagal dalam lingkungan terbatas, tetapi proses selesai exit 0. Pemeriksaan referensi ulang tidak menemukan import kode atau manifest aktif menuju file yang dihapus.

Working tree bersih setelah commit bukan bukti bahwa cache build tidak ada; kebersihan artefak lokal diperiksa terpisah setelah build. Cache akan muncul kembali ketika aplikasi dikembangkan/dibangun. Riwayat Git tidak ditulis ulang.
