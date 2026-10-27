# Rencana perbaikan alur pemesanan dan pendapatan

Baseline: `4273efc`. Sumber: [laporan audit](laporan-flow-pemesanan.md). Status: implementasi dan audit ulang selesai; migrasi produksi sampai 42 serta seluruh validasi lulus. Verifikasi deployment commit akhir dilakukan setelah push.

## Urutan implementasi

| Tahap | Temuan | Perubahan | Kriteria penerimaan |
|---|---|---|---|
| 1 | F01, F02 | Migrasi agregasi Super Admin: hanya struk sah, komisi ledger, pisahkan pokok terbit/lunas/piutang; agregasi billing per tenant sebelum JOIN | Pending tidak dihitung; DIRECT/NETWORK sesuai mutasi; dua shift tetap satu baris tenant |
| 2 | F05, F11 | Sinkronisasi grafik/KPI owner dan polling foreground Super Admin; label penyebut rata-rata | Refresh KPI menyegarkan grafik; respons lama tidak menimpa data baru; penyebut rata-rata terlihat |
| 3 | F07, F08 | Persist akses order pelanggan, reset status order baru, validasi meja eksplisit, QR identifier stabil dengan kompatibilitas QR lama | Refresh memulihkan order; URL meja salah tidak memakai cache meja lama; rename label tidak merusak QR baru |
| 4 | F03, F04, F10 | Sumber order dan pembayaran terpisah; pencatatan kas, penyelesaian manual; agregasi SQL kas shift | Tunai yang belum lunas terlihat jelas; DONE tidak otomatis dari timer; preview kas tidak terpotong limit baris |
| 5 | F06, F09, F12 | Terapkan keputusan tanggal pengakuan, shift nol, retensi historis, serta snapshot tarif/penerima komisi | Kasus lintas tengah malam, shift kosong, perubahan tarif, dan penghapusan bersejarah sesuai keputusan |
| 6 | Semua | Regresi SQL + aplikasi + build + uji integrasi antarlapis; laporan hasil | Tes bermakna mencakup setiap perubahan; batas pengujian dinyatakan eksplisit |
| 7 | Rilis | Inspeksi akses database, migrasi teruji, commit/push main, verifikasi Vercel dan health | Aplikasi tidak dirilis dengan ketergantungan database belum tersedia; commit dan hasil deployment dicatat |

## Keputusan bisnis yang dimintakan klarifikasi

Keputusan berikut menjadi dasar implementasi. Klarifikasi dikirim saat awal pekerjaan; pengguna melanjutkan pekerjaan dan memberikan kebijakan pembayaran serta retensi berikut.

- Pembayaran tunai QR: bayar saat diantar dengan pencatatan pelunasan kasir, atau wajib lunas sebelum dapur.
jawaban: bayar saat diantar dengan pencatatan pelunasan kasir.
- Tanggal omzet: konfirmasi kasir atau tetap pembuatan order; shift tanpa struk dibebaskan dari tagihan.
jawaban: shift tanpa struk dibebaskan dari tagihan.
- Riwayat: blokir hapus permanen entitas berkeuangan atau pertahankan fitur; tarif/penerima komisi dikunci saat tagihan terbit atau tetap saat settlement.
jawaban: Jika Tenant/Mitra sudah pernah bertransaksi, mereka tidak boleh dihapus permanen, melainkan hanya bisa di-Nonaktifkan / Suspend / Arsip. Akun tidak bisa dipakai lagi, tetapi riwayat angka pembukuan masa lalunya tetap aman tersimpan rapi. Tombol "Hapus Permanen" hanya berlaku untuk tenant/mitra baru yang salah daftar/belum pernah ada transaksi. Begitu kasir tutup shift dan tagihan terbit, sistem langsung mengunci nilai komisi dan siapa mitranya pada saat itu. Jadi jika di kemudian hari Super Admin menaikkan/menurunkan tarif komisi tagihan hari kemarin yang belum dibayar tidak akan ikut berubah-ubah.

Setelah pengguna menginstruksikan “lanjutkan”, opsi rekomendasi dilanjutkan dan dikomunikasikan: bayar saat diantar + pelunasan kasir, selesai manual, tanggal konfirmasi WITA, bebas tagihan nol, lindungi entitas berkeuangan, snapshot komisi saat billing terbit. Riwayat lama tidak boleh direkayasa menjadi bukti pembayaran: sumber/status lama yang tidak dapat dibuktikan harus diberi penanda jelas.

## Strategi data dan kompatibilitas

- Tambahkan migrasi baru; jangan mengedit migrasi produksi lama.
- Pertahankan bentuk respons yang dipakai aplikasi lama selama deployment bertahap; penambahan field bersifat kompatibel.
- Penghitungan uang dilakukan di SQL dengan scoping tenant; pembaruan finansial memakai locking/idempotensi dan audit log.
- Mutasi ledger historis tidak dihitung ulang memakai tarif hari ini.
- Jalankan migrasi pada PostgreSQL disposable terlebih dahulu; jangan menjalankan seed/fixture di produksi.
- Jika akses migrasi produksi tidak tersedia, selesaikan implementasi dan validasi lokal, dokumentasikan penghalangnya secara tepat; jangan mengklaim deployment fungsional lengkap.

## Validasi wajib

1. SQL: pending/rejected, beberapa shift sehari, paid/unpaid, komisi langsung/jaringan, retry dan konflik, batas hari WITA, shift kosong, agregasi kas >1.000 transaksi, akses lintas tenant.
2. Aplikasi: pemulihan order, meja tidak valid, perubahan status/pembayaran, polling dan error; uji browser bila runner tersedia.
3. `npm run check` dan `npm run test:database`; pemeriksaan diff dan secret.
4. Status deployment commit yang tepat dan health produksi; jelaskan perbedaan smoke test dan UAT pembayaran nyata.

## Catatan pelaksanaan

- Tahap 1–5: F01–F12 telah diimplementasikan melalui migrasi 38–41 dan perubahan UI/API.
- Tahap 6: 122 tes awal, tujuh fixture SQL, pembayaran konkuren, dan browser pelanggan/KDS lulus. Audit ulang menambah dua tes penyimpanan browser, regresi QRIS/penolakan/tanggal settlement, dan simulasi perbedaan skema produksi.
- Tahap 7: migrasi 38–41 serta commit `edf4d22` sudah dibuat oleh proses sebelumnya. Saat audit ulang, proses lain dihentikan atas konfirmasi pengguna; perubahan tersebut dipertahankan.
- Tambahan audit ulang: migrasi 42 memulihkan pengaman tenant/item dan pairing yang tidak tersedia di produksi walaupun versi lama tercatat terpasang; mengunci tanggal/identitas settlement. Label Mitra dan ketahanan intent terhadap kegagalan penyimpanan diperbaiki.
- Status dan batas kepastian per temuan tersedia pada [laporan hasil](hasil-perbaikan.md).
