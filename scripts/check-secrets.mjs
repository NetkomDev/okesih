import fs from "fs";
import path from "path";

/**
 * Script verifikasi keamanan pasca-build (post-build secret guard).
 * Memindai seluruh bundle client-side (.next/static/) untuk memastikan
 * Kunci Service Role atau pola kredensial sensitif tidak bocor ke browser.
 */

const STATIC_DIR = path.join(process.cwd(), ".next", "static");
const FORBIDDEN_PATTERNS = [
  /service_role/i,
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // Pola JWT jika ada
];

// Token signature service role spesifik dari environment jika diset
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  FORBIDDEN_PATTERNS.push(new RegExp(escapeRegex(process.env.SUPABASE_SERVICE_ROLE_KEY)));
}

function escapeRegex(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`[OKESIH Security Guard] Direktori ${dir} belum ada, lewati pemindaian.`);
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".json"))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      
      // Khusus untuk substring 'service_role' dalam payload JWT base64 ("role":"service_role")
      // base64 dari "service_role" adalah "c2VydmljZV9yb2xl"
      if (content.includes("c2VydmljZV9yb2xl")) {
        console.error(`\n🚨 [PELANGGARAN KEAMANAN FATAL] Ditemukan payload 'service_role' di file client bundle: ${fullPath}`);
        console.error("Build dibatalkan demi keamanan kredensial database!\n");
        process.exit(1);
      }

      if (process.env.SUPABASE_SERVICE_ROLE_KEY && content.includes(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
        console.error(`\n🚨 [PELANGGARAN KEAMANAN FATAL] SUPABASE_SERVICE_ROLE_KEY ditemukan di file client: ${fullPath}`);
        process.exit(1);
      }
    }
  }
}

console.log("[OKESIH Security Guard] Memulai pemindaian client bundles...");
scanDir(STATIC_DIR);
console.log("✅ [OKESIH Security Guard] Bersih! Tidak ada Service Role Key yang bocor ke frontend.");
