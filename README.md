# OKESIH.COM — Micro-SaaS POS & Kitchen Display System

Aplikasi manajemen operasional warkop berkecepatan tinggi (*high-throughput*) dengan arsitektur PWA *Offline-First*, KDS real-time, layar antrean Smart TV, dan penagihan sewa otomatis berbasis validasi bukti transfer QRIS via OCR.

## 🛠️ Tech Stack & Infrastruktur
* **Frontend:** Next.js (App Router, TypeScript)
* **Styling:** Vanilla CSS Design Tokens (Oranye Kemerahan Hangat + Hitam Pekat + Putih Bersih)
* **PWA & Offline:** Serwist Service Worker + IndexedDB (Dexie.js)
* **Backend-as-a-Service (BaaS):** Supabase (PostgreSQL, Row Level Security, Realtime WebSockets, Storage)
* **Deployment & CI/CD:** Vercel (Auto-deploy dari GitHub repo `NetkomDev/okesih`)

---

## 🔒 Arsitektur Keamanan & Isolasi Kunci Supabase
1. **Frontend PWA / Client Components:**
   - Hanya mengakses `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Seluruh akses data dibatasi secara ketat oleh aturan **Row Level Security (RLS)** PostgreSQL Supabase.
2. **Backend Server / API Routes:**
   - Menggunakan `SUPABASE_SERVICE_ROLE_KEY` via utilitas `@/lib/supabase/admin`.
   - File admin dilindungi oleh `import "server-only"`; build bundler akan otomatis membatalkan kompilasi jika file ini terimpor secara tidak sengaja oleh Client Component.
3. **Automated Secret Guard:**
   - Script `scripts/check-secrets.mjs` dijalankan otomatis setelah `next build` untuk memastikan tidak ada kunci rahasia atau payload JWT `service_role` yang masuk ke dalam bundle `.next/static`.
4. **Credential Sanitation:**
   - File `blueprint_okesih.md` yang memuat kunci asli masuk ke dalam `.gitignore`. Versi dokumentasi publik yang telah disensor tersimpan di `docs/blueprint.md`.

---

## 📁 Struktur Modul Aplikasi
* `/pos` — **Modul Kasir (POS):** Tap-tap cepat, antrean pesanan, bluetooth printer, offline fallback.
* `/kds` — **Modul Dapur (KDS):** Tiket real-time berkedip dengan timer SLA status masak.
* `/tv` — **Modul Antrean TV:** Tampilan Smart TV memanggil nomor otomatis via TTS (Web Speech API).
* `/menu/[warkopId]` — **Modul Katalog QR Menu:** Pelanggan pesan mandiri dari meja.
* `/admin` — **Modul Superadmin & Owner:** Manajemen warkop, pembuatan akun staf praktis (username + password), audit tagihan harian Rp 50/struk.

---

## 🚀 Panduan Memulai Secara Lokal

### 1. Salin Environment Variables
```bash
cp .env.example .env.local
```
Sesuaikan nilai `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`.

### 2. Install Dependensi
```bash
npm install
```

### 3. Jalankan Server Pengembangan
```bash
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

### 4. Build & Uji Keamanan Bundle
```bash
npm run build
```

---

## ☁️ Panduan Deploy ke Vercel
1. Hubungkan repositori GitHub: `https://github.com/NetkomDev/okesih.git` ke project Vercel baru.
2. Tambahkan Environment Variables di Dashboard Vercel:
   * `NEXT_PUBLIC_APP_URL` (contoh: `https://okesih.com`)
   * `NEXT_PUBLIC_SUPABASE_URL`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   * `SUPABASE_SERVICE_ROLE_KEY` (Tandai opsi **Sensitive**)
3. Vercel akan otomatis men-deploy setiap kali ada push ke branch `main`.

## 📲 Pengirim Otomatis WhatsApp Tenant (Tanpa WhatsApp API)

Pendaftaran tenant menambahkan pesan selamat datang dan kredensial ke tabel
`whatsapp_outbox`. Pesan dikirim oleh aplikasi WhatsApp Desktop pada Mac super
admin yang selalu aktif. WhatsApp Desktop harus login sebagai nomor
**+62 856-9448-8510**.

1. Jalankan migration `supabase/migrations/09_whatsapp_outbox.sql` pada Supabase.
2. Pada Mac super admin, clone aplikasi dan isi `.env.local` dengan
   `NEXT_PUBLIC_SUPABASE_URL` serta `SUPABASE_SERVICE_ROLE_KEY` yang sama dengan
   production.
3. Install dependency dengan `npm install`.
4. Pastikan WhatsApp Desktop sudah login sebagai **+62 856-9448-8510**.
5. Jalankan `npm run whatsapp:worker`. Saat pertama kali mengirim, izinkan
   Terminal/Node mengendalikan WhatsApp pada **System Settings → Privacy &
   Security → Accessibility**.
6. Biarkan proses hidup 24/7 menggunakan LaunchAgent macOS.

Otomasi WhatsApp Desktop ini bukan integrasi resmi WhatsApp; sesi dapat terputus dan akun
tetap tunduk pada ketentuan serta pembatasan WhatsApp.
