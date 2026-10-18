# Modularisasi dan Pemisahan Komponen Dashboard

## Cakupan Perubahan

Pemisahan Client Component besar dan isolasi pengambilan data dashboard sesuai rekomendasi audit performa P1:

### 1. Dashboard Superadmin (`src/app/superadmin/page.tsx` & `src/components/superadmin/`)
- Baseline: Komponen monolitik 4.316 baris yang memuat data seluruh tab sejak awal startup.
- Sesudah:
  - `src/app/superadmin/page.tsx`: Shell ramping dengan lazy loading tab (`Overview`, `Tenants`, `Marketing`, `Billing`, `Settings`).
  - Data tab hanya dimuat on-demand ketika tab aktif dibuka atau tombol aksi (seperti registrasi tenant/marketing) ditekan.
  - Startup awal hanya mengambil ringkasan analitik global (`/api/superadmin/analytics`) untuk header dan metrik overview tanpa mengambil ribuan baris data tenant atau marketing.
  - State filter, pencarian, dan modal terisolasi di dalam komponen fitur masing-masing (`Tenants.tsx`, `Marketing.tsx`, `Billing.tsx`, `Settings.tsx`).

### 2. Dashboard Owner (`src/app/owner/` & `src/components/owner/`)
- Baseline: Komponen monolitik 2.128 baris yang di-reexport oleh semua submenu URL owner (`/owner/menu`, `/owner/staff`, dll).
- Sesudah:
  - Layout (`src/app/owner/layout.tsx`) dan `Shell.tsx` memegang shell navigasi, profil tenant, dan status onboarding secara persisten antar route tanpa memuat ulang layout shell.
  - Setiap subroute memiliki route page tersendiri yang memuat modul fiturnya:
    - `/owner`: `Overview.tsx` (metrik omzet harian & grafik pendapatan).
    - `/owner/menu`: `Menu.tsx` (katalog menu, status ketersediaan, kategori).
    - `/owner/staff`: `Staff.tsx` (daftar akun kasir/dapur, shift).
    - `/owner/waiters`: `Waiters.tsx` (daftar waiter).
    - `/owner/qris-tables`: `QrisTables.tsx` (pengaturan meja, QR meja, cetak stiker meja dengan dynamic import pustaka QR).
    - `/owner/devices`: `Devices.tsx` (daftar perangkat kasir/KDS terpasang).
    - `/owner/pin`: `Pin.tsx` (pengaturan PIN audit kasir).
  - Endpoint data dipisahkan per fitur (`/api/owner/profile`, `/api/owner/menus`, `/api/owner/staff`, `/api/owner/tables`, `/api/owner/waiters`, dll) sehingga navigasi ke menu tidak memicu request data staf atau perangkat.

### 3. POS Kasir (`src/app/pos/page.tsx` & `src/components/pos/`)
- Baseline: Komponen kasir 1.561 baris yang mencampur logika pesanan aktif, keranjang, input PIN audit, dan tabel riwayat transaksi.
- Sesudah:
  - Modal verifikasi PIN audit diekstrak ke `AuditPinModal.tsx` yang dimuat secara dinamis saat kasir membuka histori transaksi.
  - Tabel dan filter histori diekstrak ke `History.tsx` (terisolasi dari render cycle keranjang kasir).
  - Layar kasir pesanan aktif tetap responsif tanpa overhead state histori.

## Validasi
- **TypeScript**: `npx tsc --noEmit` lulus tanpa error (exit code 0).
- **ESLint**: 0 error, 23 warning (hanya peringatan `@next/next/no-img-element` bawaan).
- **Test suite**:
  - `npm run test:pwa`: 14/14 tests pass.
  - `npm run test:reporting`: 5/5 tests pass.
- **Produksi**: `npm run build` sukses (66 static/dynamic routes terbundle, service worker Serwist terkompilasi, scan secret bersih).
