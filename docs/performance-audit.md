# Audit performa OKESIH — 18 Oktober 2026

## Cakupan dan batas pengukuran

Audit struktur 23 halaman, 38 API route, komponen bersama, hook, dependensi, proxy autentikasi, service worker, aset publik, dan 21 migrasi SQL. Pemeriksaan bersumber dari kode lokal; jumlah query di bawah adalah perhitungan jalur kode, bukan hasil profiler database produksi. Belum ada pengukuran Core Web Vitals dari perangkat pengguna, EXPLAIN ANALYZE database produksi, atau uji transaksi menggunakan akun/perangkat produksi.

Arsitektur saat ini: satu aplikasi Next.js App Router dengan origin terpisah untuk publik, owner, superadmin, marketing, POS, dan KDS. Supabase menyediakan autentikasi, Postgres, Storage, dan realtime. POS/KDS memakai cookie pairing perangkat serta snapshot/antrean IndexedDB. Vercel menjalankan API, termasuk OCR Tesseract khusus unggahan billing.

## Perubahan yang diterapkan

| Area | Sebelum | Sesudah |
| --- | --- | --- |
| Polling POS/KDS | Interval 3 detik dan realtime dapat membuat request bersamaan; tetap polling di tab tersembunyi | Satu request bootstrap berjalan per instance hook; polling/realtime refresh diabaikan ketika tersembunyi/offline; refresh saat kembali terlihat |
| Histori POS | Mengambil sampai 200 transaksi beserta item dan bukti pada setiap polling | Lengkap pada bootstrap awal dan layar histori; polling layar lain memakai `history=0`; histori sebelumnya dipertahankan dalam snapshot |
| Bootstrap KDS | Mengambil menu, meja, pelayan, shift yang tidak digunakan layar KDS | Empat query tersebut tidak dijalankan; kontrak array kosong/null dipertahankan |
| Bukti transfer | Satu permintaan Storage untuk setiap order berbukti | Satu `createSignedUrls` dengan path unik per bootstrap yang memiliki bukti |
| IndexedDB | Membuka koneksi baru setiap operasi tanpa menunggu commit penulisan | Koneksi dipakai ulang, direset saat ditutup/upgrade, penulisan dan penghapusan ditunggu sampai commit |
| QR owner | Pustaka QR diimpor statis; preview dibuat pada semua submenu | Import saat preview/cetak diperlukan; preview hanya pada `/owner/qris-tables` |
| Menu pelanggan | Splash menutup menu sampai 3,2 detik dan tombol lewati tidak ditampilkan | Splash dilewati di `/menu/*` |
| Instalasi PWA | Gambar hero mentah 1.858.957 byte masuk precache di setiap origin | Precache publik dibatasi ke ikon, audio, SVG, dan manifest; hero dimuat sesuai kebutuhan halaman |
| Lifecycle service worker | Registrasi otomatis Serwist ditambah registrasi manual; cleanup async tidak dipakai effect | Registrasi manual tunggal; listener online dan interval pemeriksaan update dibersihkan saat unmount |
| Grafik pendapatan | Membuat Intl.DateTimeFormat baru per transaksi dan mencari bucket secara linear | Formatter dipakai ulang dan bucket diakses melalui Map |

Polling pesanan aktif tetap 3 detik. Tidak diasumsikan bahwa subscription realtime perangkat selalu menerima event: hal ini bergantung pada autentikasi/RLS. Setelah mutation, refresh menunggu pembacaan sebelumnya selesai agar respons lama tidak menggantikan hasil pembacaan terbaru.

Perhitungan dampak: tab terlihat dengan polling 3 detik menghasilkan sekitar 1.200 bootstrap/jam, di luar realtime/mutation. Pada KDS, penghapusan empat query berarti sekitar 4.800 query/jam/perangkat dihindari dalam kondisi tersebut. Pada POS, payload histori 200 transaksi dihindari pada polling rutin di luar layar histori. Angka ini bukan klaim peningkatan latency dalam persentase.

## Temuan struktural dan prioritas berikutnya

### P1 — Agregasi dan pagination database

- `src/app/api/superadmin/tenants/route.ts`: tiga pengambilan awal diikuti dua query per tenant. Biaya bertambah menjadi 3 + 2N query sebelum memperhitungkan autentikasi. Gunakan agregasi SQL/RPC dan pagination tenant; jangan mengganti count dengan pengambilan seluruh transaksi ke Node.
- `src/app/api/marketing/dashboard/route.ts`: mengambil transaksi lintas tenant untuk menghitung jumlah/komisi dalam JavaScript. Dashboard owner dan revenue juga menghitung dari daftar baris. Pengambilan tanpa pagination berisiko terpotong oleh batas respons PostgREST yang dikonfigurasi. Agregasi SQL diperlukan untuk performa sekaligus ketepatan angka pada volume besar.
- Histori POS masih dibatasi 200 transaksi; filter tanggal tidak berarti seluruh riwayat database tersedia. Perlu endpoint histori berpagination dan agregat periode tersendiri.
- Migrasi repository sudah memiliki indeks transaksi `(warkop_id, status_pesanan, created_at DESC)`. Tidak ditemukan indeks eksplisit `transaction_items(transaction_id)` maupun `(warkop_id, created_at)` untuk histori tanpa filter status. Verifikasi indeks aktual dan rencana query produksi sebelum menambah indeks; migrasi lokal tidak membuktikan kondisi database aktif.

### P1 — Pecah komponen dan data dashboard

- `src/app/superadmin/page.tsx`: 4.316 baris pada baseline, seluruh tab dalam satu Client Component. Ada pemuatan awal data tenant/marketing/withdrawal/pengajuan dan pemuatan ulang berbasis tab. Pecah per fitur, muat data tab sesuai kebutuhan, pertahankan data ringkasan yang memang ditampilkan dashboard.
- `src/app/owner/page.tsx`: 2.128 baris pada baseline. Submenu me-reexport komponen ini sehingga pemisahan URL belum memisahkan implementasi fitur. Pindahkan shell/provider ke layout dan konten ke route masing-masing, lalu pisahkan payload dashboard dari menu/staf/meja. Jangan sekadar memindahkan kode ke banyak file tanpa batas lazy loading atau server/client yang jelas.
- POS adalah Client Component besar (1.561 baris baseline), tetapi interaksi kasir memang memerlukan client. Pisahkan tabel histori, modal audit, dan pencetakan agar interaksi pesanan aktif lebih terisolasi.

### P2 — CSS dan render halaman publik

- `src/app/globals.css`: 7.179 baris / 235.025 byte sumber; artefak build yang tersedia sebelum audit berukuran 201.547 byte, sekitar 35.958 byte gzip. Semua route mengimpor stylesheet global lewat root layout.
- Pisahkan stylesheet fitur ke layout/komponen terkait setelah memetakan selector bersama dan urutan override. Perlu uji visual mode terang/gelap serta lebar 360, 768, dan 1280 piksel; pemisahan otomatis berisiko mengubah cascade.
- Landing dan marketing masih banyak merender melalui Client Components. Pindahkan konten statis ke server dan pertahankan island interaktif untuk navigasi/form/modal.
- Hero sudah memakai `next/image`, `sizes`, dan prioritas, sehingga ukuran PNG sumber bukan ukuran transfer hero ke browser. Penghematan yang langsung pasti pada rilis ini adalah pengeluaran PNG mentah dari precache.
- Gambar logo/bukti lain memakai `<img>` atau gambar unoptimized. Evaluasi ukuran unggahan dan dimensi tampilan; jangan menyamakan semua gambar dengan kebutuhan hero.

### P2 — Data, autentikasi, dan offline

- Proxy memanggil `auth.getUser()` untuk setiap request yang cocok, termasuk sebagian API yang melakukan autentikasi lagi. Ukur jumlah validasi jaringan untuk request bersesi; pengguna anonim tidak selalu menyebabkan panggilan auth jaringan. Optimasi harus mempertahankan guard superadmin dan penyegaran cookie.
- Metadata menu/meja/pelayan POS masih dikirim setiap polling. Pisahkan metadata berversi dari pesanan setelah ada invalidasi perubahan owner yang jelas.
- Snapshot masih ditulis pada setiap refresh sukses. Deduplikasi berdasarkan versi data dapat mengurangi I/O, tetapi waktu validasi izin offline harus tetap diperbarui terpisah; melewati write sembarangan bisa mengubah batas offline.
- MarketingProvider merespons focus dan visibilitychange tanpa deduplikasi; dapat digabung dengan pola request bersama setelah diuji pada pergantian akun.
- Service worker masih mem-precache chunk aplikasi lintas fitur. Audit manifest per origin sebelum memecah strategi cache agar POS/KDS offline tetap memiliki chunk yang dibutuhkan.
- Fallback navigasi service worker dapat memilih cache `/pos` untuk kegagalan halaman lain. Pisahkan fallback sesuai surface saat mengerjakan refaktor offline.

### P2 — OCR dan operasional

- Tesseract dipakai pada server, bukan bukti bahwa seluruh browser mengunduh OCR. Worker/data OCR disertakan khusus route billing melalui tracing config.
- `recognize()` menginisialisasi OCR untuk unggahan. Ukur cold start, memori, durasi, dan konkurensi sebelum memilih worker reuse atau antrean pekerjaan; pemakaian worker global tanpa pembatasan dapat memperburuk beban.
- Endpoint health memakai `auth.getSession()` dan bukan probe query database. Hasilnya belum cukup sebagai bukti kesehatan database ataupun latency query.

## Kriteria verifikasi lanjutan

1. Uji perangkat POS/KDS dengan jaringan lambat, tab tersembunyi, kembali online, pencabutan pairing, dan perubahan status simultan. Pastikan tidak ada pesanan hilang/duplikat.
2. Uji histori saat pertama dibuka, kembali dari layar kasir, offline, serta setelah mutation; validasi hasil berdasarkan kontrak maksimal 200 transaksi yang ada.
3. Profil payload bootstrap dan query dengan tenant 100/1.000/10.000 transaksi; ukur p50/p95, bukan hanya ukuran kode.
4. Bandingkan build produksi pada perangkat/viewport dan kondisi jaringan yang sama. Catat JS/CSS transfer, long tasks, LCP, INP, CLS, dan waktu sampai daftar pesanan bisa dioperasikan.
5. Terapkan agregasi/pagination dan pemisahan UI sebagai tahap berikutnya dengan pemeriksaan hasil keuangan dan regresi visual tersendiri.

## Validasi perubahan rilis ini

- Build produksi dan pemeriksaan kebocoran secret: lulus.
- TypeScript: lulus.
- Tes PWA: 14/14 lulus.
- ESLint: 0 error, 25 warning yang masih perlu ditangani terpisah.
- Chrome headless dengan hook asli dan API/auth stub: penggabungan refresh, jeda tab tersembunyi, refresh foreground, retensi histori pada polling ringan, commit/hapus antrean dan snapshot IndexedDB lulus tanpa page error.
- API bootstrap dengan adapter database fixture: POS lengkap 9 query data, POS tanpa histori 8, KDS 3; satu batch signing dan pemetaan item/bukti lulus pada empat kombinasi perangkat/parameter histori. Angka tidak memasukkan query autentikasi.
- Artefak build: hero tidak ada di service worker; ikon/audio tetap ada; QR muncul pada manifest dynamic import.

Uji browser lokal memakai API/auth stub untuk memeriksa perilaku hook dan IndexedDB nyata; ini bukan uji transaksi terhadap Supabase produksi. Status deployment dicatat pada ringkasan pekerjaan.
