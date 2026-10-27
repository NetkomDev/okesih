# Hasil perbaikan alur pemesanan dan pendapatan OKESIH

Tanggal: 27 Oktober 2026. Baseline audit: `4273efc`. Acuan: [laporan audit](laporan-flow-pemesanan.md) dan [rencana perbaikan](rencana-perbaikan.md).

## Hasil implementasi

| Temuan | Perbaikan | Bukti penerimaan |
|---|---|---|
| F01 — angka Super Admin tidak sesuai realisasi | Struk hanya COOKING/READY/DONE. Pokok terbit, pokok lunas, dan piutang dipisahkan. Komisi memakai mutasi DIRECT + NETWORK aktual, bukan tarif saat ini. Margin adalah pokok lunas dikurangi komisi aktual. | SQL membandingkan status order, tanggal terbit/pelunasan, kedua jenis komisi, serta perubahan tarif tenant. |
| F02 — tenant berulang akibat beberapa shift | Billing diagregasi per tenant sebelum penggabungan laporan; status belum ditagih, pemeriksaan, belum lunas, dan lunas dibedakan. | SQL dua shift tetap satu baris tenant, dengan total pokok dan status gabungan benar. |
| F03 — tunai QR terlihat lunas hanya karena dikonfirmasi kasir | Sumber order, status dapur, dan pembayaran menjadi field terpisah. QR tunai tetap PENDING; kasir mencatat penerimaan dan kembalian melalui RPC dengan identitas kasir/perangkat/shift, audit, dan idempotensi. | SQL menolak perangkat/tenant salah dan uang kurang; retry tidak menambah pembayaran; label tidak bergantung pada nama kasir. |
| F04 — KDS menyelesaikan order berdasarkan timer | Timer tidak lagi mengubah status. Tombol “Sudah Diantar” manual; DONE ditolak database jika pembayaran belum tercatat. | SQL menolak DONE belum lunas; browser memajukan waktu 65 detik tanpa mutasi DONE. |
| F05 — grafik dan KPI tidak segar bersama | Revisi data owner memicu grafik; event billing ikut menyegarkan. Polling foreground 30 detik dan pemulihan saat online/aktif; Super Admin mencegah request tumpang tindih. | Pemeriksaan implementasi, TypeScript, dan build. Tidak diklaim sebagai UAT browser seluruh dashboard berautentikasi. |
| F06 — perbedaan tanggal omzet | Owner, riwayat, dan hitungan struk platform memakai konfirmasi kasir, dengan batas hari WITA. Legacy tanpa konfirmasi memakai waktu pembuatan sebagai fallback yang eksplisit. | SQL order dibuat kemarin dan dikonfirmasi hari ini masuk periode konfirmasi. |
| F07 — pelacakan pelanggan hilang atau status order lama terbawa | Simpan maksimal 10 token order per tenant selama 24 jam di sessionStorage; pulihkan status setelah reload, reset ketika order baru, polling dan refresh foreground. | Unit test storage/expiry/isolasi; browser reload dan pesanan kedua. |
| F08 — QR tidak valid memakai meja cache dan rename mematahkan QR | Identitas meja eksplisit yang salah selalu ditolak. QR baru memakai UUID `tid`; QR label lama tetap diterima bila cocok. | Unit test dan browser QR invalid, UUID tetap valid setelah label berubah. |
| F09 — shift kosong tetap ditagih | Shift tanpa struk sah atau pokok nol ditutup tanpa billing maupun kode unik. Tutup shift ditolak jika struk sah belum memiliki catatan pembayaran. | SQL penutupan kosong dan retry menghasilkan tagihan nol; unpaid menahan penutupan. |
| F10 — kas terpotong limit baris/tercampur belum dibayar | Preview dan penutupan memakai agregasi SQL kas yang benar-benar tercatat PAID, berdasarkan shift penerimaan pembayaran. | SQL 1.205 transaksi, isolasi tenant, kas belum ditagih nol, rekonsiliasi saat tutup shift. |
| F11 — rata-rata grafik ambigu | Label menyatakan penyebut bucket beromzet positif dan basis tanggal konfirmasi. | Pemeriksaan tampilan dan build. |
| F12 — penghapusan merusak riwayat | Database menolak hapus permanen tenant dengan transaksi/billing dan mitra dengan riwayat/hak komisi. Jalur purge lama ditutup. Entitas kosong tetap dapat dihapus atomik dan idempoten. | SQL hak komisi belum dibayar, riwayat dibayar, rollback kegagalan, shared Auth, retry, dan ACL. |

## Pembayaran, pendapatan, dan komisi

Pelanggan scan QR meja, memilih menu, lalu mengirim order dengan token pelacakan. Order baru menunggu konfirmasi kasir. Konfirmasi menerima order ke proses dapur dan menentukan tanggal omzet. Untuk tunai QR, konfirmasi ini belum berarti uang diterima. Pelunasan dicatat kasir saat pembayaran diterima; layar dapur mengizinkan penyelesaian setelah tercatat lunas. POS langsung mencatat pembayaran sesuai proses pembayaran POS yang ada; QRIS mengikuti konfirmasi kasir yang sudah berlaku.

Omzet owner adalah nilai order yang sudah diterima, sehingga tidak identik dengan kas tunai di laci. Kas shift hanya mencakup pembayaran tunai yang diterima pada shift tersebut. Pendapatan platform berasal dari pokok billing, bukan seluruh omzet tenant; kode unik transfer tidak diperlakukan sebagai margin. Margin yang ditampilkan belum mengurangi biaya operasional dan bukan saldo bank.

Saat tagihan baru terbit, database mengunci tarif komisi, penerima langsung/jaringan, dan kelayakannya. Pelunasan kemudian menghasilkan ledger sesuai snapshot tersebut, termasuk jika konfigurasi atau status mitra berubah setelah penerbitan. Suspend tetap membatasi akses/pencairan sesuai aturan aplikasi. Nilai serta identitas tagihan bersnapshot tidak dapat diubah. Serialisasi konfigurasi, penutupan shift, dan penghapusan menjaga konsistensi snapshot; mutasi komisi unik per billing/jenis mencegah penggandaan.

## Data lama dan batas cakupan

- Tidak mengarang bukti penerimaan uang. Sumber order lama hanya diisi dari audit yang tersedia; pembayaran lama tanpa bukti tetap `LEGACY_UNVERIFIED`. Kasir perlu memeriksa bukti sebelum mencatat agar tidak menerima uang dua kali.
- Tagihan lama tanpa snapshot tetap mengikuti mekanisme settlement sebelumnya. Tarif/penerima saat penerbitan tidak dapat direkonstruksi secara andal; ledger historis yang sudah tercatat tidak dihitung ulang.
- QR lama berbasis label masih bergantung pada label tersebut. Ketahanan terhadap rename berlaku pada QR UUID baru; cetak ulang QR meja untuk memakainya.
- Pemulihan token berlaku dalam sesi browser/tab yang sama, maksimal 24 jam. Jika penyimpanan browser ditolak, pemesanan tetap berjalan tetapi pemulihan setelah reload tidak dijamin.
- Tidak menambahkan proses refund atau void setelah konfirmasi. Uji pembayaran nyata, perangkat kasir/dapur fisik, serta rekonsiliasi rekening bank berada di luar smoke test rilis ini.

## Validasi

- `npm run check`: lint, 122 tes aplikasi (77 + 45), TypeScript, build produksi, dan pemindaian secret. Status akhir dicatat pada bagian rilis setelah proses selesai.
- PostgreSQL disposable: seluruh migrasi 01–41 dan tujuh fixture regresi, termasuk kasus audit di atas, lulus. Fixture hanya dijalankan pada database lokal.
- Uji dua proses pembayaran konkuren: satu sukses, satu ditolak karena sudah dibayar; kas dan audit hanya satu kali. Script membatasi koneksi ke database pengujian lokal.
- Browser Chrome mobile 390 × 844: respons API sintetis untuk pelanggan dan KDS. Ini menguji perilaku UI, sedangkan integritas SQL diuji terpisah; bukan klaim transaksi produksi end-to-end.
- `probe-flow.sql` pada laporan awal merupakan reproduksi kondisi baseline, bukan acceptance test untuk sistem yang telah diperbaiki.

## Rilis

Migrasi baru: `38_flow_reporting.sql`, `39_order_source.sql`, `40_order_payments_and_business_dates.sql`, dan `41_billing_snapshots_and_retention.sql`. Urutan rilis: validasi lokal → dry-run database → migrasi produksi → pemeriksaan baca API database → commit/push `main` → verifikasi status Vercel dan health produksi. Tidak menjalankan seed atau transaksi uji finansial pada produksi.

Dry-run memastikan hanya empat migrasi tersebut yang tertunda. Preflight mendeteksi satu shift terbuka, satu order tunai aktif, dan satu billing belum lunas; karena itu perlakuan legacy di atas diperlukan. Hasil migrasi dan deployment final disampaikan bersama tautan deployment setelah push.
