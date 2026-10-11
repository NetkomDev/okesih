import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 Proxy (pengganti middleware.ts).
 * Menangani penyegaran (refresh) token sesi Supabase secara otomatis
 * sebelum request diteruskan ke route rendering.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Jalankan proxy pada seluruh rute, KECUALI:
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - favicon.ico, icons, manifest files, dll.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
