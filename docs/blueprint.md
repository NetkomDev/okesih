# BLUEPRINT SISTEM APLIKASI WARKOP: OKESIH.COM

**Versi:** 3.0 (Terintegrasi Infrastruktur & Pembaruan UI/UX Visual)
**Repositori Utama:** <https://github.com/NetkomDev/okesih.git>

## 1. RINGKASAN EKSEKUTIF

* **Nama Produk:** OKESIH.COM
* **Konsep:** Ekosistem manajemen pesanan warkop berkecepatan tinggi (*high-throughput*) dengan fitur KDS (*Kitchen Display System*) dan *Queue Management*.
* **Model Bisnis:** Micro-SaaS (Software as a Service) B2B. Skema sewa per-transaksi (Pay-per-transaction, misal: Rp 50/struk).
* **Metode Penagihan:** Setoran harian via QRIS Statis di akhir shift, diverifikasi otomatis oleh sistem OCR (*Optical Character Recognition*) dari *screenshot* bukti transfer.
* **Pendekatan Hardware:** BYOD (Bring Your Own Device). Warkop menyediakan tablet, HP, dan Smart TV mereka sendiri.

## 2. INFRASTRUKTUR & ENVIRONMENT (TECH STACK)

Sistem menggunakan arsitektur **Progressive Web App (PWA)** terpisah (Frontend) yang terkoneksi langsung ke **Backend-as-a-Service (BaaS)** menggunakan Supabase. Aplikasi di-*hosting* secara *serverless* menggunakan Vercel dengan *pipeline* CI/CD terhubung ke GitHub.

### A. Environment Variables (Konfigurasi Utama)

Berikut adalah parameter konfigurasi yang wajib dimasukkan ke dalam *Environment Variables* di Vercel (`.env`):

* **Hosting/Deployment:** Vercel (Auto-deploy dari *branch* `main` di GitHub Repo)
* **Database & Auth (BaaS):** Supabase
  * `NEXT_PUBLIC_SUPABASE_URL`: `https://[PROJECT_ID].supabase.co`
  * `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `[REDACTED_ANON_PUBLIC_KEY]`
  * `SUPABASE_SERVICE_ROLE_KEY` *(Hanya untuk sisi Server/Edge Functions, JANGAN di-expose ke frontend)*: `[REDACTED_SERVER_SERVICE_ROLE_KEY]`
  * `SUPABASE_SECRET_API_KEY`: `[REDACTED_SECRET_API_KEY]`

### B. Arsitektur Komponen

* **Frontend Framework:** Next.js (App Router, TypeScript) dengan dukungan PWA (manifest & Serwist Service Workers).
* **Offline Database (Lokal):** Dexie.js (berjalan di atas IndexedDB *browser* kasir). Menyimpan data transaksi sementara saat internet mati, lalu di-*sync* ke PostgreSQL Supabase saat *online*.
* **Real-time Engine:** Supabase Realtime (menggunakan WebSockets). Mengirim pesanan dari Kasir langsung ke KDS Dapur dan Layar TV.
* **OCR Engine:** Tesseract.js dijalankan di sisi *client* untuk preview cepat dan divalidasi oleh endpoint server-side untuk memverifikasi gambar *screenshot* bukti transfer QRIS.

## 3. MODUL APLIKASI (EKOSISTEM OKESIH)

Keseluruhan sistem dibagi menjadi 5 modul UI. Secara struktur di Vercel, ini berupa 1 *project Next.js* dengan sistem *Routing* berbasis hak akses dan profil warkop:

1. **Modul Kasir (POS) - `/pos`:** PWA *Offline-First* di tablet/HP kasir. UI kotak besar untuk *tap-tap* cepat. Mendukung koneksi *Bluetooth Thermal Printer* (Web Bluetooth API).
2. **Modul Dapur (KDS) - `/kds`:** PWA di tablet/monitor dapur. Menggunakan **Supabase Realtime** untuk menerima pesanan baru instan. Pesanan memiliki indikator warna SLA.
3. **Modul Antrean (Queue TV) - `/tv`:** PWA untuk Smart TV. Menampilkan nomor antrean (Diproses vs Siap) dengan integrasi pemanggil Web Speech API (TTS) dan audio fallback.
4. **Modul Pelanggan (QR Menu) - `/menu/[warkopId]`:** Katalog digital yang mem-fetch data dari Supabase. Pelanggan memilih menu dan menghasilkan *Barcode/QR Pesanan* untuk di-*scan* di kasir.
5. **Modul Superadmin - `/admin`:** Dashboard manajemen pusat (hak akses divalidasi server-side).

## 4. ALUR KERJA OPERASIONAL LENGKAP (END-TO-END WORKFLOW)

### A. Fase Onboarding (Pendaftaran)
1. Admin OKESIH mendaftarkan warkop baru di modul Superadmin (membuat *Tenant ID* di Supabase).
2. Sistem mengalokasikan **Rentang Kode Unik QRIS permanen** untuk warkop tersebut (Misal Warkop A selalu `100-199`, Warkop B `200-299`).
3. Admin mengatur *Menu*, *Harga*, dan batasan *Timer Offline* (misal: 4 jam).
4. Pemilik warkop men-generate akun staf (username dan password kasir/dapur).
5. Staf membuka URL POS, KDS, dan TV di perangkat masing-masing, login dengan username + password, lalu menekan "Add to Homescreen" (Install PWA).

### B. Fase Operasional (High-Throughput harian)
1. **Pemesanan:** Pelanggan memesan via QR Menu di meja atau langsung ke Kasir.
2. **Input Kasir:** Kasir menekan pesanan di tablet dan menekan tombol "BAYAR".
3. **Proses Data:**
   * Data pesanan di-INSERT ke tabel `transactions` di Supabase.
   * Jika *offline*, data masuk ke IndexedDB lokal (Dexie).
   * Sistem menghitung penambahan tagihan sewa SaaS (+Rp 50 per transaksi).
4. **Real-time Distribusi:** Supabase Realtime men-*trigger* `INSERT` *event*, membuat layar KDS (Dapur) memunculkan pesanan tersebut dalam waktu < 1 detik.
5. **Penyelesaian:** Dapur menekan tombol "Selesai" di layar KDS. Supabase meng-UPDATE status transaksi menjadi `READY`.
6. **Pemanggilan:** Perubahan status men-*trigger* Modul TV Antrean untuk memindahkan nomor ke kolom "SIAP DIAMBIL" dan membunyikan suara robot *"OKESIH, Nomor 12 silakan diambil"*.

### C. Fase Penagihan Otomatis (Tutup Shift & OCR)
1. **Tutup Toko:** Kasir menekan tombol "Tutup Shift". PWA POS mengecek `navigator.onLine`. (Wajib *online* untuk tutup shift).
2. **Kalkulasi Database:** Server menghitung total tagihan warkop hari ini dari Supabase lewat prosedur aman (misal: 250 transaksi x Rp 50 = Rp 12.500).
3. **Generate Tagihan:**
   * Sistem mengambil angka acak dari rentang kode unik warkop tersebut (Misal: `145`).
   * Total Wajib Transfer: **Rp 12.645**.
   * Layar menampilkan QRIS Statis OKESIH. **Layar POS terkunci (Disable actions)**.
4. **Bayar & Upload:** Kasir transfer via M-Banking, lalu unggah *screenshot* ke PWA.
5. **Verifikasi OCR (Tesseract.js & Server Validation):**
   * Gambar dikonversi menjadi teks (ekstraksi nominal & tanggal).
   * *Regex Rule:* Mencari string nominal unik (mengabaikan titik/koma) dan mencocokkan tanggal struk dengan hari ini.
   * Jika **LULUS**: Update status Supabase menjadi `PAID`. Layar kasir terbuka (*Unlock*), shift harian di-*reset*, dan cetak *Z-Report* (Laporan Harian).
   * Jika **GAGAL/BURAM**: Kasir menekan tombol "Bantuan Admin". Status menjadi `PENDING_REVIEW`. Layar terbuka sementara (tenggang 12 jam) agar kasir bisa pulang, sementara Admin memvalidasi manual di *Dashboard*.

## 5. SKEMA DATABASE (SUPABASE POSTGRESQL) - MULTI-TENANT

Desain tabel utama di Supabase dengan Row Level Security (RLS) berbasis `warkop_id`:

* `warkops`: Menyimpan data klien (`id`, `nama`, `slug`, `unique_code_range_start`, `unique_code_range_end`, `offline_limit_hours`, `is_active`).
* `warkop_members`: Relasi pengguna Auth ke warkop (`id`, `warkop_id`, `user_id`, `username`, `role` [OWNER, KASIR, DAPUR, TV]).
* `menus`: Katalog produk (`id`, `warkop_id`, `nama`, `harga`, `kategori`, `is_available`).
* `shifts`: Sesi kerja kasir (`id`, `warkop_id`, `opened_by`, `opened_at`, `closed_at`, `status` [OPEN, CLOSED]).
* `transactions`: Data penjualan per bon (`id`, `warkop_id`, `shift_id`, `nomor_antrean`, `total_harga`, `status_pesanan` [NEW, COOKING, READY, DONE, VOID], `created_at`, `synced_at`).
* `transaction_items`: Detail menu yang dibeli di dalam satu bon (`id`, `transaction_id`, `menu_id`, `nama_menu`, `harga_satuan`, `qty`, `notes`).
* `saas_billings`: Data tagihan warkop ke OKESIH (`id`, `warkop_id`, `tanggal`, `total_transactions`, `tagihan_pokok`, `kode_unik`, `total_tagihan`, `status_bayar` [UNPAID, PAID, PENDING_REVIEW], `bukti_transfer_url`, `ocr_raw_text`, `grace_until`).

## 6. SISTEM KEAMANAN & ANTI-FRAUD (KILL-SWITCH)

1. **Timer Toleransi Offline (Supabase Sync Guard):**
   * Ketika koneksi hilang, *timer* dihitung mundur dari batas `offline_limit_hours` warkop.
   * Jika *timer* habis, PWA POS menampilkan *overlay* hitam *full-screen* dengan tulisan *"OKESIH Butuh Sinyal! Sambungkan internet untuk sinkronisasi data"*.
2. **No Dapur No Masak:** Dapur memproses berdasarkan tiket di layar KDS. Pesanan di KDS hanya muncul jika kasir menginputnya ke sistem.
3. **Audit Pembatalan (Void Fraud):** Transaksi berstatus `VOID` tetap dihitung dalam `total_transactions` di tabel `saas_billings`.
4. **No Exit (Lock-in Harian):** Begitu "Tutup Shift" ditekan, fungsi routing dan Database Trigger mengunci pembuatan transaksi baru sebelum tagihan lunas atau dalam masa tenggang review.

## 7. BRANDING & UI/UX (DESAIN VISUAL)

Tema desain visual OKESIH menggunakan pendekatan **modern, energik, dan minimalis**:
* **Warna Utama (Dominan): Oranye Kemerahan Hangat (`#FF4500` / `#FF5722`)**
* **Warna Aksen & Kontras: Hitam Pekat (`#0D0D0E` / `#141416`)**
* **Warna Penyeimbang: Putih Bersih (`#FFFFFF` / `#F8F9FA`)**
* **Karakter Visual:** Modern digital product feel, bentuk lengkung halus, high-contrast readability untuk tablet & smart TV.
* **Tone of Voice:** Santai dan akrab (*"Pesanan lagi digarap. Tunggu dipanggil, ya!"*).
