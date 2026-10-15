import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";

let cashierClient: SupabaseClient | undefined;

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

/**
 * Kasir memakai penyimpanan sesi terpisah agar login staf pada tab POS tidak
 * menimpa sesi Owner yang sedang dipakai untuk menyetujui pairing.
 */
export function createCashierClient() {
  cashierClient ??= createSupabaseClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        storageKey: "okesih-cashier-auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );
  return cashierClient;
}
