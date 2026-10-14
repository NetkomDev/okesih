# Aturan Pengembangan & Modifikasi Kode OKESIH

- **Jangan over-engineer untuk teks yang sederhana:** Lakukan perubahan teks atau string secara langsung dan to the point tanpa menambahkan lapisan kompleksitas atau arsitektur yang tidak perlu.
- **Kalau bingung, jangan bikin asumsi:** Jika ada instruksi yang ambigu, ambigu peran, atau kurang jelas, selalu tanyakan/klarifikasi langsung kepada user terlebih dahulu.
- **Jangan bikin perubahan random yang tidak penting:** Fokus hanya pada apa yang diminta oleh user, jangan mengubah atau mengutak-atik kode lain di luar lingkup tugas.
- **Selalu dobel cek hasil kerjamu sebelum bilang sudah selesai:** Lakukan pengujian, periksa build (`npm run build`), dan pastikan fungsionalitas benar-benar valid sebelum memberikan konfirmasi selesai.
- **Selalu push/commit ke Vercel/repo bila pekerjaan telah selesai:** Setelah pekerjaan diverifikasi dengan baik, commit dan push ke remote repository (`origin main`) agar sinkron dan langsung ter-deploy di Vercel.
