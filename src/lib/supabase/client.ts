import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

/**
 * Supabase Client untuk Browser / Client Components PWA.
 * Menggunakan Anon Key publik yang aman di browser karena dilindungi aturan Row Level Security (RLS).
 */
export function createClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
