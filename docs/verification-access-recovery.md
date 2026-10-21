# Verifikasi pendaftaran dan pemulihan akses

## Temuan audit

1. Persetujuan membuat akun autentikasi dan menyimpan status terlebih dahulu. `wa.me` hanya membuka draf pesan; tidak memberikan bukti bahwa pesan terkirim, diterima, atau nomor tersebut milik pendaftar.
2. Nomor dengan format benar masih dapat merupakan nomor orang lain. Validasi format tidak menggantikan konfirmasi identitas penerima.
3. Password awal tidak dapat dibaca ulang dari Supabase Auth. Mengaktifkan ulang marketing yang sudah memiliki `user_id` tidak membuat pesan kredensial baru. Tenant yang disetujui juga keluar dari antrean pengajuan.
4. Sebelumnya tenant baru menyiapkan URL WhatsApp setelah membuat akun. Kegagalan pada tahap ini dapat mengembalikan pengajuan ke `PENDING` meskipun tenant dan owner sudah dibuat. Kesalahan penyimpanan status akhir juga tidak diperiksa.

## Alur yang diterapkan

- Sebelum persetujuan, Super Admin diminta memeriksa nama dan nomor penerima. Pengajuan pending menyediakan koreksi nomor sebelum akun dibuat.
- Daftar Marketing dan Tenant menyediakan **Perbaiki WA & akses**. Nomor baru wajib dikonfirmasi melalui pendaftar atau marketing pengaju.
- Menyimpan nomor saja tidak mengganti password. Untuk akun aktif, opsi **Reset password dan siapkan pesan akses baru** mengubah password pada akun autentikasi yang sama. Username, tenant, relasi marketing, dan riwayat transaksi tidak dibuat ulang.
- Password baru dihasilkan acak secara kriptografis. Password lama tidak dapat dipakai untuk login baru. Sesi yang sudah terbit tidak otomatis dicabut oleh fitur ini.
- Setelah reset, admin dapat membuka ulang tombol WhatsApp selama modal hasil tetap terbuka. Tidak perlu melakukan reset setiap kali membuka tombol tersebut. Jika halaman ditutup atau respons reset hilang, lakukan reset kembali untuk menghasilkan password baru.
- Pesan tetap harus dikirim manual melalui WhatsApp. Hasil UI menyebut **pesan siap dikirim**, bukan **pesan berhasil terkirim**.

## Pengamanan dan konsistensi

Endpoint `/api/superadmin/account-access` memerlukan sesi dengan peran Super Admin dari `app_metadata`, pemeriksaan origin, validasi masukan, dan konfirmasi penerima. Sebelum reset, identitas akun autentikasi harus cocok dengan role serta ID tenant/marketing. Tenant nonaktif/diarsipkan dan marketing nonaktif tidak dapat direset melalui alur ini.

Koreksi nomor disinkronkan ke `marketing_agents` atau pengajuan tenant terkait. Kegagalan sinkronisasi tidak dilanjutkan ke reset password. Pesan error menjelaskan jika nomor utama sudah tersimpan sehingga admin dapat mengulang tanpa membuat akun baru.

Audit mencatat pelaku, target, nomor lama/baru, permintaan, dan hasil tindakan. Password dan URL WhatsApp berisi password tidak dicatat dalam audit atau disimpan di localStorage. Respons kredensial memakai `private, no-store`. Jika audit awal gagal, tindakan dibatalkan; jika audit akhir gagal setelah password berubah, kredensial tetap dikembalikan disertai peringatan agar akses baru tidak hilang.

Persetujuan tenant memvalidasi nomor sebelum membuat sumber daya, memeriksa hasil penyimpanan `APPROVED`, dan membersihkan akun/tenant baru bila proses gagal sebelum selesai. Status hanya dikembalikan ke `PENDING` setelah pembersihan berhasil. Jika pembersihan atau konfirmasi status gagal, pengajuan ditahan untuk pemeriksaan agar tidak membuat akun ganda. Aktivasi marketing menggunakan pengecekan status/user ID saat menyimpan untuk menangani persetujuan bersamaan.

## Penggunaan untuk kasus yang sudah terjadi

1. Jangan menghapus tenant atau mendaftarkan ulang pengguna.
2. Cari akun yang sudah aktif pada daftar Marketing atau Tenant.
3. Buka **Perbaiki WA & akses**, masukkan nomor yang telah dipastikan benar, lalu centang reset password.
4. Konfirmasi identitas penerima, simpan, buka WhatsApp, dan tekan **Kirim**.
5. Minta pengguna mencoba login. Jika nomor lama milik orang lain dan pesan sempat terkirim, tinjau aktivitas akun serta sesi yang mungkin sudah aktif secara terpisah.

## Batasan operasional

Tidak ada pengecekan kepemilikan nomor otomatis atau WhatsApp Business API. Tidak ada klaim status pengiriman otomatis. Transaksi database dan Supabase Auth masih merupakan operasi terpisah; crash proses atau kegagalan pembersihan memerlukan pemeriksaan pengajuan `PROCESSING`. Jangan memaksa status kembali ke pending sebelum memastikan tidak ada akun/tenant tersisa. Reset bersamaan oleh beberapa admin dapat menghasilkan password yang saling menggantikan; gunakan hasil reset terakhir dan koordinasikan penanganan satu akun.

## Validasi

`node --import tsx --test scripts/account-access-recovery.test.mjs`

Menguji koreksi nomor, reset pada akun yang sama, identitas tidak cocok, akun nonaktif, sinkronisasi gagal, audit gagal, reset gagal, dan pengulangan tanpa pembuatan akun. Pengujian UI menggunakan data simulasi tanpa mengubah password pengguna produksi.
