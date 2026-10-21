# Operasi, pemulihan, dan pemantauan

## Pemeriksaan rilis

1. Jalankan `npm run check` dan migrasi lengkap pada database disposable.
2. Periksa riwayat migrasi produksi dan preflight constraint (nilai negatif, referensi lintas tenant, duplikasi). Jangan memperbaiki data keuangan dengan menebak.
3. Pastikan backup database tersedia pada dashboard Supabase. Backup database tidak otomatis mencakup file Storage; siapkan salinan bucket privat terpisah sesuai kebijakan operator.
4. Terapkan migrasi, deploy commit yang sama, lalu periksa status Vercel, `/api/health`, login owner, pairing POS/KDS, konfirmasi pesanan, dan review billing dengan akun uji yang diizinkan.
5. Rollback aplikasi hanya ke versi yang kompatibel dengan skema. Jangan rollback migrasi ledger dengan menghapus data.

## Retensi dan cleanup

Cron `/api/cron/cleanup-billing-proofs` memerlukan `Authorization: Bearer CRON_SECRET`. Atur secret pada Vercel; jangan mencatat nilainya. Bukti billing PAID kedaluwarsa 90 hari sejak unggah, bukan tanggal tagihan. Bukti menunggu review tetap tersedia. Penghapusan file memakai antrean yang dapat dicoba ulang; referensi aktif dicek sebelum file dihapus. Arsip tenant mengantrekan bukti transaksi dan billing. Monitor backlog `storage_cleanup_jobs`, kegagalan storage, dan respons cron non-2xx.

Idempotency transaksi dipertahankan agar retry lama tidak membuat transaksi duplikat. Jangan menghapus ledger/idempotency tanpa kebijakan bisnis tersendiri. Upload publik yang terputus sebelum transaksi tersimpan berpotensi meninggalkan file yatim; lakukan inventaris Storage dan pencocokan referensi sebelum menghapusnya.

## Pemantauan

Pantau error 5xx, latensi p95 bootstrap/order/billing, respons limiter 429, konflik 409, backlog sinkronisasi perangkat, RSS proses OCR, dan backlog cleanup. Health hanya menampilkan status dan timestamp; detail internal tidak dipublikasikan. Tetapkan ambang berdasarkan pengukuran traffic nyata, jangan mengklaim kapasitas berdasarkan build lokal.

## Backup dan latihan restore

Operator perlu mencatat jadwal backup, periode retensi, RPO/RTO, serta ketersediaan PITR sesuai paket Supabase. Pulihkan backup ke proyek staging terisolasi; jangan overwrite produksi. Verifikasi jumlah tenant, relasi item/transaksi, total billing/komisi, akses RLS, serta ketersediaan bukti Storage. Catat tanggal, snapshot, durasi, hasil checksum/agregat, dan hasil smoke test. Hapus akses staging setelah drill sesuai kebijakan.

## Kredensial owner lama

Password baru dibuat secara acak. Inventaris owner yang belum mengganti password awal dari `owner_onboarding`, lalu gunakan alur reset terverifikasi untuk merotasi kredensial lama. Jangan mencetak atau mengirim password melalui log/issue. Jangan menganggap guard onboarding sudah membatalkan password lama: rotasi akun lama dan pencabutan sesi perlu pelaksanaan terpisah dengan kanal pemulihan yang terverifikasi.

## Batas verifikasi

Keberadaan runbook bukan bukti backup atau restore berhasil. Uji printer, instalasi PWA iOS/Android, koneksi terputus lama, dan beban multi-perangkat harus dicatat dari perangkat/lingkungan nyata.
