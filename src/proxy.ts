import { NextResponse, type NextRequest } from "next/server";
import {
  APP_ENTRY_PATHS,
  APP_ORIGINS,
  isApiAllowedOnSurface,
  normalizeHostname,
  surfaceForHostname,
  surfaceForPath,
} from "@/lib/app-origins";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 Proxy (pengganti middleware.ts).
 * Menangani penyegaran (refresh) token sesi Supabase secara otomatis
 * sebelum request diteruskan ke route rendering.
 */
export async function proxy(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostname = normalizeHostname(forwardedHost || request.headers.get("host"));
  const currentSurface = surfaceForHostname(hostname);

  // Domain preview/localhost tetap bekerja tanpa redirect. Pembatasan ini hanya
  // diberlakukan pada domain produksi OKESIH yang sudah dikenali.
  if (currentSurface) {
    const { pathname } = request.nextUrl;

    if (pathname.startsWith("/api/")) {
      if (!isApiAllowedOnSurface(pathname, currentSurface)) {
        return NextResponse.json({ error: "Endpoint tidak tersedia pada aplikasi ini." }, { status: 404 });
      }
    } else if (pathname === "/" && currentSurface !== "PUBLIC") {
      const destination = new URL(APP_ENTRY_PATHS[currentSurface], APP_ORIGINS[currentSurface]);
      return NextResponse.redirect(destination, 307);
    } else if (pathname === "/login") {
      if (currentSurface === "POS" || currentSurface === "KDS") {
        const destination = new URL(APP_ENTRY_PATHS[currentSurface], APP_ORIGINS[currentSurface]);
        return NextResponse.redirect(destination, 307);
      }
    } else if (pathname !== "/~offline") {
      const requiredSurface = surfaceForPath(pathname);
      if (requiredSurface !== currentSurface) {
        const destination = new URL(`${pathname}${request.nextUrl.search}`, APP_ORIGINS[requiredSurface]);
        return NextResponse.redirect(destination, 307);
      }
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Jalankan proxy pada seluruh rute, KECUALI:
     * - _next/static (static assets)
     * - _next/image (image optimization files)
     * - service worker dan aset publik statis (ikon, gambar, audio, manifest)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg|webmanifest)$).*)",
  ],
};
