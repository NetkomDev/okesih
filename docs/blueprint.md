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
4. **Modul Pelanggan (QR Menu Meja) - `/menu/[warkopId]?table=[no_meja]`:** Katalog digital interaktif per meja bernomor. Pelanggan memilih menu, melihat QRIS milik warkop, dan mengunggah screenshot bukti pembayaran langsung dari meja tanpa harus antre di kasir.
5. **Modul Superadmin - `/admin`:** Dashboard manajemen pusat (hak akses divalidasi server-side), termasuk pengaturan durasi auto-dismiss antrean TV dan manajemen tenant.

## 4. ALUR KERJA OPERASIONAL LENGKAP (END-TO-END WORKFLOW)

### A. Fase Onboarding (Pendaftaran)
1. Admin OKESIH mendaftarkan warkop baru di modul Superadmin (membuat *Tenant ID* di Supabase).
2. Sistem mengalokasikan **Rentang Kode Unik QRIS permanen** untuk penagihan sewa warkop tersebut (Misal Warkop A selalu `100-199`, Warkop B `200-299`).
3. Admin mengatur *Menu*, *Harga*, batas *Timer Offline* (misal: 4 jam), dan durasi **Auto-Dismiss Antrean TV** (misal: 60 detik).
4. Pemilik warkop mengunggah QRIS Statis toko mereka dan men-generate akun staf (username dan password kasir/dapur/barista).
5. Pemilik mencetak QR Code meja bernomor (`/menu/[id_warkop]?table=01`, `table=02`, dst.) dan menempelkannya di setiap meja warkop.
6. Staf membuka URL POS, KDS, dan TV di perangkat masing-masing, login dengan username + password, lalu menekan "Add to Homescreen" (Install PWA).

### B. Fase Operasional (High-Throughput Pesanan Meja Pelanggan)
1. **Pilih Meja & Scan QR:** Pelanggan duduk di meja dan memindai QR Code di meja tersebut menggunakan smartphone mereka. Sistem membuka halaman menu dengan nomor meja terkunci otomatis.
2. **Pilih Pesanan & Bayar Mandiri:** Pelanggan memilih minuman/makanan, menekan checkout, dan melihat nominal total serta gambar **QRIS Statis Toko/Warkop**.
   * *Catatan Keuangan:* QRIS ini 100% milik owner warkop, sehingga perputaran uang pesanan pelanggan langsung masuk ke rekening warkop (bukan ke sistem OKESIH).
3. **Upload Bukti Pembayaran:** Pelanggan mentransfer via M-Banking / e-Wallet, lalu mengunggah screenshot bukti transfer di halaman checkout dan menekan tombol **"Kirim Pesanan"**.
4. **Notifikasi & Alarm Kasir Berdering Keras:**
   * Pesanan masuk ke tabel `transactions` dengan status `AWAITING_CONFIRMATION`.
   * PWA Kasir (`/pos`) mendeteksi pesanan meja baru via Supabase Realtime.
   * **Alarm aplikasi kasir berdering keras secara berulang (audio chime / siren loop)** untuk memastikan kasir segera merespons tiket meja masuk.
5. **Konfirmasi Kasir (Audit Bukti Pembayaran):**
   * Kasir membuka tiket pesanan di POS, memeriksa rincian menu dan gambar screenshot bukti transfer pelanggan.
   * Kasir mencocokkan dana dengan mutasi QRIS warkopnya.
   * Jika **VALID**: Kasir menekan tombol **"Konfirmasi Pembayaran (Lunas)"**. Status pesanan berubah menjadi `COOKING` (masuk antrean dapur). Alarm kasir otomatis berhenti. Sistem mencatat penambahan tagihan sewa SaaS (+Rp 50/struk).
   * Jika **PALSU/INVALID**: Kasir menekan tombol **"Tolak Pesanan"** (status `REJECTED`, alarm berhenti, pesanan dibatalkan).
6. **Masuk Antrean Dapur/Barista (KDS):** Begitu dikonfirmasi kasir, tiket pesanan seketika muncul di layar KDS (`/kds`) menampilkan Nomor Antrean, **Nomor Meja Pemesan**, dan rincian menu.
7. **Barista Meracik & Klik Selesai:** Barista meracik minuman/makanan. Setelah siap, barista menekan tombol **"Selesai"** di layar KDS. Status pesanan di Supabase ter-UPDATE menjadi `READY`.
8. **Waiters Mengantar ke Meja:** Waiters melihat tiket `READY` dengan keterangan Nomor Meja yang jelas (misal: "Meja #05"), lalu mengantarkan pesanan langsung ke meja pemesan.
9. **Antrean TV Berubah Hijau & Panggilan Suara:**
   * Di Layar Antrean Smart TV (`/tv`), nomor antrean dan nomor meja berpindah ke kolom **"SIAP DIAMBIL / DIANTAR"** dengan warna latar **HIJAU** (`#10B981`).
   * Sistem membunyikan suara robot otomatis (TTS): *"Pesanan Nomor 12 untuk Meja 5 siap diantar"*.
10. **Auto-Dismiss (Menghilang Otomatis):**
    * Setelah berubah hijau, tiket antrean akan bertahan selama durasi yang ditentukan oleh **Super Admin Pusat** (parameter `queue_dismiss_seconds`, default: 60 detik).
    * Setelah timer habis, tiket antrean otomatis memudar dan menghilang dari layar TV dan KDS.
11. **Selesai:** Seluruh siklus pesanan meja berhasil dituntaskan dengan cepat dan tertib.

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
