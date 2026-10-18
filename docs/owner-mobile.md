# PWA Owner — navigasi dan tampilan mobile

## Navigasi

Bottom navbar memiliki lima tujuan: Home, Menu, Tim, QRIS, dan Lainnya. Perangkat, PIN, tema, instalasi PWA, tautan aplikasi kasir/dapur, serta keluar akun tersedia melalui Lainnya. Desktop tetap memiliki sidebar.

`/owner/team` memuat tab Akun staf atau Waiter dengan dynamic import. Hanya tab aktif yang mengambil data dan memasang subscription. URL lama `/owner/staff` dan `/owner/waiters` tetap berfungsi dan membuka tab yang sesuai. Menggabungkan navigasi tidak menggabungkan izin atau model akun staf dan waiter.

## Home dan PIN

Header memakai alur dokumen normal; tidak ada margin negatif untuk menarik judul ke atas. Nama usaha dapat membungkus teks panjang. Ringkasan menampilkan total penjualan, jumlah transaksi, pembagian tunai/QRIS, tagihan, dan shift kasir. Angka tunai dilabeli penjualan tunai, karena agregat transaksi bukan perhitungan saldo fisik laci.

Formulir PIN mendukung 4–6 angka, tombol tampil/sembunyikan, konfirmasi, status proteksi, pesan kegagalan, dan retry pembacaan status. Input dinonaktifkan sampai status terbaca. PIN tidak disimpan ke browser storage; setelah penyimpanan berhasil, kedua input dikosongkan. Menonaktifkan PIN tetap meminta konfirmasi.

Aksi Akhiri shift dari Tim mengambil snapshot shift terbaru ketika ditekan dan memeriksa member ID sebelum mengirim penutupan. Tidak perlu memuat seluruh payload dashboard untuk membuka daftar staf.

## Responsivitas dan pemuatan

- Navbar memakai lima kolom, target sentuh minimal 44 piksel, dan safe area perangkat.
- `viewport-fit=cover` dan padding konten menjaga area bawah tetap dapat digulir melewati navbar.
- Profil/onboarding tetap milik provider layout; berpindah halaman tidak mengambil keduanya ulang.
- Grafik omzet dan request revenue baru dimuat saat bagian grafik mendekati viewport, melalui IntersectionObserver dan dynamic import. Observer dilepas setelah aktif; fetch grafik dibatalkan saat periode berubah atau komponen ditutup.
- Modal tagihan tetap dimuat saat dibuka. Tidak ada dependency runtime baru.
- CSS desain baru terisolasi pada shell Owner; tidak mengubah layout POS, marketing, atau superadmin.

## Verifikasi

Uji browser memakai komponen aplikasi nyata dengan sesi/API simulasi, bukan transaksi produksi. Diperiksa pada lebar 320, 360, 390, 430, 768, dan 1280 piksel: tidak ada overflow horizontal Home/PIN, lima tombol navigasi, pemuatan data tab Tim sesuai kebutuhan, layout persisten, serta tampilan terang/gelap. Screenshot ditinjau secara visual. Validasi PIN mencakup penolakan konfirmasi tidak cocok sebelum request dan pengosongan input setelah sukses.

Pemeriksaan otomatis: build produksi beserta secret scan, lint file yang diubah, 14 tes PWA, dan 5 tes reporting. Hasil deployment dan commit dicatat pada ringkasan pekerjaan.

Pemeriksaan artifact build memastikan grafik berada pada chunk terpisah; entry Home tidak memuat implementasi form PIN atau kartu staf. Uji tambahan API simulasi memverifikasi pembuatan akun staf, konfirmasi penonaktifan PIN, dan penutupan shift yang membaca snapshot hanya ketika aksi ditekan. Lint file yang diubah: 0 error, 2 warning penggunaan img yang sudah dipertahankan pada shell.
