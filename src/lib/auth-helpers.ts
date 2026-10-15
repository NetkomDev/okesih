"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "./supabase/client";
import type { User } from "@supabase/supabase-js";
import { getTrustedUserRole, type UserRole } from "./auth-role";

/**
 * Helper utilitas untuk sistem autentikasi OKESIH tanpa OTP/Email ribet.
 *
 * Mengonversi username staf (misal: "kasir1", "dapur") menjadi format email internal
 * yang diterima Supabase Auth (misal: "kasir1@okesih.local" atau "kasir1.warkopA@okesih.local").
 */

export const AUTH_DUMMY_DOMAIN = "okesih.local";

export type { UserRole } from "./auth-role";

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
 * Ekstraksi peran dari app metadata yang hanya dapat ditetapkan oleh server.
 */
export function extractUserRole(user: User | null | undefined): UserRole | null {
  return getTrustedUserRole(user);
}

/**
 * Fungsi logout aman yang membersihkan seluruh sesi Supabase Auth
 * dan mengembalikan pengguna ke halaman login.
 */
export async function logoutUserTo(destination: string): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Error signing out:", err);
  } finally {
    window.location.href = destination;
  }
}

export async function logoutUser(): Promise<void> {
  await logoutUserTo("/login");
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
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          if (isMounted) {
            router.replace("/login?error=login_required");
          }
          return;
        }

        const role = extractUserRole(user);

        // Jika akun tidak memiliki hak akses (role tidak sesuai dengan halaman ini)
        if (!role || !permittedRoles.includes(role)) {
          if (isMounted) {
            // Arahkan ke dashboard haknya secara otomatis
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

