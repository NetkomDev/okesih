# Arsitektur Subdomain Aplikasi OKESIH

Seluruh aplikasi memakai deployment Vercel yang sama, tetapi dipisahkan berdasarkan origin agar cookie sesi, storage, service worker, dan riwayat navigasi tidak bercampur.

| Aplikasi | Origin produksi | Entry point | Akses utama |
| --- | --- | --- | --- |
| Publik | `https://www.okesih.com` | `/` | Situs, menu publik, pendaftaran sales |
| Super Admin | `https://admin.okesih.com` | `/superadmin` | Role `SUPERADMIN` |
| Owner | `https://owner.okesih.com` | `/owner` | Role `OWNER` |
| Sales | `https://sales.okesih.com` | `/marketing/dashboard` | Role `MARKETING` |
| Kasir POS | `https://pos.okesih.com` | `/pos` | Perangkat POS yang dipairing |
| Dapur KDS | `https://kds.okesih.com` | `/kds` | Perangkat KDS yang dipairing |

## Aturan keamanan

- Request halaman pada origin yang salah diarahkan ke origin kanonisnya.
- API Owner, Super Admin, Sales, serta API perangkat hanya tersedia pada origin yang sesuai.
- Login akun internal dilakukan pada subdomain tujuan sehingga cookie autentikasi tetap host-only.
- Dashboard berautentikasi tidak disimpan dalam cache navigasi offline service worker.
- POS dan KDS mempunyai manifest PWA serta storage yang terpisah berdasarkan origin.

## Migrasi perangkat

Pemisahan origin mengubah ruang penyimpanan browser. Setelah rilis pertama, hapus instalasi PWA lama yang berasal dari domain utama, pasang ulang dari subdomain tujuan, lalu lakukan pairing POS/KDS satu kali. Setelah itu sesi perangkat tetap dipertahankan pada origin masing-masing.
