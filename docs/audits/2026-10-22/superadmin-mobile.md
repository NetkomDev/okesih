# Audit dan redesain mobile PWA Super Admin

## Temuan dan perbaikan

| Temuan awal | Perubahan |
| --- | --- |
| Tabel tenant/mitra memiliki lebar minimum 1.050–1.150 px; aksi berada jauh di kanan. | Pada layar ≤820 px, setiap baris menjadi kartu berlabel. Identitas, kontak, keuangan, status, serta semua tombol aksi tetap tersedia. Desktop tetap memakai tabel. |
| Menu utama hanya melalui sidebar; header berisi breadcrumb panjang dan beberapa tindakan sekaligus. | Lima menu tetap di navigasi bawah; header dipadatkan. Drawer tetap menyediakan tindakan cepat, akun, dan logout. |
| Aturan mobile lama menargetkan `.superadmin-header`, sedangkan komponen memakai `.superadmin-topbar`. | Aturan responsif baru menargetkan komponen yang benar. Tombol tambah tersedia dalam masing-masing menu dan drawer. |
| Lima KPI ditumpuk satu per satu di HP. | Ringkasan memakai dua kolom, dengan pendapatan bersih selebar panel. Ringkasan billing juga dua kolom. |
| Grid form, konfigurasi QRIS, dan baris billing memakai kolom desktop tetap. | Form dan detail menjadi satu kolom; rekening, QRIS, serta bukti pembayaran dapat dibaca tanpa geser horizontal. |
| Modal marketing, detail tagihan, dan konfirmasi tidak konsisten membatasi tinggi layar. | Modal bersama menggunakan tinggi dinamis viewport, scroll internal, penguncian scroll latar, focus trap, Escape, dan pengembalian fokus. |
| Tombol durasi pengaturan terpotong pada 320 px. | Pilihan durasi membungkus ke baris berikutnya. |
| Tombol sidebar tidak membuka drawer tepat pada lebar 1024 px. | Kondisi JavaScript disamakan dengan breakpoint CSS; drawer ditutup saat beralih ke desktop. |
| Input kecil, tombol sempit, dan belum ada ruang khusus safe area PWA. | Input mobile 16 px; kontrol utama minimal 44 px; viewport-fit cover dan padding safe area untuk header, navigasi, dan modal. |

## Verifikasi

- Chrome headless dengan komponen React dan CSS proyek, data contoh lokal, dan autentikasi fixture. Tidak menggunakan atau mengubah data produksi.
- Lima menu pada 320, 390, 430, 768, dan 1440 px: 25 kombinasi; tidak ditemukan overflow halaman atau kontrol di luar layar setelah perbaikan.
- Form tenant, form marketing, pemulihan akses, konfirmasi, dan detail billing diuji pada 320×640 dan 390×640: modal tetap di viewport, form panjang dapat digulir, input minimal 16 px, focus trap dan Escape berfungsi.
- Panel QRIS terbuka, navigasi bawah, drawer, tema terang/gelap, header dengan tombol instalasi, dan breakpoint drawer diperiksa.
- Lint, 53 tes regresi, TypeScript, build produksi, dan pemindaian secret dijalankan. Peringatan lint yang tersisa berasal dari kode di luar perubahan ini.

## Batas pemeriksaan

Simulasi browser tidak menggantikan uji PWA yang terpasang pada perangkat Android/iPhone fisik, keyboard OS, notch, atau instalasi dari browser. Permintaan API pada uji visual memakai fixture; operasi bisnis diuji melalui tes regresi yang tersedia. Tidak ada perubahan aturan bisnis, izin Super Admin, atau API pada redesain ini.
