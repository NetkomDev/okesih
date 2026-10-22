# Audit kredensial dan input angka

- Aktivasi marketing sebelumnya menghasilkan suffix hex 12 karakter dan password base64url panjang. Aktivasi pengajuan owner juga memakai password panjang. Form pendaftaran langsung memakai generator berbeda.
- Semua generator tersebut kini memakai suffix username 3 digit dan password acak 6 digit, sesuai pilihan pengguna setelah klarifikasi minimum password. Reset akses owner/marketing juga memakai 6 digit. Password digenerate dengan Web Crypto, terpisah dari username.
- Auth menentukan keunikan username; benturan suffix dicoba dengan suffix berikutnya. Username hasil akhir yang ditampilkan dan dikirim harus sama dengan akun Auth. Format prefix tetap membatasi setiap peran ke 900 username (100–999); jika seluruhnya terpakai, pembuatan gagal tanpa menimpa akun.
- Form dan hasil pendaftaran menyediakan tombol salin masing-masing kredensial serta seleksi teks manual saat Clipboard API ditolak. Hasil aktivasi ditampilkan dahulu; pengguna memilih membuka WhatsApp. Pesan WhatsApp memisahkan kredensial ke baris sendiri. Aplikasi tidak dapat menambahkan tombol salin ke UI pesan WhatsApp melalui tautan wa.me.
- Nomor rekening pada pendaftaran publik, tambah marketing, pengaturan bank pusat, dan profil memakai input teks dengan keypad numeric; nol di depan tetap dipertahankan.
- Nomor telepon/WhatsApp memakai keypad telepon, termasuk form tambah marketing yang sebelumnya input teks biasa. Harga menu, komisi, dan biaya SaaS memakai inputMode numeric. Rentang kode POS dipisah menjadi kolom awal dan akhir dengan keypad numeric.
- Kolom nominal penarikan, pembayaran tunai, rekonsiliasi kas, PIN, dan pairing sudah memakai keypad numeric. Slider kalkulator, tanggal, label meja (misalnya VIP 1), username, pencarian campuran, dan password pilihan pengguna tidak dibatasi ke angka.

Validasi: TypeScript, lint, tes generator serta collision/error/exhaustion, tes regresi aplikasi, build produksi, dan pemindaian secret. Keyboard fisik Android/iOS serta perilaku seleksi di aplikasi WhatsApp memerlukan pemeriksaan perangkat; inputMode merupakan petunjuk keyboard untuk browser.
