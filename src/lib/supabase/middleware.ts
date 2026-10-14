import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";

type ProtectedSurface = {
  role: "SUPERADMIN" | "OWNER" | "MARKETING";
  pwa: "superadmin" | "owner" | "marketing";
};

function getProtectedSurface(path: string): ProtectedSurface | null {
  if (path === "/superadmin") return { role: "SUPERADMIN", pwa: "superadmin" };
  if (path === "/owner" || path.startsWith("/owner/")) return { role: "OWNER", pwa: "owner" };
  if (path === "/marketing/dashboard" || path.startsWith("/marketing/dashboard/")) {
    return { role: "MARKETING", pwa: "marketing" };
  }
  return null;
}

function getUserRole(user: User | null) {
  return String(user?.app_metadata?.role || user?.user_metadata?.role || "").toUpperCase();
}

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

  // Menyegarkan sesi auth sekaligus mengunci dashboard berdasarkan perannya.
  // Client guard tetap dipertahankan sebagai lapisan UX.
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isSuperAdminApi = path === "/api/superadmin" || path.startsWith("/api/superadmin/");
  const protectedSurface = getProtectedSurface(path);

  if (isSuperAdminApi) {
    if (!user || getUserRole(user) !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Akses khusus Super Admin." },
        { status: user ? 403 : 401 }
      );
    }
  }

  if (protectedSurface) {
    const role = getUserRole(user);
    if (!user || role !== protectedSurface.role) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("error", user ? "unauthorized" : "login_required");
      redirectUrl.searchParams.set("from_pwa", protectedSurface.pwa);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
