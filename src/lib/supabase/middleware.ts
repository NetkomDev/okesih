import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";
import { getTrustedUserRole } from "@/lib/auth-role";

type ProtectedSurface = {
  role: "SUPERADMIN" | "OWNER" | "MARKETING";
  pwa: "superadmin" | "owner" | "marketing";
};

function getProtectedSurface(path: string): ProtectedSurface | null {
  if (path === "/admin" || path.startsWith("/admin/")) return { role: "SUPERADMIN", pwa: "superadmin" };
  if (path === "/superadmin") return { role: "SUPERADMIN", pwa: "superadmin" };
  if (path === "/owner" || path.startsWith("/owner/")) return { role: "OWNER", pwa: "owner" };
  if (path === "/marketing/dashboard" || path.startsWith("/marketing/dashboard/")) {
    return { role: "MARKETING", pwa: "marketing" };
  }
  return null;
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
  return target;
}

/**
 * Memeriksa apakah request membawa cookie sesi auth Supabase.
 * Cookie Supabase SSR biasanya dinamai 'sb-<project-ref>-auth-token' atau berakhiran '-auth-token'.
 */
export function hasSupabaseAuthSession(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (cookie) => cookie.name.includes("-auth-token") || cookie.name.startsWith("sb-")
  );
}

/**
 * Menyegarkan (refresh) token sesi Supabase pada request yang relevan.
 * Memastikan cookies auth selalu valid dan tidak kedaluwarsa untuk request bersesi,
 * serta menjaga guard Super Admin dan Protected Dashboards.
 */
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Route perangkat POS & KDS tidak menggunakan sesi akun Supabase (menggunakan pairing cookie perangkat).
  // Melewati pemanggilan auth.getUser() di proxy menghindari validasi jaringan berulang setiap polling 3 detik.
  if (path.startsWith("/api/device/") || path === "/pos" || path === "/kds") {
    return NextResponse.next({ request });
  }

  const isSuperAdminApi = path === "/api/superadmin" || path.startsWith("/api/superadmin/");
  const protectedSurface = getProtectedSurface(path);
  const hasSessionCookie = hasSupabaseAuthSession(request);

  // 2. Jika request sama sekali tidak membawa cookie auth Supabase:
  // - Untuk Super Admin API: tolak seketika tanpa network overhead.
  // - Untuk Protected Dashboard: redirect seketika ke /login tanpa network overhead.
  // - Untuk route publik: teruskan request langsung tanpa inisialisasi client Supabase.
  if (!hasSessionCookie) {
    if (isSuperAdminApi) {
      return NextResponse.json(
        { error: "Akses khusus Super Admin." },
        { status: 401 }
      );
    }

    if (protectedSurface) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("error", "login_required");
      redirectUrl.searchParams.set("from_pwa", protectedSurface.pwa);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next({ request });
  }

  // 3. Request bersesi: inisialisasi client Supabase SSR untuk menyegarkan token
  // dan memvalidasi izin akses sesuai peran.
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (isSuperAdminApi) {
    if (!user || getTrustedUserRole(user) !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Akses khusus Super Admin." },
        { status: user ? 403 : 401 }
      );
    }
  }

  if (protectedSurface) {
    const role = getTrustedUserRole(user);
    if (!user || role !== protectedSurface.role) {
      if (user) await supabase.auth.signOut({ scope: "local" });

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("error", user ? "unauthorized" : "login_required");
      redirectUrl.searchParams.set("from_pwa", protectedSurface.pwa);
      return copyResponseCookies(supabaseResponse, NextResponse.redirect(redirectUrl));
    }
  }

  return supabaseResponse;
}
