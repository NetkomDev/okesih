# Pemisahan CSS dan Arsitektur Rendering Halaman Publik (P2)

## Cakupan dan Perubahan

Tindak lanjut dari temuan audit performa P2 pada bagian **CSS dan render halaman publik**:

### 1. Pemisahan Modular Stylesheet (`src/app/globals.css`)
- **Baseline**: 
  - `globals.css` monolitik berukuran 235.025 byte (7.179 baris) dimuat di seluruh halaman aplikasi via root layout, sehingga pengunjung landing page atau perangkat kasir POS mobile harus mengunduh ratusan kilobyte aturan CSS yang tidak digunakan.
- **Pemisahan**:
  - `src/styles/superadmin.css` (862 baris / ~31 KB): Seluruh aturan `.superadmin-*` dan sidebar peek/collapsed dipindahkan khusus untuk Command Center Superadmin (`src/app/superadmin/layout.tsx`).
  - `src/styles/owner.css` (1.754 baris / ~57 KB): Seluruh aturan `.owner-*`, `.ow-*`, sticker meja, dan hero siluet dipindahkan khusus untuk Portal Owner (`src/app/owner/layout.tsx`).
  - `src/styles/kds.css` (821 baris / ~28 KB): Seluruh aturan KDS dapur dipindahkan khusus untuk Kitchen Display System (`src/app/kds/layout.tsx`).
  - `src/styles/pos.css` (2.694 baris / ~71 KB): Seluruh aturan Kasir POS, pipeline pesanan, tiket dapur, PIN audit, dan riwayat transaksi kasir dipindahkan khusus untuk aplikasi POS (`src/app/pos/layout.tsx`).
  - `src/app/globals.css` (1.050 baris / ~48 KB): Turun sebesar 79% (dari 7.179 baris menjadi 1.050 baris), hanya mempertahankan design tokens `:root`, reset global, token tema terang (`[data-theme="light"]`), tombol dasar, utility toast/mismatch, serta customer self-order QR menu.

### 2. Arsitektur Server Components & Client Islands Halaman Publik
- **Landing Page (`src/app/page.tsx`)**:
  - Baseline: Monolitik Client Component (`"use client"`) 1.557 baris.
  - Hasil: Diubah menjadi **Server Component** murni. Seluruh konten presentasi (Hero, Solusi Usaha, Modul Fitur, Keunggulan, Skema Sewa, Kemitraan, Closing CTA, Footer) langsung di-render sebagai HTML statis dari server, memaksimalkan SEO dan First Contentful Paint (FCP).
  - Client Islands terisolasi:
    - `src/components/landing/LandingHeader.tsx`: Navbar desktop, drawer mobile, ThemeToggle, dan pemicu login.
    - `src/components/landing/LoginModal.tsx`: Dialog modal autentikasi mandiri dengan dukungan auto-open error URL, `#login`, dan tombol ESC.
    - `src/components/landing/LoginTriggerButton.tsx`: Tombol interaktif untuk memicu modal login.
    - `src/components/landing/FaqAccordion.tsx`: Accordion interaktif untuk pertanyaan FAQ.
    - `src/components/landing/MobileBottomBar.tsx`: Floating action bar di mobile.
- **Halaman Kemitraan Marketing (`src/app/marketing/page.tsx`)**:
  - Baseline: Client Component 962 baris.
  - Hasil: Diubah menjadi **Server Component**.
  - Client Islands terisolasi:
    - `src/components/marketing/MarketingHeader.tsx`: Header dengan tombol Beranda dan ThemeToggle.
    - `src/components/marketing/CommissionCalculator.tsx`: Kalkulator simulasi komisi (slider tenant aktif, rata-rata transaksi, estimasi pendapatan bulanan).
    - `src/components/marketing/MarketingFaq.tsx`: Accordion FAQ khusus mitra marketing.

### 3. Optimasi Gambar dan Logo
- Tag logo `<img>` pada header dan footer telah diperbarui menggunakan `next/image` (`<Image />`) dengan dimensi eksplisit (`width`, `height`, dan `priority` untuk above-the-fold) guna mencegah Cumulative Layout Shift (CLS) dan menghemat bandwidth transfer.

## Hasil Validasi
1. **TypeScript Typecheck**: `npx tsc --noEmit` lulus (Exit code: 0).
2. **ESLint**: `npm run lint` 0 error.
3. **PWA Suite**: `npm run test:pwa` 14/14 tests pass.
4. **Reporting Suite**: `npm run test:reporting` 5/5 tests pass.
5. **Uji Visual Multi-Resolusi**:
   - Browser headless Chrome pada lebar 360px (mobile), 768px (tablet), dan 1280px (desktop) pada mode gelap (`dark`) dan mode terang (`light`) seluruhnya lulus tanpa runtime error.
6. **Produksi Next.js**: `npm run build` sukses 66/66 routes terkompilasi, Serwist service worker ter-bundle, dan scanning token rahasia bersih.
