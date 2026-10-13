import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";

/**
 * Menyegarkan (refresh) token sesi Supabase pada setiap request yang lewat middleware.
 * Memastikan cookies auth selalu valid dan tidak kedaluwarsa.
 */
export async function updateSession(request: NextRequest) {
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

  // Menyegarkan sesi auth sekaligus mengunci seluruh permukaan Super Admin
  // di sisi server. Client guard tetap dipertahankan sebagai lapisan UX.
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isSuperAdminSurface = path === "/superadmin" || path.startsWith("/api/superadmin/");

  if (isSuperAdminSurface) {
    const role = String(user?.user_metadata?.role || "").toUpperCase();
    const isSuperAdmin = role === "SUPERADMIN" || user?.email?.toLowerCase().startsWith("superadmin");

    if (!user || !isSuperAdmin) {
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Akses khusus Super Admin." },
          { status: user ? 403 : 401 }
        );
      }

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = `?error=${user ? "unauthorized" : "login_required"}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
