# OKESIH.COM

Aplikasi POS dan KDS berbasis Next.js, React, Supabase, dan Serwist. Penyimpanan offline memakai IndexedDB native. Halaman `/tv` merupakan demo dan belum terhubung ke antrean operasional.

## Alur bisnis

- Pelanggan membuat pesanan `AWAITING_CONFIRMATION`. Omzet dihitung setelah kasir mengonfirmasi (`COOKING`, `READY`, `DONE`). Pesanan langsung dari kasir dikonfirmasi pada saat dibuat.
- Unggah bukti tagihan SaaS menghasilkan `PENDING_REVIEW`. OCR hanya membantu membaca teks. Superadmin memeriksa penerimaan dana dan memasukkan referensi pembayaran sebelum menyetujui pelunasan. Distribusi komisi dilakukan atomik oleh database.
- Aksi arsip tenant menonaktifkan tenant, mencabut perangkat, dan menghapus transaksi, billing, serta komisi terkait tenant secara atomik. Profil dan akun tetap ada. Bukti di Storage masuk antrean penghapusan.
- POS/KDS mempertahankan operasi gagal sinkron. Konflik perlu dicoba ulang atau diabaikan secara eksplisit. Masa offline dihitung dari validasi server terakhir dan tidak diperpanjang oleh perubahan lokal.

## Pengembangan

Gunakan Node.js 22. Salin `.env.example` ke `.env.local`, isi konfigurasi Supabase, lalu:

```sh
npm ci
npm run dev
```

Server memakai `SUPABASE_SERVICE_ROLE_KEY`; browser hanya memakai URL dan anon key publik. Jangan memasukkan kunci server ke variabel `NEXT_PUBLIC_*`.

```sh
npm run check
```

Perintah tersebut menjalankan lint, tes, build, dan pemindaian secret pada bundle browser. Build membutuhkan akses Google Fonts. Tes database memakai PostgreSQL disposable kosong bernama `okesih_remediation_test`:

```sh
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/okesih_remediation_test npm run test:database
```

Jangan menjalankan fixture database pada produksi. CI menjalankan seluruh migrasi dan tes regresi di PostgreSQL terpisah.

## Operasi dan deployment

Branch `main` memicu deployment Vercel. Terapkan migrasi yang sudah diuji sebelum merilis aplikasi yang membutuhkan RPC/kolom baru. `CRON_SECRET` harus tersedia di Vercel untuk endpoint cleanup; header User-Agent tidak memberikan otorisasi.

Route utama: `/owner`, `/superadmin`, `/marketing/dashboard`, `/pos`, `/kds`, `/menu/[warkopId]`, `/scan`, dan demo `/tv`.

Lihat [laporan audit](docs/audits/2026-10-20/laporan-audit.md), [rencana perbaikan](docs/audits/2026-10-20/rencana-perbaikan.md), dan [runbook operasi](docs/operations.md). Tidak ada worker WhatsApp Desktop dalam repositori ini; tautan WhatsApp dibuka dan dikirim oleh pengguna.
