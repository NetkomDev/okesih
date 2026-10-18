# Audit & Optimasi OCR dan Operasional OKESIH

Dokumen ini mencatat audit arsitektur, hasil pengukuran benchmark empiris, serta implementasi optimasi untuk **P2 — OCR dan Operasional** per 18 Oktober 2026.

---

## 1. Analisis & Isolasi Bundle Tesseract di Server

### Permasalahan & Verifikasi
- Audit awal mencatat kekhawatiran apakah pustaka Tesseract berukuran besar diunduh oleh browser klien atau aplikasi PWA.
- **Hasil Pemeriksaan:**
  1. Tesseract (`tesseract.js`, `tesseract.js-core`, `@tesseract.js-data/eng`) hanya diimpor di file dengan direktif `"server-only"` pada [`src/lib/billing-proof-ocr.ts`](file:///Users/berech/Documents/OKESIH.COM/src/lib/billing-proof-ocr.ts).
  2. Pada [`next.config.ts`](file:///Users/berech/Documents/OKESIH.COM/next.config.ts), dependensi Tesseract dan data bahasa diisolasi khusus ke tracing config route serverless billing:
     ```typescript
     outputFileTracingIncludes: {
       "/api/owner/billing": [
         "./node_modules/tesseract.js/src/worker-script/node/**/*",
         "./node_modules/tesseract.js-core/**/*",
         "./node_modules/@tesseract.js-data/eng/**/*",
       ],
     }
     ```
  3. Pemindaian bundel klien membuktikan **0 byte Tesseract** masuk ke bundel frontend kasir (POS), dapur (KDS), portal marketing, maupun halaman publik.

---

## 2. Pengukuran Empiris Cold Start, Memori, Durasi, dan Konkurensi OCR

Pengujian benchmark lokal dilakukan dengan citra bukti transfer uji untuk mengukur karakteristik runtime Tesseract pada lingkungan Node.js:

### Data Pengukuran Empiris
| Parameter | Uji 1: Cold Start | Uji 2: Warm Invocation | Uji 3: 3 Panggilan Konkuren Simultan |
| --- | --- | --- | --- |
| **Durasi Eksekusi** | **1.358,3 ms** (~1,36 dtk) | **684,4 ms** (~0,68 dtk) | **2.863,5 ms** (terjadi CPU contention) |
| **Memori RSS Awal** | 32,9 MB | 189,3 MB | 33,4 MB |
| **Memori RSS Puncak** | **189,3 MB** | **192,9 MB** | **240,8 MB** |
| **Delta RSS Tambahan** | **+156,3 MB** | +3,6 MB | **+207,4 MB** |
| **Heap Memory Node** | 4,5 MB (stabil) | 4,7 MB (stabil) | 4,8 MB (stabil) |

### Analisis Arsitektur Serverless
1. **Mengapa Bukan Global Worker Singleton?**
   - Pada serverless functions (seperti Vercel), fungsi bersifat stateless dan ephemeral.
   - Worker global persistent yang dibiarkan hidup akan menahan alokasi memori ~190 MB secara terus-menerus di container meskipun instance sedang idle.
   - Jika worker mengalami unhandled rejection atau thread WebAssembly crash, worker persistent berisiko menggantung seluruh permintaan berikutnya.
2. **Risiko Konkurensi Tanpa Batas:**
   - 3–4 unggahan konkuren simultan tanpa pembatasan memicu spawn worker WASM paralel yang melipatgandakan footprint memori hingga > 250–400 MB, berisiko tinggi memicu OOM (Out of Memory) pada batas alokasi container serverless.

### Solusi & Optimasi yang Diterapkan
Pada [`src/lib/billing-proof-ocr.ts`](file:///Users/berech/Documents/OKESIH.COM/src/lib/billing-proof-ocr.ts):
1. **Antrean Konkurensi Serial (Concurrency Limiter / Queue):**
   - Menggunakan promise queue chaining (`activeOcrQueue`) sehingga eksekusi OCR dibatasi maksimum **1 pekerjaan pada satu waktu** per instance runtime.
   - Jika ada dua unggahan bukti tagihan masuk bersamaan, pekerjaan kedua antre secara tertib tanpa memicu duplikasi worker WASM atau lonjakan memori OOM ganda.
2. **Pre-validasi Magic Bytes Cepat:**
   - Memeriksa header magic bytes citra (PNG, JPEG, WebP) sebelum memanggil Tesseract. Berkas non-gambar atau berkas rusak ditolak dalam **< 0,1 ms** tanpa membebani runtime WASM.
3. **Timeout Guard (25 detik):**
   - Membatasi eksekusi pengenalan teks maksimal 25 detik agar fungsi serverless tidak menggantung hingga batas timeout gateway (60 detik).
4. **Pembersihan Bersih (Clean Termination):**
   - `recognize()` bawaan secara otomatis membersihkan child worker setelah satu pekerjaan selesai, membebaskan alokasi memori saat container idle.
5. **Telemetri Diagnostik:**
   - Hasil OCR menyertakan metrik `durationMs` dan `memoryRssMb` yang dicatat ke metadata `ocr_raw_text` pada database tagihan untuk visibilitas audit operasional.

---

## 3. Audit & Rekonstruksi Endpoint Health `/api/health`

### Permasalahan Sebelumnya
- Endpoint `/api/health` sebelumnya memanggil `supabase.auth.getSession()`.
- `auth.getSession()` hanya membaca token dari memory/cookie request lokal; fungsi ini **sama sekali tidak melakukan panggilan jaringan atau query ke database**.
- Akibatnya: Jika database PostgreSQL sedang down, connection pool penuh, atau Supabase mengalami gangguan layanan, `/api/health` tetap mengembalikan status `"healthy"` dengan latensi 1 ms (false positive berbahaya).

### Solusi & Optimasi
Pada [`src/app/api/health/route.ts`](file:///Users/berech/Documents/OKESIH.COM/src/app/api/health/route.ts):
1. **Probe Query Database PostgreSQL Nyata:**
   - Mengeksekusi query nyata ke tabel sistem `platform_settings`:
     ```typescript
     const queryStart = performance.now();
     const { data, error } = await admin
       .from("platform_settings")
       .select("id, updated_at")
       .eq("id", "global")
       .limit(1)
       .maybeSingle();
     const dbLatencyMs = Math.round(performance.now() - queryStart);
     ```
   - Menguji secara langsung:
     - Ketersediaan gateway PostgREST / Supabase REST API
     - Ketersediaan pool koneksi PostgreSQL
     - Latensi round-trip sesungguhnya dalam milidetik (`dbLatencyMs`)
2. **Status Respon HTTP Standar Operasional:**
   - Jika query database berhasil: HTTP **200 OK** (`status: "healthy"`).
   - Jika query database gagal / database down: HTTP **503 Service Unavailable** (`status: "unhealthy"`), memungkinkan sistem monitoring uptime (Uptime Kuma, Better Uptime, Datadog) mendeteksi insiden backend seketika.
3. **Metrik Diagnostik Lengkap:**
   - `system`: Uptime proses Node, alokasi memori RSS/Heap, versi Node.
   - `subsystems`: Status OCR (`tesseract-lstm/eng-isolated`), status PWA (`serwist-multi-surface`), dan security guard.
   - Header HTTP: `Cache-Control: "no-store, no-cache, must-revalidate, max-age=0"`.

---

## 4. Validasi Pipeline & Pengujian
- **TypeScript (`npx tsc --noEmit`):** Lulus 100% tanpa error.
- **ESLint (`npm run lint`):** 0 error.
- **PWA Test Suite (`npm run test:pwa`):** 14/14 tests lulus.
- **Reporting Test Suite (`npm run test:reporting`):** 5/5 tests lulus.
- **Build Produksi (`npm run build`):** 66 static pages berhasil digenerate & lolos scan keamanan OKESIH Security Guard.
