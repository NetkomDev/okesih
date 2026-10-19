# Pendaftaran marketing

## Hasil audit dan perubahan

Sebelumnya POST menyimpan `marketing_partners` berstatus `PENDING`, lalu halaman mengosongkan semua input dan membuka `wa.me`. Notifikasi sukses hanya ada di state React; reload atau kunjungan berikutnya menampilkan form kosong. Tidak ada endpoint untuk mengambil kembali pendaftaran. Notifikasi juga menyebut kode referral resmi sebelum persetujuan.

Sekarang POST mengembalikan data pendaftaran lengkap dan memasang cookie HttpOnly bertanda tangan HMAC sebelum membuka WhatsApp. Form diganti ringkasan data dan tahapan. GET `/api/marketing/register` memverifikasi cookie dan membaca status terbaru hanya untuk ID yang ditandatangani. Nomor telepon, kode referral, atau ID dalam query bukan bukti identitas. Respons tidak boleh di-cache dan tidak memuat catatan internal Admin, password, atau user ID autentikasi.

- `PENDING`: data tersimpan, menunggu verifikasi Admin, akses aplikasi belum tersedia.
- `ACTIVE` tanpa `user_id`: diterima, akses akun masih disiapkan.
- `ACTIVE` dengan `user_id`: tombol **Buka aplikasi marketing** menuju `https://sales.okesih.com/marketing/dashboard`. Login tetap diperlukan; cookie pendaftaran tidak memberikan akses dashboard.
- `INACTIVE` atau status lain: belum aktif, arahkan untuk menghubungi Admin; tombol aplikasi disembunyikan.

Status dimuat saat halaman dibuka, setiap 30 detik selama halaman terlihat, dan saat kembali dari WhatsApp. Error pemuatan menampilkan pesan dan tombol coba lagi, bukan form baru. POST berulang dengan cookie valid mengembalikan data yang sama tanpa insert ulang.

## Batasan

- `wa.me` hanya menyiapkan pesan; tidak ada callback untuk membuktikan pesan sudah dikirim. Karena itu tahapan tidak mengklaim pengiriman WhatsApp sudah selesai. Pengguna tetap menekan **Kirim** di WhatsApp.
- Akses otomatis berlaku untuk pendaftaran baru di browser dan host yang sama, dengan cookie berlaku satu tahun. Cookie hilang, browser/perangkat berbeda, pendaftaran lama sebelum perubahan, atau rotasi kunci server tidak dapat dipulihkan otomatis. Jangan membuka data pribadi hanya berdasarkan nomor WhatsApp; pemulihan lintas perangkat memerlukan verifikasi identitas tersendiri.
- Tidak ada migrasi database. Verifikasi dan pembuatan akun tetap menggunakan mekanisme Super Admin yang ada. Data asli tetap tersimpan di database.
- Pencegahan duplikasi berbasis cookie tidak menjamin deduplikasi lintas browser atau dua request pertama yang bersamaan. Mekanisme kode referral acak tiga digit dan pembuatan kredensial oleh Admin tetap mengikuti implementasi sebelumnya.

## Validasi

`node --conditions=react-server --import tsx --test scripts/marketing-registration.test.mjs`

Menguji tanda tangan, kedaluwarsa, cookie hilang/palsu, batasan data respons, status aktivasi, cookie setelah submit, submit ulang, data hilang, dan kegagalan database. Uji browser menggunakan data simulasi agar tidak membuat pendaftaran atau mengirim pesan WhatsApp nyata.
