# Agregasi dan pagination reporting

## Perubahan

Migrasi `22_reporting_aggregation.sql` menambahkan lima RPC scalar JSONB. PostgREST mengembalikan satu objek, sehingga total transaksi/komisi tidak bergantung pada batas jumlah baris respons. Seluruh RPC memakai `SECURITY INVOKER`; EXECUTE dicabut dari PUBLIC, anon, dan authenticated, lalu diberikan hanya kepada service_role. API tetap memvalidasi role, keanggotaan owner/marketing, atau pairing POS sebelum menentukan tenant dari sesi server.

- `report_superadmin_tenants`: filter dan pagination tenant di SQL, agregasi transaksi untuk tenant pada halaman, serta total tenant/provinsi global. Menggantikan 3 + 2N panggilan data dengan satu RPC. Overview tetap memakai analytics global, tidak menjumlahkan halaman aktif.
- `report_marketing_dashboard`: agregasi struk sah, komisi, utang, dan saldo pencairan di SQL. Tarif komisi tetap memakai tarif tenant saat ini, sama dengan fungsi pencairan yang sudah ada. Ringkasan pending mencakup seluruh pencairan, meskipun daftar riwayat tetap 25 terbaru. Utang hanya mencakup tagihan belum lunas, bukan tagihan PAID terbaru.
- `report_transaction_summary`: count seluruh status, count struk sah, cash, QRIS, dan omzet dalam rentang `[start,end)`. VOID/REJECTED tidak masuk omzet. Digunakan dashboard owner dan ringkasan histori POS.
- `report_owner_revenue`: bucket tiga jam/harian/bulanan dan total dihitung di database. Periode menggunakan Asia/Makassar; Senin awal minggu; bucket kosong tetap dikirim.
- `report_device_history`: count hasil filter serta detail satu halaman, termasuk item dan nama kasir historis. Urutan `created_at DESC,id DESC` menangani timestamp yang sama. Offset pagination dapat bergeser ketika ada transaksi baru; tombol sinkron memuat kondisi terbaru.

Daftar tenant/pengajuan marketing tetap mengikuti kontrak UI yang sudah ada dan dibentuk sebagai JSON di SQL; tidak lagi dibatasi max_rows PostgREST. Ini bukan pagination UI marketing. Riwayat POS dan daftar tenant superadmin menggunakan pagination server.

## API

`GET /api/superadmin/tenants?page=1&pageSize=25&search=...&province=...`

Mengembalikan `data`, `pagination { page,pageSize,total,totalPages }`, `totalTenants`, dan `provinces`. Search mencakup nama, slug, owner, provinsi, kota. Batas pageSize 100; pencarian maksimal 120 karakter. Seluruh input divalidasi sebelum RPC.

`GET /api/device/history?period=today&page=1&pageSize=25&status=ALL&payment=ALL&search=...`

Mengembalikan `orders` dan `pagination`. Hanya POS terpasang pada tenant tersebut yang dapat mengakses. Jika owner mengaktifkan PIN audit, header `X-Audit-Pin` harus cocok; PIN hanya disimpan dalam state browser setelah verifikasi dan dikosongkan saat audit dikunci. Endpoint tidak menerima tenant ID dari browser. Bukti transfer ditandatangani satu batch untuk halaman itu, tanpa mengekspos path Storage sebagai URL publik.

`GET /api/device/history/summary?period=today`

Mengembalikan `data { transactionCount,receiptCount,cash,qris,total }` untuk seluruh periode. KPI tidak berubah ketika pengguna berpindah halaman atau menyaring status/metode/pencarian. Ini mempertahankan makna ringkasan periode; count seluruh status dilabeli eksplisit pada UI.

Pilihan periode: `today`, `this_week`, `this_month`, `this_year`, `all`, atau `custom&start=YYYY-MM-DD&end=YYYY-MM-DD`. Tanggal custom akhir inklusif bagi pengguna dan dikonversi menjadi batas eksklusif hari berikutnya di WITA. Rentang terbalik/tanggal tidak sah ditolak HTTP 400.

Histori online disegarkan saat dibuka, filter berubah, tombol sinkron ditekan, setelah perubahan status pesanan, saat kembali online/visible, dan setiap 30 detik saat terlihat. Respons usang dibatalkan. Ringkasan tidak diambil ulang hanya karena halaman berubah. Polling pesanan aktif tetap memakai jalur operasional yang sudah ada.

Saat offline, POS menampilkan snapshot lokal terbatas dengan label jelas; KPI seluruh periode tidak ditampilkan sebagai angka nol atau dianggap lengkap. Pagination offline hanya membagi snapshot tersebut. Bootstrap lama masih kompatibel dan menyediakan snapshot awal maksimal 200 transaksi; pembatasan itu tidak berlaku untuk endpoint histori online baru.

## Verifikasi indeks produksi

Inspeksi `pg_indexes` sebelum migrasi menemukan indeks `(warkop_id,status_pesanan,created_at DESC)`, namun tidak menemukan indeks item berdasarkan transaction_id atau histori tenant tanpa status. EXPLAIN ANALYZE/BUFFERS pada query histori dan item dilakukan sebelum migrasi. Tabel saat inspeksi kecil (sekitar 62–63 transaksi dan 121 item); sequential scan dan sort merupakan pilihan planner yang wajar, bukan bukti regresi.

Migrasi `23_reporting_indexes.sql` menambahkan:

- `idx_transaction_items_transaction_id` pada `transaction_items(transaction_id)`.
- `idx_transactions_warkop_created_id` pada `transactions(warkop_id,created_at DESC,id DESC)`.

Indeks diterapkan sesudah pemeriksaan database aktif, dengan lock_timeout 5 detik. Tidak ada indeks lama yang dihapus. Query plan diperiksa kembali setelah migrasi; tidak ada klaim persentase penurunan latency dari sampel produksi yang kecil. Pada tabel besar, strategi deployment indeks perlu mempertimbangkan CREATE INDEX CONCURRENTLY tersendiri.

## Pengujian dan deployment

- Tes parser dan batas WITA: `npm run test:reporting`.
- Regresi PWA: `npm run test:pwa`.
- TypeScript/build dan pemeriksaan secret bundle: `npm run build`.
- SQL: `scripts/test-reporting.sql` memerlukan database disposable bernama tepat `okesih_reporting_test`; gagal sebelum insert jika nama database berbeda. Semua data sintetis di-rollback.

Untuk tes SQL, buat database lokal kosong dengan role `anon`, `authenticated`, `service_role`, lalu jalankan:

```sh
psql -d okesih_reporting_test -v ON_ERROR_STOP=1 \
  -f scripts/fixtures/reporting-schema.sql \
  -f supabase/migrations/22_reporting_aggregation.sql \
  -f supabase/migrations/23_reporting_indexes.sql \
  -f scripts/test-reporting.sql
```

Fixture hanya struktur kolom, tanpa data produksi atau trigger usaha. Tes mencakup 1.205 struk sah, 72 tenant, 30 pending withdrawals, timestamp sama, pencarian item di luar 200 transaksi, filter gabungan, tenant lain, batas midnight WITA, periode kosong, omzet VOID/REJECTED, utang, dan permission RPC. Kompatibilitas tipe enum dan fungsi juga diperiksa terhadap database produksi dalam transaksi yang di-rollback sebelum migrasi diterapkan.

Migrasi 22 dan 23 diterapkan melalui Supabase CLI setelah dry-run memastikan hanya kedua file tersebut yang tertunda; tidak menjalankan seed, perubahan role tambahan, atau Vault. Bentuk respons RPC diverifikasi melalui REST produksi, termasuk penolakan akses anonim. Uji UI menggunakan API simulasi dan tidak membuat transaksi usaha produksi.

Migrasi bersifat tambahan: bila perlu rollback aplikasi, versi sebelumnya tetap kompatibel. Jangan menghapus RPC selama deployment baru masih melayani request. Status commit/deployment Vercel dilaporkan pada ringkasan pekerjaan.

Hasil uji browser: komponen superadmin lulus navigasi halaman, reset halaman saat pencarian, dan retensi total global. Build POS lulus alur PIN, pagination, pencarian, ringkasan terpisah, label offline, serta pemeriksaan overflow pada viewport 1280 dan 360 piksel. Interaksi tab histori desktop diuji dengan klik DOM terarah karena overlap header yang sudah ada; perubahan ini tidak merombak layout header.
