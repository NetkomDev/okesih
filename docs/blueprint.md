# BLUEPRINT SISTEM APLIKASI WARKOP: OKESIH.COM

**Versi:** 4.0 (Multi-PWA, Device Trust, Offline Sync & Zero-Repeated-Login)
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
6. Owner menyelesaikan onboarding login pertama, mengganti password awal, lalu memasang PWA Owner melalui prompt instalasi resmi browser.
7. Tablet Kasir dan layar Dapur/KDS tidak memakai kredensial Owner. Masing-masing perangkat membuka halaman pairing, menampilkan kode sekali pakai, lalu disetujui Owner dari Dashboard.
8. Setelah pairing disetujui, server menerbitkan kredensial perangkat berhak akses minimum. Perangkat menawarkan instalasi PWA khusus Kasir atau KDS dan dapat dibuka kembali tanpa login berulang selama belum kedaluwarsa atau dicabut Owner.

### B. Fase Operasional (High-Throughput Pesanan Meja, Dual Pembayaran, & SOP Waiters)
1. **Pilih Meja & Scan QR:** Pelanggan duduk di meja dan memindai QR Code meja bernomor (`/menu/[id_warkop]?table=05`). Sistem otomatis mengunci nomor meja.
2. **Pilih Pesanan & Pilihan Metode Pembayaran:**
   * **Opsi A - QRIS Warkop (Bayar Sekarang):** Pelanggan scan gambar QRIS Statis warkop di layar HP, transfer via m-banking/e-wallet, lalu mengunggah screenshot bukti transfer. (Uang 100% langsung masuk ke rekening owner warkop).
   * **Opsi B - BAYAR TUNAI (Cash di Meja):** Pelanggan memilih bayar tunai. Tidak perlu upload gambar. Layar menginstruksikan pelanggan untuk menyiapkan uang tunai pas saat pesanan diantar oleh Waiters/Pelayan.
3. **Notifikasi & Alarm Kasir Berdering Keras:**
   * Pesanan masuk ke tabel `transactions` dengan status `AWAITING_CONFIRMATION` dan tanda metode bayar (`QRIS` atau `TUNAI`).
   * PWA Kasir (`/pos`) mendeteksi pesanan meja baru via Realtime dan **alarm audio berdering keras secara berulang** sampai kasir merespons.
4. **Konfirmasi Kasir & Cetak Struk Fisik Khusus Waiters:**
   * Kasir membuka tiket pesanan di POS.
   * Jika **QRIS**: Kasir memverifikasi screenshot transfer pelanggan. Jika valid, kasir klik "Konfirmasi Pembayaran".
   * Jika **TUNAI**: Kasir memverifikasi rincian menu dan klik "Konfirmasi Pesanan Tunai".
   * **Pencatatan Waiters Aktif:** Sistem otomatis mengaitkan transaksi tersebut ke nama **Waiters yang sedang bertugas aktif pada shift tersebut**.
   * Kasir mencetak struk fisik via Bluetooth Thermal Printer. Pada struk fisik tercetak **TEKS BESAR & TEGAS**:
     * Untuk Tunai: `[ *** BAYAR TUNAI : Rp 26.000 *** ]` -> *"WAITERS WAJIB TAGIH UANG KE MEJA"*
     * Untuk QRIS: `[ *** QRIS LUNAS : Rp 26.000 *** ]` -> *"SUDAH LUNAS - TIDAK PERLU TAGIH"*
   * Alarm kasir otomatis berhenti. Sistem mencatat penambahan tagihan sewa SaaS (+Rp 50/struk).
5. **Masuk Antrean Dapur/Barista (KDS):** Tiket pesanan seketika muncul di layar KDS (`/kds`) dengan Nomor Antrean, Nomor Meja, dan tanda metode bayar.
6. **Barista Meracik & Klik Selesai:** Barista meracik menu, meletakkan struk fisik di samping nampan hidangan, lalu menekan tombol **"Selesai"** di layar KDS (status berubah `READY`).
7. **SOP Pengantaran & Penagihan oleh Waiters:**
   * Waiters mengambil pesanan beserta struk fisik dari dapur.
   * **Waiters WAJIB mengecek teks besar pada struk fisik:**
     * Jika tertulis **BAYAR TUNAI**: Waiters mengantar ke meja, **wajib menagih uang tunai ke pelanggan di meja** sesuai nominal struk, menyerahkan struk ke pelanggan, lalu menyetorkan uang cash tersebut ke laci kasir.
     * Jika tertulis **QRIS LUNAS**: Waiters langsung menyerahkan pesanan dan struk tanpa menagih.
8. **Antrean TV Berubah Hijau & Panggilan Suara:**
   * Di Layar Antrean Smart TV (`/tv`), nomor antrean dan meja berpindah ke kolom **"SIAP DIAMBIL / DIANTAR"** dengan warna latar **HIJAU** (`#10B981`) dan suara robot TTS memanggil meja pelanggan.
9. **Auto-Dismiss (Menghilang Otomatis):**
   * Antrean hijau bertahan selama durasi `queue_dismiss_seconds` yang diatur Super Admin Pusat (default: 60 detik), lalu otomatis memudar dan menghilang dari layar TV dan KDS.
10. **Manajemen Shift Waiters & Rekonsiliasi Kas Laci (Anti-Selisih):**
    * Di halaman Kasir terdapat fitur **Manajemen Shift Waiters** (input nama waiters aktif & log pergantian shift).
    * Sistem merekam jam mulai, jam selesai, dan total akumulasi uang tunai yang ditagih oleh masing-masing waiters.
    * Saat pergantian shift atau tutup toko, kasir dan owner dapat mencocokkan (*reconciliation*) total uang tunai yang seharusnya dikumpulkan waiters dengan uang fisik yang ada di laci kasir.

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
   * Jika **LULUS**: Update status Supabase menjadi `PAID`. Layar kasir terbuka (*Unlock*), shift harian di-*reset*, dan cetak *Z-Report* (Laporan Harian Rekonsiliasi Kas & Penjualan).
   * Jika **GAGAL/BURAM**: Kasir menekan tombol "Bantuan Admin". Status menjadi `PENDING_REVIEW`. Layar terbuka sementara (tenggang 12 jam) agar kasir bisa pulang, sementara Admin memvalidasi manual di *Dashboard*.

## 5. SKEMA DATABASE (SUPABASE POSTGRESQL) - MULTI-TENANT

Desain tabel utama di Supabase dengan Row Level Security (RLS) berbasis `warkop_id`:

* `warkops`: Menyimpan data klien (`id`, `nama`, `slug`, `qris_image_url`, `queue_dismiss_seconds`, `unique_code_range_start`, `unique_code_range_end`, `offline_limit_hours`, `is_active`).
* `warkop_members`: Relasi pengguna Auth ke warkop (`id`, `warkop_id`, `user_id`, `username`, `role` [OWNER, KASIR, DAPUR, TV]).
* `menus`: Katalog produk (`id`, `warkop_id`, `nama`, `harga`, `kategori`, `is_available`).
* `shifts`: Sesi kerja kasir (`id`, `warkop_id`, `opened_by`, `opened_at`, `closed_at`, `status` [OPEN, CLOSED]).
* `waiter_shifts`: Sesi jam kerja waiters (`id`, `warkop_id`, `shift_id`, `waiter_name`, `started_at`, `ended_at`, `total_cash_collected`, `status` [ACTIVE, ENDED]).
* `transactions`: Data penjualan per bon (`id`, `warkop_id`, `shift_id`, `waiter_shift_id`, `waiter_name`, `table_number`, `nomor_antrean`, `total_harga`, `payment_method` [QRIS, CASH], `payment_proof_url`, `status_pesanan` [AWAITING_CONFIRMATION, COOKING, READY, DONE, VOID, REJECTED], `created_at`, `synced_at`).
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

## 8. ARSITEKTUR MULTI-PWA KANONIS

OKESIH terdiri dari tiga aplikasi terpasang yang berbeda, bukan satu aplikasi umum dengan shortcut bercampur:

| PWA | Target origin | Fallback path | `id` manifest | Cakupan utama |
| --- | --- | --- | --- | --- |
| Owner | `owner.okesih.com` | `/owner` | `/pwa/owner` | Pengaturan, laporan, perangkat, staf |
| Kasir | `kasir.okesih.com` | `/pos` | `/pwa/pos` | Pesanan, pembayaran, shift, cetak |
| Dapur/KDS | `dapur.okesih.com` | `/kds` | `/pwa/kds` | Tiket dapur dan perubahan status |

Setiap aplikasi memiliki manifest, nama, ikon, warna, `start_url`, dan `scope` tersendiri. Selama DNS subdomain belum diarahkan ke Vercel, aplikasi tetap dapat dipasang melalui fallback path pada origin utama dengan identitas manifest yang berbeda. Service worker hanya menyimpan app-shell dan aset statis; respons autentikasi, pembayaran, data Owner, dan API tenant tidak boleh masuk cache publik.

Browser selalu memerlukan persetujuan pengguna untuk instalasi. Aplikasi boleh menampilkan modal onboarding dan tombol instalasi, tetapi tidak boleh mengklaim dapat memasang shortcut secara otomatis. Pada browser yang tidak menyediakan `beforeinstallprompt`, UI menampilkan petunjuk instalasi manual sesuai platform.

## 9. ONBOARDING OWNER & PUSAT INSTALASI

Login pertama Owner menjalankan alur berikut:

1. Memastikan kredensial awal valid dan tenant aktif.
2. Meminta Owner mengganti password awal sebelum tindakan sensitif.
3. Menampilkan onboarding pemasangan PWA Owner.
4. Menampilkan checklist: pasang Owner, pairing Kasir, pairing KDS, uji koneksi, dan selesai.
5. Menyimpan progres di database agar konsisten lintas browser/perangkat; `localStorage` hanya digunakan untuk preferensi UI.

Dashboard Owner memiliki halaman **Perangkat & PWA** dengan fungsi:

* menampilkan instruksi dan tombol instalasi PWA Owner;
* menyetujui kode pairing POS/KDS;
* menampilkan nama perangkat, tipe, status, waktu pairing, dan terakhir aktif;
* mengganti nama perangkat;
* mencabut satu perangkat atau seluruh perangkat tenant;
* menandai perangkat kedaluwarsa/tercabut tanpa menghapus audit historis.

Instalasi selalu dilakukan pada perangkat tujuan. Tombol Dashboard tidak dapat memasang aplikasi dari jarak jauh; untuk tablet/TV, Dashboard memberikan URL/QR dan menyetujui kode yang tampil pada perangkat tersebut.

## 10. DEVICE TRUST & PAIRING TANPA LOGIN BERULANG

Perangkat tidak diidentifikasi menggunakan fingerprint, MAC address, serial number, atau ID browser. Identitas perangkat adalah token acak berentropi tinggi yang diterbitkan server setelah pairing disetujui.

### Alur Pairing

1. POS/KDS tanpa sesi perangkat meminta pairing baru.
2. Server membuat kode pendek sekali pakai dan rahasia polling terpisah; kode berlaku maksimal 5 menit.
3. Perangkat menampilkan kode kepada Owner.
4. Owner memasukkan kode pada Dashboard dan memilih tenant/jenis akses yang benar.
5. Server menandai permintaan disetujui dan menerbitkan token perangkat tepat satu kali.
6. Browser menyimpan token dalam cookie `HttpOnly`, `Secure`, dan `SameSite`; database hanya menyimpan hash token.
7. Permintaan berikutnya diverifikasi server, tenant-scoped, role-scoped, tidak dicabut, dan belum kedaluwarsa.

### Batas Izin

* `OWNER`: pengelolaan tenant lengkap melalui sesi Supabase Owner.
* `POS_DEVICE`: membaca menu/pesanan tenant, mengonfirmasi/menolak pesanan, mengelola shift, dan mencetak struk.
* `KDS_DEVICE`: membaca tiket yang telah dikonfirmasi dan mengubah status `COOKING`, `READY`, atau `DONE`.
* Perangkat tidak dapat mengubah staf, QRIS, profil tenant, atau melihat data tenant lain.

Sesi perangkat memiliki kedaluwarsa absolut, rotasi aktivitas, `last_seen_at`, pencabutan langsung, dan audit. Auto-login berarti perangkat terpercaya yang dapat dicabut, bukan sesi permanen tanpa batas. Identitas operator tetap dicatat melalui pemilihan staf/PIN saat membuka shift agar akuntabilitas tidak hilang.

## 11. SKEMA DATA DEVICE, ONBOARDING, AUDIT & IDEMPOTENSI

Tabel tambahan kanonis:

* `owner_onboarding`: `warkop_id`, `owner_user_id`, `password_changed_at`, `owner_pwa_installed_at`, `completed_at`, timestamps.
* `device_pairing_requests`: `id`, `warkop_id` nullable sebelum persetujuan, `device_type`, `device_name`, `code_hash`, `poll_secret_hash`, `status`, `expires_at`, `approved_by`, `approved_at`, `consumed_at`.
* `device_installations`: `id`, `warkop_id`, `device_type`, `device_name`, `token_hash`, `status`, `paired_by`, `paired_at`, `last_seen_at`, `expires_at`, `revoked_at`.
* `operation_idempotency`: `warkop_id`, `device_id`, `idempotency_key`, `operation`, `response`, `created_at`; unik per perangkat dan kunci.
* `audit_logs`: aktor, tenant, perangkat, tindakan, target, metadata aman, waktu, dan alamat jaringan yang telah diminimalkan.

Token mentah, password, service-role key, dan bukti sensitif tidak boleh masuk audit log. Seluruh tabel mengaktifkan RLS; operasi perangkat berjalan melalui Route Handler tervalidasi, bukan akses tabel anonim.

## 12. KEAMANAN PESANAN PELANGGAN & RLS

Kebijakan publik `SELECT ... USING (true)` pada transaksi dan item dilarang. Pelanggan berinteraksi melalui endpoint publik tervalidasi:

1. Menu publik hanya mengembalikan profil aktif, meja aktif, QRIS publik, serta menu tersedia.
2. Harga dan total dihitung ulang di server berdasarkan menu tenant; harga dari browser tidak dipercaya.
3. Setiap pesanan memakai `idempotency_key` untuk mencegah duplikasi akibat retry.
4. Server menerbitkan token akses pesanan acak; hanya hash disimpan.
5. Pelanggan hanya dapat melihat status pesanannya sendiri menggunakan token tersebut.
6. Upload bukti pembayaran dibatasi tipe, ukuran, path tenant, dan tidak memberi akses daftar seluruh bucket.
7. POS/KDS hanya menerima data tenant yang terikat pada kredensial perangkatnya.

Perubahan pembayaran, penolakan, void, perubahan status, pairing, pencabutan perangkat, dan penutupan shift wajib masuk audit log.

## 13. OFFLINE-FIRST, SINKRONISASI & REALTIME

PWA Kasir menyimpan snapshot menu, tiket aktif, shift aktif, dan antrean operasi lokal di IndexedDB. Setiap mutasi mempunyai UUID idempoten dan status `PENDING`, `SYNCING`, `SYNCED`, atau `FAILED`.

* Saat online, transaksi dan perubahan status dikirim ke server lalu didistribusikan ke layar lain.
* Saat offline, operasi yang diizinkan masuk antrean lokal dan disinkronkan berurutan setelah koneksi pulih.
* Server mengembalikan respons lama untuk kunci idempoten yang sudah diproses sehingga retry tidak membuat transaksi ganda.
* Setelah `offline_limit_hours` terlampaui, mutasi finansial baru dikunci sampai perangkat tersambung dan lease diperbarui.
* Konflik tidak ditimpa diam-diam; UI menampilkan kegagalan beserta pilihan retry.
* KDS mengutamakan transport realtime, dengan polling tenant-scoped sebagai fallback saat WebSocket tidak tersedia.

API/auth menggunakan `NetworkOnly`. App-shell/aset versi menggunakan strategi cache aman. Data tenant yang dicache harus dipisahkan berdasarkan tenant/perangkat dan dibersihkan saat sesi dicabut.

## 14. ANDROID TV & SMART TV

PWA KDS dapat dipasang hanya jika browser TV mendukung instalasi. Fallback universal adalah mode browser fullscreen dengan pairing kode. Untuk produksi Android TV yang konsisten, disediakan wrapper APK/AAB tipis menuju KDS web dengan:

* `CATEGORY_LEANBACK_LAUNCHER` dan banner TV;
* landscape, tampilan jarak jauh, fokus yang terlihat, dan navigasi D-pad;
* deklarasi tidak memerlukan touchscreen;
* pencegahan ambient/sleep selama operasional;
* pairing kode yang sama dengan PWA dan kemampuan pencabutan dari Dashboard Owner.

APK TV adalah kanal distribusi tambahan, bukan tempat menyimpan service-role key atau kredensial tenant statis.

## 15. TAHAP IMPLEMENTASI & KRITERIA SIAP PRODUKSI

Urutan wajib:

1. Tutup RLS publik yang berlebihan dan buat endpoint transaksi tervalidasi.
2. Tambahkan skema onboarding, pairing, perangkat, audit, dan idempotensi.
3. Hubungkan menu pelanggan, POS, dan KDS ke data tenant nyata.
4. Terapkan pairing, auto-login perangkat, rotasi, dan pencabutan.
5. Pisahkan manifest dan pengalaman instalasi tiga PWA.
6. Terapkan IndexedDB, retry idempoten, lease offline, dan fallback realtime.
7. Uji isolasi tenant, role, duplikasi retry, pencabutan, kedaluwarsa, offline/online, dan instalasi.
8. Deploy migrasi database lebih dahulu, lalu aplikasi Vercel, kemudian lakukan smoke test produksi.

Sistem dinyatakan siap hanya jika tidak ada POS/KDS demo statis, tidak ada transaksi publik yang dapat dibaca lintas pelanggan, perangkat tercabut langsung kehilangan akses, dan semua jalur finansial memiliki idempotensi serta audit.

## 16. PANDUAN KANONIS — MULTI-TIER AFFILIATE (JARINGAN KEMITRAAN 2 LEVEL - SKEMA A)

Sistem pemasaran OKESIH menggunakan model *Multi-Tier Affiliate* (Jaringan Kemitraan 2 Level). Seluruh besaran komisi **tidak dikunci (hardcoded)** di dalam sistem, melainkan bersifat dinamis dan dikendalikan terpusat oleh Super Admin melalui halaman **Parameter Master Global**.

### 16.1. Konsep Utama & Terminologi

- **Mitra Marketing:** Pasukan penjualan di lapangan yang bertugas mengakuisisi Warkop/Tenant.
- **Koordinator Mitra:** Level keanggotaan khusus yang bertugas membina jaringan Mitra Marketing (*downline*), diangkat langsung oleh Super Admin melalui tombol aksi **"Jadikan Koordinator"**.
- **Parameter Master Global (`platform_settings`):** Pusat kendali variabel sistem OKESIH, di mana Super Admin menentukan nilai baku untuk:
  - `saas_fee_per_receipt` (Biaya sewa per struk)
  - `default_marketing_commission` (Komisi Marketing langsung)
  - `coordinator_commission_per_receipt` (Komisi Koordinator Mitra / Bonus Jaringan)

### 16.2. Skema Komisi: Skema A (Terpusat pada Parameter Global)

Pendapatan perusahaan (biaya sewa per struk) dipotong untuk mendistribusikan komisi secara otomatis berdasarkan variabel yang disetel di Parameter Master Global.

**Simulasi Finansial:**
- **Biaya Sewa / Struk:** Rp 50
- **Komisi Mitra Marketing (Akuisisi Langsung):** Rp 10 / struk (Sesuai parameter global)
- **Komisi Koordinator Mitra (Bonus Jaringan):** Rp 5 / struk (Sesuai parameter global)
- **Margin Bersih Perusahaan:** Rp 35 / struk (Hasil pengurangan otomatis oleh sistem: Rp 50 - Rp 10 - Rp 5)

*(Catatan Dinamis: Jika sewaktu-waktu Super Admin mengubah nilai Komisi Koordinator menjadi Rp 7 di Parameter Master Global, maka seluruh perhitungan komisi tagihan yang dilunasi ke depannya akan otomatis mengikuti angka baru tersebut. Nilai komisi yang sudah tercatat pada mutasi lama tersimpan permanen sebagai snapshot dan tidak berubah).*

### 16.3. Batas & Integritas Jaringan

1. **Jaringan Maksimal 2 Level:**
   `Koordinator Mitra` → `Mitra Marketing (Downline)` → `Tenant (Warkop)`.
   Tidak ada bonus rekursif, tidak ada koordinator multi-level bertingkat, dan tidak ada komisi jaringan untuk diri sendiri.
2. **Peran Autentikasi:**
   Keduanya menggunakan role autentikasi `MARKETING`. Tingkat keanggotaan disimpan pada atribut profil database (`membership_level`: `'KOORDINATOR'` / `'COORDINATOR'` vs `'MITRA'`), bukan dipercayakan kepada browser.
3. **Perekrutan Otomatis Berbasis Referral:**
   Calon marketing yang mendaftar melalui tautan referral koordinator (`/marketing/daftar?ref=KODE_REFERRAL`) secara otomatis diikat (`upline_id`) ke koordinator tersebut. Tanpa referral valid, pendaftar menjadi mitra mandiri tanpa upline.
4. **Akuisisi Langsung oleh Koordinator:**
   Jika seorang Koordinator Mitra mengakuisisi tenant secara langsung tanpa perantara mitra bawahan, koordinator tersebut menerima Komisi Langsung (Marketing) dan tidak ada komisi jaringan ganda.
5. **Kebijakan Akun Nonaktif (Suspended):**
   Jika mitra atau koordinator dinonaktifkan (`status !== 'ACTIVE'`) setelah memperoleh tenant:
   - Akun tersebut **tidak bisa lagi melakukan pencairan dana** (API menolak dengan HTTP 403).
   - Akun tersebut **tidak akan melihat saldo/pendapatan** (seluruh nominal saldo disembunyikan/dimaskir dengan label penangguhan akun).

### 16.4. Alur Kerja (Workflow) Sistem Pemasaran

#### Fase 1: Pengaturan Master & Pengangkatan Koordinator
1. Super Admin membuka menu **Parameter Master Global** dan memastikan nilai `Komisi Koordinator Mitra` telah ditentukan.
2. Super Admin berpindah ke menu **Mitra Marketing** yang menampilkan daftar seluruh mitra.
3. Super Admin memilih salah satu mitra aktif, lalu menekan tombol aksi **"Jadikan Koordinator"**.
4. Status mitra berubah menjadi `Koordinator Mitra` dan sistem langsung mengaktifkan fitur jaringan untuk akun tersebut tanpa perlu menginput ulang besaran komisi secara manual. Jika diperlukan, Super Admin dapat mencabut status tersebut kembali ke `Mitra Marketing`.

#### Fase 2: Perekrutan Jaringan (*Downline*)
1. Koordinator Mitra membuka aplikasi PWA Marketing. Bottom navigation kini menampilkan menu **"Jaringan"** (`/marketing/dashboard/jaringan`) lengkap dengan **Link Referral** pendaftaran unik (`https://sales.okesih.com/marketing/daftar?ref=KODE_REFERRAL`).
2. Koordinator membagikan tautan tersebut kepada calon mitra baru.
3. Calon mitra mengisi formulir pendaftaran melalui tautan tersebut. Sistem server memverifikasi kode referral dan mengikat `upline_id` calon mitra secara otomatis ke ID Koordinator bersangkutan.

#### Fase 3: Akuisisi Warkop & Operasional
1. Mitra Marketing (downline) mendaftarkan Warkop "A" melalui formulir akuisisi di PWA Marketing.
2. Super Admin memverifikasi dan menyetujui akun tenant Warkop "A".
3. Warkop "A" beroperasi dan mencetak 300 struk transaksi sah dalam satu hari.
4. Saat Tutup Shift, tagihan harian terbentuk Rp 15.000 (300 struk x Rp 50). Warkop "A" membayar tagihan melalui sistem QRIS / transfer bank.

#### Fase 4: Distribusi Komisi Otomatis (Trigger / Service RPC)
1. Saat pembayaran Warkop "A" diverifikasi dan status berubah menjadi `PAID`, sistem membaca nilai terkini dari `platform_settings`:
   - `default_marketing_commission` (misal Rp 10)
   - `coordinator_commission_per_receipt` (misal Rp 5)
2. Sistem mengeksekusi split payment secara otomatis ke dalam saldo internal dan mencatat mutasi ke tabel `marketing_commission_mutations`:
   - **Saldo Mitra Marketing:** Bertambah `300 x Rp 10 = Rp 3.000` (Jenis: `DIRECT`, Asal: Warkop "A").
   - **Saldo Koordinator Mitra:** Bertambah `300 x Rp 5 = Rp 1.500` (Jenis: `NETWORK`, Asal: Warkop "A", Mitra Pengakuisisi: Nama Mitra Marketing).
3. Mutasi ini langsung tampil di menu **"Komisi Berjalan"** masing-masing mitra dengan rincian nama tenant dan nama mitra downline terkait.
4. Kunci unik `UNIQUE(billing_id, kind)` pada buku mutasi menjamin mutasi idempoten dan mencegah kredit saldo ganda bila ada request berulang.

### 16.5. Skema Tabel Database

```sql
-- Tabel platform_settings (Parameter Master Global)
ALTER TABLE public.platform_settings 
  ADD COLUMN IF NOT EXISTS coordinator_commission_per_receipt NUMERIC(10, 2) NOT NULL DEFAULT 5.00;

-- Tabel marketing_partners (Tingkat Keanggotaan & Upline)
ALTER TABLE public.marketing_partners 
  ADD COLUMN IF NOT EXISTS membership_level VARCHAR(20) NOT NULL DEFAULT 'MITRA',
  ADD COLUMN IF NOT EXISTS upline_id UUID REFERENCES public.marketing_partners(id) ON DELETE SET NULL;

-- Tabel Buku Mutasi Komisi (Idempoten & Audit Trail)
CREATE TABLE IF NOT EXISTS public.marketing_commission_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES public.saas_billings(id) ON DELETE CASCADE,
  warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.marketing_partners(id) ON DELETE CASCADE,
  source_partner_id UUID REFERENCES public.marketing_partners(id) ON DELETE SET NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('DIRECT', 'NETWORK')),
  receipts_count INTEGER NOT NULL DEFAULT 0,
  rate_per_receipt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_billing_commission_kind UNIQUE (billing_id, kind)
);
```
