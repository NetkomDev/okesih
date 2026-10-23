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

## 16. PANDUAN KANONIS — MULTI-TIER AFFILIATE (KOMISI DUA PENERIMA LANGSUNG)

Kedalaman perekrutan OKESIH boleh bertingkat; setiap tagihan membayar maksimal dua penerima: pembina tenant dan satu upline langsungnya. Seluruh besaran komisi **tidak dikunci (hardcoded)** di dalam sistem, melainkan bersifat dinamis dan dikendalikan terpusat oleh Super Admin melalui **Parameter Master Global**, dengan bonus khusus per KorMit bila ditetapkan.

### 16.1. Konsep Utama & Terminologi

- **Mitra Marketing:** Pasukan penjualan di lapangan yang bertugas mengakuisisi Warkop/Tenant.
- **Koordinator Mitra:** Level keanggotaan khusus yang bertugas membina jaringan Mitra Marketing (*downline*), diangkat langsung oleh Super Admin melalui tombol aksi **"Jadikan Koordinator"**.
- **Parameter Master Global (`platform_settings`):** Pusat kendali variabel sistem OKESIH, di mana Super Admin menentukan nilai baku untuk:
  - `saas_fee_per_receipt` (Biaya sewa per struk)
  - `default_marketing_commission` (Komisi Marketing langsung)
  - `coordinator_commission_per_receipt` (Komisi Koordinator Mitra / Bonus Jaringan)

### 16.2. Skema Komisi: Global dan Bonus Khusus KorMit

Pendapatan perusahaan (biaya sewa per struk) dipotong untuk mendistribusikan komisi secara otomatis berdasarkan variabel yang disetel di Parameter Master Global.

**Simulasi Finansial:**
- **Biaya Sewa / Struk:** Rp 50
- **Komisi Mitra Marketing (Akuisisi Langsung):** Rp 10 / struk (Sesuai parameter global)
- **Komisi Koordinator Mitra (Bonus Jaringan):** Rp 5 / struk (Sesuai parameter global)
- **Margin Bersih Perusahaan:** Rp 35 / struk (Hasil pengurangan otomatis oleh sistem: Rp 50 - Rp 10 - Rp 5)

*(Catatan Dinamis: Jika sewaktu-waktu Super Admin mengubah nilai Komisi Koordinator menjadi Rp 7 di Parameter Master Global, maka KorMit tanpa bonus khusus mengikuti angka baru tersebut pada pelunasan berikutnya; KorMit dengan bonus khusus tetap memakai nilai khususnya. Nilai komisi yang sudah tercatat pada mutasi lama tersimpan permanen sebagai snapshot dan tidak berubah).*

### 16.3. Batas & Integritas Jaringan

1. **Komisi maksimal dua penerima per tagihan:**
   Rantai A → B → C diperbolehkan; tenant C memberi DIRECT kepada C dan NETWORK hanya kepada B.
   - Tidak ada bonus rekursif ke leluhur dan tidak ada komisi jaringan untuk diri sendiri.
   - Koordinator boleh memiliki upline; pengangkatan mempertahankan hubungan perekrut langsung.
   - Mitra dilarang menjadi upline untuk dirinya sendiri (`upline_id != id`).
   - Pengangkatan memerlukan status `ACTIVE` dan akun login. Siklus upline dilarang, termasuk siklus yang dicoba melalui permintaan bersamaan.
   - Pencabutan status Koordinator dilarang selama mitra masih memiliki downline binaan.
   - Integritas hierarki ini ditegakkan di layer database (`enforce_marketing_network()` trigger & check constraints) serta layer validasi API Super Admin.
2. **Peran Autentikasi:**
   Keduanya menggunakan role autentikasi `MARKETING`. Tingkat keanggotaan disimpan pada atribut profil database (`membership_level`: `'KOORDINATOR'` / `'COORDINATOR'` vs `'MITRA'`), bukan dipercayakan kepada browser.
3. **Perekrutan Otomatis Berbasis Referral:**
   Calon marketing yang mendaftar melalui tautan referral koordinator (`/marketing/daftar?ref=KODE_REFERRAL`) secara otomatis diikat (`upline_id`) ke koordinator tersebut. Tanpa referral valid, pendaftar menjadi mitra mandiri tanpa upline.
4. **Akuisisi Langsung oleh Koordinator:**
   Jika seorang Koordinator Mitra mengakuisisi tenant secara langsung tanpa perantara mitra bawahan, koordinator tersebut menerima komisi DIRECT. Jika ia memiliki upline KorMit aktif, upline langsung itu menerima NETWORK; tidak ada penerima lain.
5. **Kebijakan Akun Nonaktif (Suspended & Inactive):**
   Penonaktifan akun mitra/koordinator (`status !== 'ACTIVE'`) menerapkan sanksi finansial operasional penuh, bukan sekadar penyamaran UI:
   - **Penghentian Komisi Baru (Zero Commission on Inactive):** Akun nonaktif **kehilangan hak atas komisi baru**. Saat tagihan warkop dilunasi, sistem memvalidasi status: jika mitra pengakuisisi nonaktif, komisi langsung `DIRECT` tidak diberikan (Rp 0). Jika koordinator nonaktif, komisi jaringan `NETWORK` tidak diberikan (Rp 0). Komisi hanya terbit bila akun berstatus `ACTIVE`.
   - **Pencegahan Pembayaran Pencairan:** Pengajuan pencairan berstatus `PENDING` **dilarang ditandai PAID** jika akun mitra penerima berstatus nonaktif atau ditangguhkan. Sistem menolak approval dengan pesan validasi eksplisit.
   - **Pencairan Baru Ditolak:** Akun nonaktif diblokir dari mengajukan permohonan pencairan baru (HTTP 403).
   - **Penyembunyian Data Finansial Penuh:** Seluruh total saldo, mutasi, dan rincian nominal komisi per tenant pada respon API `/api/marketing/dashboard` dinolkan (sanitized) sehingga tidak ada kebocoran data sensitif melalui inspeksi network/DevTools.
6. **Buku Mutasi Bersifat Permanen (Immutable Append-Only Ledger):**
   - Mutasi komisi yang telah tercatat di `marketing_commission_mutations` bersifat permanen dan tidak boleh ditimpa (`UPSERT overwrite` dilarang).
   - Nominal historis terlindungi dari perubahan tarif komisi di masa mendatang. Trigger database `guard_commission_history()` melarang operasi `UPDATE` dan `DELETE` pada mutasi komisi yang sudah tercatat.
7. **Penyatuan Sumber Saldo Tunggal (Single Source of Truth):**
   - Saldo dashboard dan saldo pencairan dihitung dari sumber yang sama: total akumulasi mutasi komisi settled (`marketing_commission_mutations`) dikurangi total pencairan yang sudah dibayar (`commission_paid`) dan pencairan `PENDING`.
   - Menghilangkan disparitas saldo akibat pemotongan limit tampilan mutasi atau perhitungan dari transaksi belum lunas.
8. **Finalitas Tagihan SaaS Lunas (`PAID`):**
   - Tagihan SaaS yang berstatus `PAID` terkunci rapat. Tutup shift berikutnya tidak boleh menambah transaksi ke tagihan yang sudah lunas, melainkan membentuk tagihan baru per-shift agar seluruh transaksi warkop tercatat dan diperhitungkan komisinya secara adil.

### 16.4. Alur Kerja (Workflow) Sistem Pemasaran

#### Fase 1: Pengaturan Master & Pengangkatan Koordinator
1. Super Admin membuka menu **Parameter Master Global** dan memastikan nilai `Komisi Koordinator Mitra` telah ditentukan.
2. Super Admin berpindah ke menu **Mitra Marketing** yang menampilkan daftar seluruh mitra.
3. Super Admin memilih salah satu mitra aktif yang belum memiliki upline, lalu menekan tombol aksi **"Jadikan Koordinator"**.
4. Status mitra berubah menjadi `Koordinator Mitra` dan sistem langsung mengaktifkan fitur jaringan untuk akun tersebut tanpa perlu menginput ulang besaran komisi secara manual. Jika diperlukan, Super Admin dapat mencabut status tersebut kembali ke `Mitra Marketing` selama koordinator tidak lagi memiliki downline aktif.

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
2. Sistem memeriksa kelayakan akun:
   - Jika mitra pengakuisisi berstatus `ACTIVE`, catat mutasi `DIRECT` ke tabel `marketing_commission_mutations`. Jika tidak aktif, mutasi `DIRECT` tidak terbit.
   - Jika koordinator upline langsung ada dan berstatus `ACTIVE`, catat satu mutasi `NETWORK` memakai `coordinator_commission_override` milik upline, atau tarif global bila NULL. Jika koordinator tidak aktif, mutasi `NETWORK` tidak terbit.
3. Pengecekan idempoten dilakukan sebelum pencatatan, menjamin mutasi append-only tidak menimpa nominal mutasi historis yang sudah tersimpan.
4. Mutasi ini langsung tampil di menu **"Komisi Berjalan"** masing-masing mitra aktif dengan rincian nama tenant dan nama mitra downline terkait.

### 16.5. Skema Tabel Database

```sql
-- Tabel platform_settings (Parameter Master Global)
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS coordinator_commission_per_receipt NUMERIC(10, 2) NOT NULL DEFAULT 5.00;

-- Tabel marketing_partners (Tingkat Keanggotaan & Upline)
ALTER TABLE public.marketing_partners
  ADD COLUMN IF NOT EXISTS membership_level VARCHAR(20) NOT NULL DEFAULT 'MITRA',
  ADD COLUMN IF NOT EXISTS upline_id UUID REFERENCES public.marketing_partners(id) ON DELETE SET NULL;

-- Tabel Buku Mutasi Komisi (Idempoten, Immutable & Audit Trail)
CREATE TABLE IF NOT EXISTS public.marketing_commission_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_id UUID NOT NULL REFERENCES public.saas_billings(id) ON DELETE CASCADE,
  warkop_id UUID NOT NULL REFERENCES public.warkops(id) ON DELETE CASCADE,
  marketing_partner_id UUID NOT NULL REFERENCES public.marketing_partners(id) ON DELETE CASCADE,
  source_partner_id UUID REFERENCES public.marketing_partners(id) ON DELETE SET NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('DIRECT', 'NETWORK')),
  receipts_count INTEGER NOT NULL DEFAULT 0,
  rate_per_receipt NUMERIC(10, 2) NOT NULL DEFAULT 0,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_billing_commission_kind UNIQUE (billing_id, kind)
);
```

## Audit PWA Mitra dan KorMit — 22 Oktober 2026

### Alur yang menjadi acuan

1. Super Admin mengangkat mitra aktif dengan akun login melalui **Jadikan Koordinator** pada Mitra Marketing Lapangan. Sejak perubahan 23 Oktober 2026, mitra dengan upline juga dapat dipromosikan; bonus tetap hanya untuk satu upline langsung.
2. KorMit memperoleh menu **KorMit** (`/marketing/dashboard/kormit`). URL lama `/marketing/dashboard/jaringan` diarahkan ke halaman ini. Halaman memuat status mitra binaan, jumlah tenant, bonus jaringan yang sudah dikreditkan, tautan undangan, dan formulir rekrutmen. Mitra biasa tidak mendapat akses endpoint KorMit meskipun memanggil URL secara langsung.
3. Formulir KorMit menyimpan calon mitra sebagai `PENDING` dan `MITRA`. `upline_id` berasal dari sesi koordinator yang divalidasi server, bukan nilai kiriman browser. UUID pendaftaran dipakai ulang saat mencoba ulang permintaan agar gangguan koneksi tidak membuat baris duplikat. Nomor rekening tetap string agar nol di awal tidak hilang.
4. Setelah data tersimpan, KorMit mendapat tombol WhatsApp ke Super Admin. Pesan menyebut koordinator, calon mitra, wilayah, kode referral, dan **nomor calon mitra**. Pendaftaran tampil di dashboard Super Admin dengan nama KorMit perekrut.
5. Super Admin memverifikasi pendaftaran. Jika diterima, sistem membuat akun Auth, username `marketing_###`, dan password sementara **6 digit angka**; hubungan upline dipertahankan. Pesan kredensial ditujukan ke **`phone` milik mitra baru**, bukan koordinator. KorMit tidak menerima password. Persetujuan bersamaan tetap memakai pengamanan aktivasi akun yang telah ada.
6. WhatsApp menggunakan mekanisme aplikasi yang tersedia: buka tautan `wa.me`, lalu pengguna menekan **Kirim**. Respons API bukan bukti pesan sudah dikirim/diterima. Integrasi pengiriman otomatis WhatsApp API belum diaktifkan dan memerlukan keputusan serta konfigurasi layanan tersendiri.

### Rumus komisi dan pencairan

Parameter produksi yang dibaca saat audit: biaya SaaS Rp50/struk, komisi langsung Rp20/struk, bonus KorMit Rp5/struk. Tarif tidak diubah dalam audit ini. **Parameter Master Global** menjadi sumber tarif langsung dan bonus default; sejak migrasi 33, `coordinator_commission_override` dapat mengganti bonus KorMit, tanpa mengganti tarif DIRECT. Kolom tarif lama pada profil/tenant tetap bukan sumber tarif langsung.

| Hubungan tenant | Penerima langsung | Penerima bonus jaringan |
|---|---|---|
| Tenant milik mitra mandiri | Mitra: jumlah struk × Rp20 | Tidak ada |
| Tenant langsung KorMit | KorMit: jumlah struk × Rp20 | Tidak ada bonus untuk dirinya sendiri |
| Tenant milik mitra binaan KorMit | Mitra: jumlah struk × Rp20 | KorMit: jumlah struk × Rp5 |

Contoh: 100 struk tenant mitra binaan yang tagihannya sudah lunas menghasilkan Rp2.000 untuk mitra dan Rp500 untuk KorMit. Jika KorMit juga memiliki 100 struk dari tenant langsungnya, total komisi KorMit menjadi Rp2.500.

- Komisi masuk ke `marketing_commission_mutations` saat tagihan SaaS menjadi `PAID`, bukan saat order dibuat atau bukti diunggah. Hanya pesanan `COOKING`, `READY`, dan `DONE` masuk perhitungan tagihan shift; `AWAITING_CONFIRMATION`, `VOID`, dan `REJECTED` tidak dihitung.
- Satu shift menghasilkan satu tagihan. Pemanggilan ulang tutup shift mengembalikan tagihan yang sama. Shift berikutnya tidak menambah nominal tagihan yang sudah lunas.
- Tarif dan relasi penerima dibaca saat pelunasan, sesuai mekanisme yang sudah ada. Perubahan tarif berlaku pada pelunasan berikutnya; mutasi yang sudah terbentuk tidak dihitung ulang. Total komisi langsung + jaringan tidak boleh melebihi pokok tagihan.
- Penerima komisi harus `ACTIVE`. Mitra nonaktif tidak menerima komisi langsung baru; KorMit nonaktif tidak menerima bonus baru. Sesuai aturan penerima yang sudah ada, KorMit aktif tetap dapat menerima bonus tenant mitra binaannya meskipun mitra tersebut nonaktif. Mengubah kebijakan ini membutuhkan keputusan bisnis tersendiri.
- Kunci unik `(billing_id, kind)` mencegah kredit ganda. Nominal ledger dan tagihan lunas dijaga trigger database.
- **Saldo tersedia = seluruh kredit ledger − komisi yang sudah dibayar − pengajuan `PENDING`**, minimum nol. Saldo dashboard Mitra, daftar Super Admin, dan pemeriksaan pencairan memakai ledger yang sama. Bonus jaringan ikut menjadi saldo KorMit.
- Permintaan pencairan mengunci baris mitra dan mencadangkan saldo dalam satu transaksi. API tidak boleh melakukan INSERT cadangan apabila RPC menolak.
- Persetujuan pencairan mengunci mitra dan pengajuan, memeriksa role Super Admin, status mitra, saldo, serta pengajuan lain sebelum menambah `commission_paid`. Persetujuan berulang ditolak. `REJECTED` melepaskan saldo tertahan dan tidak menambah saldo dibayar.
- Penandaan `PAID` di dashboard adalah pencatatan pembayaran setelah admin benar-benar mentransfer dana; aplikasi ini tidak mengeksekusi transfer bank.

### Temuan dan perbaikan

| Temuan | Dampak | Perbaikan |
|---|---|---|
| RPC pencairan produksi menjumlah transaksi × tarif tenant, sedangkan ledger memakai tagihan lunas | Saldo bisa berasal dari tagihan belum dibayar dan bonus KorMit terlewat | RPC, dashboard, dan daftar admin memakai agregat ledger |
| API memasukkan pengajuan langsung ketika RPC gagal | Penolakan saldo dapat dilewati; race antarpengajuan | Jalur cadangan dihapus; seluruh reservasi melalui RPC atomik |
| Review pencairan tidak mengunci mitra dan tidak memeriksa ulang saldo | Saldo berubah atau akun nonaktif masih berisiko dibayar | Kunci mitra → pengajuan, cek role/status/saldo/pending lain dalam transaksi |
| Tutup shift lama dapat menghitung ulang struk dan menggabungkan tagihan harian lunas | Penghitungan berulang atau perubahan komisi historis | Tagihan unik per shift, tutup ulang idempoten, tagihan lunas tidak berubah |
| Fungsi review/unggah bukti yang dipanggil aplikasi belum tersedia di produksi | Rantai pelunasan menuju kredit komisi tidak lengkap | Prasyarat billing terkait komisi disertakan dalam migrasi 31 |
| Fallback laporan jaringan tidak memilih `upline_id`, memindai semua mitra, dan terbatasi hasil API | Mitra binaan atau total bonus hilang; kegagalan terlihat seperti saldo nol | Gunakan RPC agregasi jaringan; kegagalan dikembalikan sebagai error |
| Tag catatan admin bisa dianggap sebagai otorisasi koordinator | Tampilan dan database berbeda; relasi bisa tersimpan hanya sebagai teks | Endpoint recruitment/referral memakai kolom kanonis; tidak fallback ke catatan |
| Penyimpanan pengaturan dapat melaporkan sukses tanpa kolom komisi koordinator | Bonus yang ditampilkan tidak sesuai tarif tersimpan | Gagal secara eksplisit jika parameter tidak tersimpan lengkap |
| Dashboard memakai tarif cadangan dan tarif profil/tenant lama | Pengguna melihat nilai yang berbeda dari perhitungan | Baca parameter global, tampilkan error jika gagal; hapus input tarif per-mitra yang tidak mengatur ledger |
| Total admin berasal dari counter lama; pending belum dikurangkan | Saldo admin berbeda dari saldo mitra | RPC agregasi ledger, tenant, dan pending; label saldo tersedia |
| Penghapusan mitra dilakukan bertahap dan mencoba menghapus riwayat keuangan | Kegagalan bisa meninggalkan relasi atau riwayat terhapus sebagian | RPC penghapusan atomik; mitra dengan mutasi/pencairan wajib dinonaktifkan, bukan dihapus |
| KorMit menambah navigasi keenam pada grid lima kolom | Tombol turun ke baris kedua pada HP | Jumlah kolom mengikuti jumlah menu; kartu mitra dan form responsif |

### Kondisi database produksi dan migrasi

Pemeriksaan read-only sebelum perubahan menunjukkan 5 mitra, 0 koordinator, 0 relasi binaan, 0 mutasi komisi, 0 pengajuan pencairan, 0 tagihan SaaS, dan total `commission_paid` nol. Karena itu tidak diperlukan backfill atau perubahan saldo historis.

Riwayat CLI produksi mencatat migrasi 01–23, sementara sebagian struktur 24 sudah ada dari penerapan manual. Fungsi lama pencairan masih memakai transaksi; perlindungan dari 25–30 belum seluruhnya ada. **Jangan menganggap keberadaan file migrasi berarti database telah diperbarui.**

`supabase/migrations/31_kormit_payout_integrity.sql` memuat prasyarat afiliasi dan billing yang dibutuhkan alur ini secara eksplisit. Migrasi tersebut dapat diuji pada baseline 01–24 maupun baseline lengkap 01–30. Migrasi tidak mengubah tarif global, membuat akun pengguna, membayar pengajuan, atau menghapus data bisnis. Semua DDL dijalankan dalam transaksi, dengan pemeriksaan produksi menggunakan ROLLBACK terlebih dahulu.

Jangan menjalankan semua migrasi tertunda 25–30 secara sembarang: selain menyentuh modul lain, beberapa fungsi di dalamnya akan menimpa perbaikan 31. Rekonsiliasi migrasi lama harus ditangani sebagai pekerjaan terpisah dan diakhiri penerapan ulang versi fungsi terbaru.

### Temuan yang memerlukan keputusan terpisah

File migrasi 27 memiliki fitur arsip tenant yang ikut menghapus ledger komisi. Fungsi arsip tersebut **belum terpasang di produksi saat audit**, dan audit KorMit ini tidak memasangnya. Sebelum fitur itu diaktifkan, tentukan apakah komisi yang sudah sah harus dipertahankan; pertanyaan konfirmasi telah diajukan. Sampai ada keputusan, jangan menjalankan migrasi arsip/purge sebagai bagian deployment KorMit. Perubahan pada kebijakan arsip tidak diperlukan untuk rekrutmen dan pencairan KorMit yang dibangun di sini.

### Validasi

- `npm run check`: lint tanpa error (18 peringatan yang sudah ada), 61 pengujian aplikasi lulus, build produksi dan pemeriksaan kebocoran secret lulus.
- `scripts/kormit.test.mjs`: otorisasi KorMit, catatan legacy yang bukan otorisasi, input nomor/rekening, asal permintaan, upline dari sesi, status pending, pendaftaran ulang idempoten, kegagalan RPC tanpa fallback, serta kredensial persetujuan menuju nomor mitra baru dengan password enam digit.
- `scripts/fixtures/kormit-assertions.sql`: mitra mandiri, tenant langsung KorMit, mitra binaan, total DIRECT + NETWORK, perubahan tarif historis, tarif nol/berlebih, akun nonaktif, promosi mitra dengan upline, reservasi, penolakan/pembayaran, pembayaran berulang, dan pelestarian riwayat saat penghapusan mitra.
- Uji rantai billing: struk valid → tutup shift → unggah bukti → review Super Admin → satu kredit komisi; tutup ulang dan review ulang tidak menggandakan hasil; shift baru tidak mengubah tagihan lunas.
- `scripts/test-kormit-concurrency.mjs`: dua permintaan Rp1.500 bersamaan dari saldo Rp2.000 menghasilkan tepat satu pengajuan; dua persetujuan pengajuan yang sama menghasilkan tepat satu pembayaran. Runner dibatasi ke database disposable localhost.
- Browser Chrome dengan data fiktif: 320, 360, 390, 430, 768 px; navigasi enam item satu baris, target sentuh minimal 44 px, form submit/daftar berikutnya, tanpa overflow elemen utama, keypad HP/rekening, serta tidak tampilnya fitur rekrutmen untuk mitra biasa. Ini simulasi viewport, bukan pengujian langsung perangkat Android/iOS.
- Tidak ada pesan WhatsApp nyata, akun marketing produksi fiktif, atau transfer uang yang dibuat selama pengujian.

Status penerapan database: migrasi 31 berhasil COMMIT di produksi dan dicatat sebagai applied melalui Supabase CLI. Verifikasi read-only sesudahnya memastikan seluruh lima saldo dashboard sama dengan agregat daftar Super Admin; tarif tetap Rp20/Rp5/Rp50. Migrasi 25–30 tidak dijalankan sekaligus.

## Audit daftar mobile Super Admin — 23 Oktober 2026

Pada lebar layar hingga 640 px, daftar Tenant dan Mitra memakai tabel tiga kolom dengan 10 baris per halaman. Tenant menampilkan nama, kota, dan provinsi; Mitra menampilkan nama, wilayah, dan jumlah tenant binaan langsung. Koordinator ditandai titik biru beserta teks KorMit. Nama panjang dibatasi dua baris dan nilai jumlah nol tetap ditampilkan.

Mengetuk baris membuka popup detail lengkap beserta tindakan admin yang sebelumnya tersedia. Popup menggunakan penguncian scroll, perangkap fokus, tombol tutup, dan Escape dari ModalFrame. Menutup detail mempertahankan pencarian, filter, halaman, dan posisi scroll. Tindakan yang membuka konfirmasi atau pengaturan akses menutup popup detail agar dialog tidak bertumpuk. Layout layar di atas 640 px tetap menggunakan tampilan sebelumnya dengan 25 baris per halaman.

Daftar Mitra kini melakukan pencarian, filter status, dan pagination di database melalui `report_superadmin_marketing_page`. Penghitungan komisi dan tenant dilakukan untuk mitra pada halaman yang diminta; total dan badge filter dihitung dari seluruh hasil pencarian. Urutan dibuat deterministik dengan `created_at DESC, id DESC`. API tanpa parameter pagination tetap memakai laporan lama untuk kompatibilitas pemilih mitra pada modul lain. Respons lama yang terlambat tidak boleh menimpa hasil pencarian terbaru. Perubahan status, level, dan penghapusan memuat ulang daftar agar jumlah dan filter konsisten.

Audit draft bersama menemukan referensi popup Tenant yang belum memiliki implementasi serta pagination Mitra yang masih mengambil seluruh data sebelum memotongnya. Keduanya telah diganti dengan komponen detail bersama dan pagination SQL. Perhitungan ledger serta kebijakan pembayaran komisi tidak diubah oleh pekerjaan tampilan ini.

Validasi:

- Pengujian database disposable menjalankan migrasi dan assertion regresi, termasuk 1.205 mitra: total, 121 halaman, halaman terakhir, pencarian, filter, urutan tanpa duplikasi, hasil kosong, dan penolakan akses anonim.
- Browser Chrome memakai data fiktif 1.500 tenant dan 1.205 mitra: viewport 320, 360, 390, 430, 640, 768, dan 1440 px; jumlah baris, tiga kolom mobile, badge KorMit, angka nol, pencarian/pagination, popup, pemulihan scroll, serta tidak adanya overflow horizontal.
- Interaksi tambahan: mode gelap, ketukan kolom wilayah, Escape, filter pendaftar, perpindahan ke konfirmasi persetujuan dan pengaturan akses, serta error jaringan dan coba lagi. Pengujian ini merupakan simulasi viewport, bukan perangkat Android/iOS fisik. Tidak ada pesan WhatsApp atau perubahan akun produksi yang dikirim saat pengujian.
- Migrasi 32 diuji dengan ROLLBACK sebelum diterapkan dengan COMMIT di produksi, lalu ditandai applied. Verifikasi read-only: total lima mitra konsisten dengan laporan lama; permintaan dua baris menghasilkan dua baris; akses anonim ditolak. Migrasi tertunda 25–30 tidak dijalankan.
- Simulasi persetujuan dengan PATCH fiktif memastikan mitra keluar dari filter PENDING dan jumlah pendaftar berkurang setelah daftar dimuat ulang.
- `npm run check` lulus: lint tanpa error (18 peringatan lama), 62 pengujian aplikasi, build produksi, serta pemeriksaan secret pada 145 file client.

### Penyempurnaan panel daftar HP — 23 Oktober 2026

Panel judul, pencarian, filter, dan tindakan dipisahkan dari panel hasil pada halaman Tenant dan Mitra untuk layar hingga 640 px. Tabel menggunakan seluruh lebar panel hasil tanpa padding panel kontrol; jarak luar dan batas kolom tetap konsisten. Judul diringkas menjadi “Kelola Tenant” dan “Kelola Mitra”, dengan deskripsi sesuai fungsi halaman. Tombol tambah, filter status dua kolom, dan navigasi halaman dirapikan dengan target sentuh minimal 44 px. Filter status menyediakan `aria-pressed`. Tampilan layar lebih besar tetap memakai struktur visual sebelumnya.

Validasi UI menggunakan data fiktif di Chrome pada lebar 320, 360, 390, 430, 640, 768, dan 1440 px. Pemeriksaan geometri memastikan panel kontrol dan hasil sejajar, terpisah minimal 12 px, serta tabel memenuhi lebar panel hasil tanpa padding bersarang. Pencarian, pagination, popup, pemulihan scroll, filter, mode gelap, dan error/coba lagi lulus. Pengujian memakai simulasi viewport, bukan perangkat fisik; tidak mengirim WhatsApp atau mengubah data produksi.

`npm run check` lulus: 62 tes aplikasi, lint tanpa error (18 peringatan yang sudah ada), build produksi, dan pemeriksaan secret pada 145 file client. Tidak diperlukan migrasi database untuk penyempurnaan tampilan ini.

### Redaksi WhatsApp dan UI Billing mobile — 23 Oktober 2026

Dua template WhatsApp perubahan level mitra (pengangkatan KorMit dan pengembalian menjadi mitra biasa) menggunakan penutup “Salam, Admin OKESIH”. Penelusuran seluruh kode aplikasi tidak menemukan lagi frasa “Super Admin OKESIH”; nama role dan otorisasi Super Admin tetap sesuai fungsi internal.

Pada HP hingga 640 px, Billing menampilkan ringkasan dua kolom, panel QRIS/rekening yang ringkas, dan panel kontrol terpisah dari daftar tagihan. Kartu tagihan memakai susunan dua kolom untuk nominal dan informasi OCR; nama tenant, status, dan tombol tindakan memiliki baris penuh. Pencarian, filter status, pengaturan QRIS, dan detail tetap tersedia. Label statistik memakai satuan tagihan/shift sesuai data, bukan menganggap setiap tagihan mewakili tenant berbeda.

Hasil pencarian kosong diberi pesan yang jelas; kegagalan memuat data menampilkan error dan tombol coba lagi. Filter status menyediakan `aria-pressed`, pengaturan QRIS menyediakan `aria-expanded`, dan tombol tutup detail diberi nama aksesibel. NMID contoh yang ditulis tetap serta klaim “Klop” tanpa pemeriksaan dihapus dari tampilan. Perhitungan tagihan, prosedur persetujuan/referensi bank, dan pembayaran tidak diubah.

Validasi browser menggunakan lima status tagihan fiktif pada viewport 320, 360, 390, 430, 640, 768, dan 1440 px: tidak ada overflow horizontal; ringkasan dua kolom di HP; pencarian dan filter; popup detail; form QRIS; keypad rekening; serta tidak ada permintaan mutasi produksi. Pengujian dilakukan dengan simulasi viewport, bukan perangkat fisik. Tidak ada pesan WhatsApp atau pembayaran nyata dikirim.

Uji tambahan berhasil untuk error jaringan → coba lagi → data kembali tampil, serta pergantian tema melalui tombol aplikasi. Kontras label filter aktif pada tema gelap diperiksa; tidak ada permintaan mutasi yang dikirim selama pengujian browser.

Validasi akhir `npm run check` lulus: lint tanpa error (18 peringatan lama), 62 tes aplikasi, build produksi, dan pemeriksaan secret pada 145 file client. Build lokal mencatat satu kegagalan fetch parameter global saat prerender, tetapi menyelesaikan seluruh 77 halaman dengan exit code 0; pengujian browser Billing menggunakan respons parameter terkontrol. Tidak diperlukan migrasi database.

## KorMit dengan upline dan bonus khusus — 23 Oktober 2026

Struktur perekrutan boleh lebih dari dua tingkat. Pembayaran komisi tetap maksimal dua penerima per tagihan: mitra pembina tenant memperoleh DIRECT, dan satu KorMit perekrut langsung memperoleh NETWORK. Pada A → B → C → D, tenant B membayar B + A, tenant C membayar C + B, dan tenant D membayar D + C. A tidak menerima bonus tenant C/D. Laporan jaringan tetap menampilkan mitra binaan langsung saja.

Tombol **Jadikan Koordinator** kini membuka popup. Super Admin memeriksa nama dan mengisi bonus khusus Rupiah/struk atau mengosongkannya untuk mengikuti global. `NULL` = global; `0` = tanpa bonus; angka positif = bonus khusus. **Simpan** mengirim satu UPDATE untuk level dan bonus; kegagalan mempertahankan popup untuk diperbaiki. KorMit aktif juga memiliki tombol **Atur bonus KorMit**. Nilai efektif digunakan pada dashboard/profil mitra, pelunasan, dan pesan WhatsApp.

Pengangkatan tidak menghapus upline. Perekrutan dari menu KorMit mengunci `upline_id` dari sesi; tautan referral KorMit dengan upline juga valid. Calon mitra tetap PENDING sampai diverifikasi Super Admin. Akun nonaktif dan mitra biasa tetap tidak mendapat akses rekrutmen KorMit.

Batas bonus khusus adalah tarif SaaS dikurangi komisi langsung. API dan database menolak nilai negatif, pecahan, serta total komisi berlebih. Perubahan tarif global yang bertentangan dengan bonus khusus yang tersimpan ditolak. Perubahan relasi/tarif diserialkan sebelum kunci baris untuk menolak siklus atau kombinasi tarif tidak sah saat permintaan bersamaan; pembaruan saldo pencairan tidak ikut mengambil kunci konfigurasi tersebut. Penghapusan mitra memakai urutan kunci yang sama dan tetap menolak penghapusan riwayat keuangan.

Migrasi `33_coordinator_direct_upline_bonus.sql` menambah kolom nullable tanpa mengubah nilai global, hubungan yang sudah ada, atau ledger historis. Tarif dan hubungan saat pelunasan dipakai sebagai snapshot mutasi; mengubah bonus atau mengulang PAID tidak menghitung ulang mutasi lama. Mekanisme WA tetap membuka `wa.me` setelah penyimpanan berhasil; admin menekan Kirim di WhatsApp. Sistem tidak mengklaim pengiriman otomatis atau pesan sudah diterima.

Validasi meliputi seluruh migrasi pada PostgreSQL disposable, assertion pembayaran/pencairan/direktori, serta rantai A–B–C–D. Uji serentak memastikan tepat satu perubahan pembentuk siklus berhasil, kombinasi tarif global/khusus tetap dalam batas SaaS, dan pencairan berulang tidak menggandakan pembayaran. Browser dengan data fiktif pada 320, 390, 640, dan 1440 px memeriksa popup, batal tanpa PATCH, bonus kosong/nol/khusus, batas nominal, dan error simpan. Tidak ada akun fiktif, pembayaran, atau pesan WA nyata dibuat di produksi.

Contoh 100 struk, komisi DIRECT global Rp20, bonus global Rp5, dan bonus khusus B Rp7:

| Tenant dibina oleh | Penerima DIRECT | Penerima NETWORK | Tidak menerima NETWORK |
|---|---|---|---|
| B (upline A) | B: Rp2.000 | A: Rp500 | B sendiri |
| C (upline B) | C: Rp2.000 | B: Rp700 | A |

Hasil rilis: 68 tes aplikasi lulus, lint tanpa error (18 peringatan lama), build produksi dan pemeriksaan secret pada 145 file client lulus. Migrasi 33 lolos preflight ROLLBACK, kemudian COMMIT di produksi dan dicatat applied. Verifikasi read-only memastikan lima mitra tetap memakai default (override NULL), tarif global tetap Rp20/Rp5/Rp50, laporan paginasi memuat kolom override, dan role authenticated tidak memiliki izin UPDATE langsung ke tabel mitra. Tidak ada ledger historis diubah. Migrasi tertunda 25–30 tidak diterapkan bersama perubahan ini.

## Peringatan keluar PWA Android — 23 Oktober 2026

Pengaman bersama di root layout berlaku untuk PWA Android terpasang pada Super Admin, Owner, Mitra, dan Kasir. Halaman publik/login dan tab browser biasa tidak diintersep. Back dari halaman turunan tetap menavigasi ke halaman sebelumnya. Pada batas keluar, Back pertama menampilkan persis “Tekan kembali sekali lagi untuk menutup aplikasi”, tanpa tombol maupun timer. Ketuk area luar membatalkan; ketuk isi popup tidak menutup. Back berikutnya diserahkan kepada Android/browser untuk keluar atau minimize. Tidak ada pemanggilan logout maupun perubahan cookie/token akun.

Browser yang menyediakan CloseWatcher dan Navigation API memakai watcher hanya ketika tidak ada entri sebelumnya di scope role yang sama. Watcher dikonsumsi saat popup muncul, sehingga Back kedua tidak ditahan. Perubahan rute, kembali dari background, dan BFCache memperbarui pengaman. Popup memakai portal, mengunci scroll/fokus, mendukung tema gelap, dan membuat konten belakang inert sementara. Escape dari keyboard membatalkan popup.

Fallback mesin lama menggunakan satu pasangan entri History API, mempertahankan metadata router Next.js. Pembatalan memakai forward ke entri yang sama agar tidak menambah riwayat berulang. Fallback dibatasi oleh kebijakan browser terhadap riwayat sintetis sebelum interaksi pengguna; tidak dapat menjamin intersepsi native pada semua versi Android lama. Aplikasi tidak memakai window.close() atau beforeunload untuk memaksa penutupan.

Validasi: tes controller untuk empat role, navigasi turunan, Back kedua, batal berulang, state router, remount, resume, cleanup, dan pengecualian rute publik. Chrome lokal menjalankan komponen popup asli pada viewport 390 dan 320 px, tema terang/gelap, CloseWatcher melalui sinyal Escape, ketuk dalam/luar, pemeriksaan tanpa tombol, navigasi mundur, dan marker sesi yang tetap tersimpan. Back kedua pada fixture dapat meninggalkan halaman. Pengujian ini bukan pengujian tombol sistem/minimize pada perangkat Android fisik; verifikasi perangkat tetap diperlukan untuk perilaku OS dan vendor browser.

Referensi platform: [CloseWatcher](https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher) dan [intervensi riwayat Chromium](https://chromium.googlesource.com/chromium/src/+/refs/tags/135.0.7049.0/docs/history_manipulation_intervention.md).

Pemeriksaan rilis: `npm run check` lulus (lint 0 error/18 warning lama, seluruh tes aplikasi lulus, build 77 halaman dan pemeriksaan secret 146 file client lulus); sembilan tes khusus pengaman juga dijalankan ulang setelah audit akhir. Build lokal mencatat fetch platform_settings gagal karena koneksi lingkungan, tetapi proses build selesai dengan exit 0. Tidak ada perubahan database.
