import "server-only";
import { z } from "zod";

/**
 * Validasi environment variables sisi SERVER (Route Handlers, Server Actions, Server Components).
 * File ini mengimpor 'server-only' sehingga JIKA ada Client Component yang mencoba mengimpornya,
 * bundler Next.js akan langsung menghentikan build dengan error.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY wajib diisi di server environment!"),
  SUPABASE_SECRET_API_KEY: z.string().optional(),
});

export const serverEnv = serverEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_SECRET_API_KEY: process.env.SUPABASE_SECRET_API_KEY,
});
