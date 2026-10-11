import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Supabase Admin Client (Service Role).
 *
 * PERINGATAN KEAMANAN TINGKAT TINGGI:
 * - Klien ini menggunakan SUPABASE_SERVICE_ROLE_KEY yang MEM-BYPASS seluruh aturan RLS (Row Level Security).
 * - Wajib hanya digunakan di backend internal: verifikasi pembayaran OCR, pembuatan akun staf baru oleh owner,
 *   atau aksi maintenance superadmin.
 * - Dilindungi 'server-only': compiler akan langsung melempar error jika ada Client Component yang mencoba mengimpor file ini.
 */
export function createAdminClient() {
  return createClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
