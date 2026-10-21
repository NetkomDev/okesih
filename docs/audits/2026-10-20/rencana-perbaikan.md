# Rencana dan pelacakan perbaikan audit

Baseline: laporan-audit.md, temuan A01–A23. Pelaksanaan dimulai 20 Oktober 2026.

## Urutan dan aturan rilis

1. Tutup celah otorisasi dan privasi, tambahkan migrasi pembatas akses serta tes regresi.
2. Perbaiki transaksi atomik, idempotency, billing per-shift, reporting, dan sinkronisasi offline.
3. Perkuat limiter, lifecycle OCR, performa, quality gate, retensi, dan dokumentasi operasi.
4. Jalankan pengujian lokal/integrasi database disposable; periksa migrasi produksi sebelum penerapan; build dan deploy; verifikasi hasil.

Setiap temuan ditutup hanya bila implementasi dan pengujian relevan selesai. Pengujian beban/perangkat fisik, restore backup, dan rotasi kredensial lama tidak boleh diklaim selesai tanpa bukti. Migrasi tidak menghapus data historis secara massal. Penghapusan transaksi, billing, dan komisi hanya melalui aksi arsip tenant yang secara eksplisit disepakati pengguna.

## Daftar pekerjaan dan penerimaan

| ID | Perbaikan | Bukti penerimaan | Status |
| --- | --- | --- | --- |
| A01 | OCR untuk ekstraksi; settlement hanya setelah review admin terautentikasi; referensi settlement unik dan audit atomik | Unggah tidak PAID; replay referensi ditolak; komisi sekali | Selesai / Teruji |
| A02 | Password CSPRNG, guard onboarding server, inventaris akun lama untuk rotasi terarah | Password tidak diturunkan dari slug; API bisnis menolak onboarding belum selesai | Selesai / Teruji |
| A03 | Cron wajib secret, tanpa bypass User-Agent | Uji missing/wrong/spoofed/correct secret | Selesai / Teruji |
| A04 | Cabut RPC waiter lama dari publik; search_path dan lock | ACL fixture dan uji peran (migrasi 26) | Selesai / Teruji |
| A05 | RLS aktif per peran; mutasi bisnis hanya server/RPC | Dua tenant, staf nonaktif, direct REST tidak dapat mutasi (migrasi 26) | Selesai / Teruji |
| A06 | Hilangkan SELECT profil privat dari anon; menu tetap via API whitelist | Anon ditolak tabel privat; API publik tetap berfungsi (migrasi 26) | Selesai / Teruji |
| A07 | Hash PIN khusus, limiter, histori hanya endpoint terproteksi, tanpa snapshot histori sensitif | PIN salah ditolak; bootstrap tidak membocorkan histori | Selesai / Teruji |
| A08 | Forgot-password generik, tanpa lookup/respons PII; kanal bantuan hanya input pengguna | Respons seragam, tidak membocorkan keberadaan akun | Selesai / Teruji |
| A09 | Key stabil per intent; hash payload; creation/status/shift/audit atomik; token tracking stabil | Retry, concurrent key, payload berbeda, lost response (migrasi 28) | Selesai / Teruji |
| A10 | Agregasi billing hari; query tunggakan independen dari histori terakhir | Dua billing/hari dan tunggakan >15 entri (migrasi 27) | Selesai / Teruji |
| A11 | Arsip/nonaktifkan tenant dan hapus transaksi, billing, komisi secara atomik | Akun tenant tetap tersimpan; keuangan terhapus; perangkat dicabut; rollback utuh bila gagal (migrasi 27) | Selesai / Teruji |
| A12 | Waktu validasi server tetap; expiry; antrean gagal disimpan; rekonstruksi optimistic; isolasi perangkat/shift | Offline lama/reload/409/429/5xx/revocation tidak hilangkan operasi diam-diam | Selesai / Teruji |
| A13 | Guard tenant aktif pada perangkat dan RPC mutasi | Tenant nonaktif ditolak, owner tetap dapat melunasi | Selesai / Teruji |
| A14 | Saldo dari SQL; status pendapatan eksplisit; lock shift/order | >1.000 mutasi sesuai SQL; pending tidak dihitung; race tutup shift (migrasi 29) | Selesai / Teruji |
| A15 | Bootstrap order/item lengkap dengan pagination stabil; order lama tetap aktif | >1.000 item dan pesanan aktif >24 jam (readAllRows) | Selesai / Teruji |
| A16 | Limiter database; kode CSPRNG; konflik kode dan approval atomik | Limiter lintas instance, expired code, concurrent approve (migrasi 26) | Selesai / Teruji |
| A17 | Worker OCR terminable, bounded queue/deadline/dimensi; upload <= platform | Timeout membersihkan worker; queue penuh ditolak; file besar ditolak | Selesai / Teruji |
| A18 | Precache aset terbatas, polling adaptif dengan fallback, metrik build | Bandingkan ukuran precache, jeda background dan backoff | Selesai / Teruji |
| A19 | Await heartbeat perangkat dan cek error | Fetch heartbeat benar-benar terpanggil | Selesai / Teruji |
| A20 | Label demo eksplisit atau integrasi TV sesuai keputusan | Tidak ada klaim antrean produksi pada data simulasi | Selesai / Teruji |
| A21 | Secret scanner memuat env, decode JWT, fail closed, tes fixture | Secret/JWT role server ditolak; public anon diizinkan | Selesai / Teruji |
| A22 | Perbaiki lint, satu test/check, CI, README sesuai implementasi | Lint/build/tests lulus dan workflow tersedia | Selesai / Teruji |
| A23 | Constraint tenant/nilai, WITA, audit/error handling, retensi waktu upload, health minimal, runbook backup/metrics | SQL fixture, cleanup tanpa efek samping GET, health tidak bocorkan runtime (migrasi 30) | Selesai / Teruji |

## Ketergantungan dan keputusan

- Migrasi baru harus diterapkan sebelum aplikasi yang memanggil RPC/kolom baru dirilis.
- Limiter dan PIN dibangun sebelum endpoint sensitif diaktifkan kembali.
- Perubahan settlement memerlukan penyesuaian UI owner/superadmin bersamaan.
- Penonaktifan karena `is_active=false` ditegakkan; suspend otomatis karena tunggakan tidak ditambahkan tanpa aturan bisnis yang disepakati.
- Metrik operasional, restore drill, serta pengujian perangkat riil memerlukan akses/lingkungan yang sesuai; catat batasnya secara eksplisit.

## Keputusan pengguna (21 Oktober 2026)

- A01: unggah bukti masuk PENDING_REVIEW; pelunasan memerlukan persetujuan Superadmin.
- A11: arsip/nonaktif tenant disertai penghapusan transaksi, billing, dan komisi terkait tenant. Penarikan saldo mitra yang tidak terkait satu tenant tidak dihapus.
- A14: omzet diakui setelah konfirmasi kasir (COOKING, READY, DONE).
- A20: halaman TV berlabel demo hingga integrasi antrean operasional tersedia.
