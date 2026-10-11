import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clientEnv } from "@/lib/env";

/**
 * Supabase Client untuk Server Components, Server Actions, dan Route Handlers.
 * Berjalan di sisi server dengan hak akses sesuai sesi user yang login via Cookies (tetap menghormati RLS).
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component (read-only cookie store).
            // Penulisan cookie akan ditangani oleh Middleware.
          }
        },
      },
    }
  );
}
