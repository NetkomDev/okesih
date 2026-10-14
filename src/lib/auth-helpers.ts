"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./supabase/client";
import type { User } from "@supabase/supabase-js";

/**
 * Helper utilitas untuk sistem autentikasi OKESIH tanpa OTP/Email ribet.
 *
 * Mengonversi username staf (misal: "kasir1", "dapur") menjadi format email internal
 * yang diterima Supabase Auth (misal: "kasir1@okesih.local" atau "kasir1.warkopA@okesih.local").
 */

export const AUTH_DUMMY_DOMAIN = "okesih.local";

export type UserRole = "SUPERADMIN" | "OWNER" | "MARKETING" | "KASIR" | "DAPUR";

/**
 * Normalisasi username menjadi email internal Supabase Auth.
 */
export function usernameToEmail(username: string, warkopSlug?: string): string {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");

  if (cleanUsername.includes("@")) {
    return cleanUsername;
  }

  if (warkopSlug) {
    const cleanSlug = warkopSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return `${cleanUsername}.${cleanSlug}@${AUTH_DUMMY_DOMAIN}`;
  }

  return `${cleanUsername}@${AUTH_DUMMY_DOMAIN}`;
}

/**
 * Ekstraksi username asli dari email internal.
 */
export function emailToUsername(email: string): string {
  if (!email.endsWith(`@${AUTH_DUMMY_DOMAIN}`)) {
    return email;
  }
  const localPart = email.split("@")[0];
  if (localPart.includes(".")) {
    return localPart.split(".")[0];
  }
  return localPart;
}

/**
 * Ekstraksi peran (role) pengguna secara andal dari user metadata atau email.
 */
export function extractUserRole(user: User | null | undefined): UserRole | null {
  if (!user) return null;

  const metaRole = String(user.app_metadata?.role || user.user_metadata?.role || "").toUpperCase();
  if (metaRole === "SUPERADMIN") return "SUPERADMIN";
  if (metaRole === "OWNER") return "OWNER";
  if (metaRole === "MARKETING") return "MARKETING";
  if (metaRole === "KASIR") return "KASIR";
  if (metaRole === "DAPUR") return "DAPUR";

  const email = (user.email || "").toLowerCase().trim();
  if (email.startsWith("superadmin")) return "SUPERADMIN";
  if (email.startsWith("owner")) return "OWNER";
  if (email.startsWith("marketing")) return "MARKETING";
  if (email.startsWith("kasir")) return "KASIR";
  if (email.startsWith("dapur")) return "DAPUR";

  return null;
}

/**
 * Fungsi logout aman yang membersihkan seluruh sesi Supabase Auth
 * dan mengembalikan pengguna ke halaman login.
 */
export async function logoutUser(): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Error signing out:", err);
  } finally {
    window.location.href = "/login";
  }
}

import { detectActivePwaKind, isStandaloneApp, type PwaRoleKind } from "./pwa-routing";

export interface RoleMismatchInfo {
  pwaKind: PwaRoleKind;
  userRole: string;
}

/**
 * Hook Auth Guard untuk mengunci halaman dashboard sesuai hak akses (role).
 * Menutup celah keamanan sehingga pengguna tidak dapat sembarangan membuka
 * halaman yang bukan hak aksesnya atau berpindah peran tanpa otentikasi.
 */
export function useAuthGuard(allowedRoles: UserRole[]) {
  const router = useRouter();
  // Callers commonly pass an inline array (for example `["OWNER"]`). Using
  // that array directly as an effect dependency restarts the guard on every
  // render and can leave client-side navigation permanently loading.
  const allowedRolesKey = allowedRoles.join("|");
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [roleMismatch, setRoleMismatch] = useState<RoleMismatchInfo | null>(null);

  useEffect(() => {
    let isMounted = true;

    const verifyRole = async () => {
      try {
        const permittedRoles = allowedRolesKey.split("|") as UserRole[];
        const supabase = createClient();
        // Guard antarmuka cukup membaca sesi lokal yang sudah diverifikasi saat login.
        // Otorisasi sensitif tetap diverifikasi ulang oleh setiap API Route di server.
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        if (!user) {
          if (isMounted) {
            const activePwa = detectActivePwaKind();
            const redirectUrl = activePwa
              ? `/login?error=login_required&from_pwa=${encodeURIComponent(activePwa)}`
              : "/login?error=login_required";
            router.replace(redirectUrl);
          }
          return;
        }

        const role = extractUserRole(user);

        if (!role || !permittedRoles.includes(role)) {
          if (isMounted) {
            const activePwa = detectActivePwaKind();
            const standalone = isStandaloneApp();

            // Jika sedang berjalan di PWA mandiri (standalone) atau terdapat target PWA aktif,
            // jangan biarkan peran lain masuk dan jangan redirect ke dashboard lain di jendela PWA ini.
            if (activePwa || standalone) {
              const currentPwaKind: PwaRoleKind =
                activePwa || (permittedRoles[0]?.toLowerCase() as PwaRoleKind) || "owner";
              setRoleMismatch({
                pwaKind: currentPwaKind,
                userRole: role || "UNKNOWN",
              });
              setLoading(false);
              return;
            }

            // Arahkan ke dashboard yang menjadi haknya jika membuka di peramban (browser) biasa
            if (role === "SUPERADMIN") {
              router.replace("/superadmin");
            } else if (role === "OWNER") {
              router.replace("/owner");
            } else if (role === "MARKETING") {
              router.replace("/marketing/dashboard");
            } else if (role === "KASIR") {
              router.replace("/pos");
            } else if (role === "DAPUR") {
              router.replace("/kds");
            } else {
              router.replace("/login?error=unauthorized");
            }
          }
          return;
        }

        if (isMounted) {
          setCurrentUser(user);
          setCurrentRole(role);
          setIsAuthorized(true);
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          router.replace("/login?error=auth_failed");
        }
      }
    };

    verifyRole();

    return () => {
      isMounted = false;
    };
  }, [router, allowedRolesKey]);

  return { isAuthorized, currentUser, currentRole, loading, roleMismatch };
}
