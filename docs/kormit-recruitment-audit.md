# Audit rekrutmen KorMit — 25 Oktober 2026

## Alur yang diperiksa

1. KorMit aktif membuka halaman KorMit. API mengambil identitas koordinator dari sesi dan menolak akun biasa/nonaktif. Laporan hanya mengambil mitra dengan `upline_id` koordinator tersebut, bukan seluruh jaringan berjenjang.
2. KorMit dapat mendaftarkan calon mitra langsung atau membagikan `https://www.okesih.com/marketing/daftar?ref=KODE`. Halaman publik tidak membutuhkan login. Redirect antarsubdomain mempertahankan query referral.
3. Referral diverifikasi saat halaman dibuka dan kembali diverifikasi di server saat formulir disimpan. Koordinator wajib aktif, memiliki akun, dan berlevel COORDINATOR. Referral tidak valid tidak boleh diam-diam menghasilkan pendaftaran tanpa upline.
4. Rekrutan tersimpan sebagai PENDING/MITRA. Pendaftaran melalui akun KorMit mengambil upline dari sesi, mengabaikan upline/status/password kiriman klien, dan memakai UUID untuk pengulangan request. Pendaftaran publik menyimpan cookie bertanda tangan untuk membuka status serta menghindari pengiriman ulang setelah respons berhasil diterima. Jangan mengganti upline pendaftaran lama ketika membuka undangan lain.
5. Pesan pendaftaran ditujukan ke WA Super Admin. Data sudah tersimpan sebelum WhatsApp dibuka. Pengguna masih harus menekan Kirim di WhatsApp; membuka tautan bukan bukti pesan terkirim.
6. Super Admin memeriksa identitas/nomor penerima, lalu menyetujui pendaftaran. Akun login baru dibuat saat aktivasi pertama. Penyimpanan bersyarat terhadap akun/status/nomor sebelumnya mencegah dua aktivasi memakai akun yang berbeda pada baris mitra yang sama; akun baru dibersihkan jika penyimpanan ditolak.
7. Kredensial disiapkan untuk nomor WA mitra baru, bukan koordinator. Username/password mempertahankan karakter asli. Super Admin membuka dan mengirim pesan sendiri. Jika nomor salah atau pesan akses hilang, gunakan Perbaiki WA & akses akun setelah memverifikasi penerima; reset mengganti password lama, bukan membuat mitra/upline baru.
8. KorMit melihat status dan jumlah tenant rekrutan langsung pada tabel. Tenant dihitung dari `warkops.marketing_agent_id`, termasuk tenant nonaktif; pengajuan yang belum menjadi tenant tidak dihitung. Bonus tetap berdasarkan ledger pelunasan, bukan jumlah tenant semata.

## Perubahan hasil audit

- Daftar kartu diganti tabel Nama Mitra, Wilayah, Tenant; status tetap terlihat di bawah nama.
- Data jaringan diperbarui saat PWA kembali terlihat, selain polling 30 detik dan fokus jendela.
- Pemeriksaan referral yang gagal dapat dicoba ulang. Tombol pendaftaran menunggu referral selesai dan tidak aktif bila referral salah.
- Pengiriman formulir publik dikunci selama request berlangsung agar klik berulang tidak mengirim request paralel.
- Petunjuk WA diperbaiki: pengiriman pesan memberi tahu Admin, bukan menentukan apakah data pendaftaran tersimpan.

## Bukti dan batas pemeriksaan

- Tes API: otorisasi jaringan, pengikatan upline, retry pendaftaran KorMit, referral invalid/nonaktif/nonkoordinator, persetujuan, serta tujuan WA mitra baru.
- Tes database disposable: jaringan hanya satu tingkat, jumlah tenant/area benar, tenant nonaktif tetap dihitung, dan ledger bonus tidak merambat ke kakek upline.
- Pemeriksaan produksi read-only pada dua KorMit aktif: halaman pendaftaran HTTP 200, referral terjaga, lookup benar, jumlah rekrutan cocok dengan database.
- Pemeriksaan browser memakai data simulasi untuk tabel; undangan produksi dibuka tanpa mengirim formulir. Tidak membuat akun, mengubah status/komisi produksi, mereset password, atau mengirim WA dalam audit ini.
- Status pengiriman/penerimaan WA tidak dapat dibuktikan dari tautan `wa.me`; operator tetap harus memeriksa penerima dan mengirim pesan di WhatsApp.
