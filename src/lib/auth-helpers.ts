/**
 * Helper utilitas untuk sistem autentikasi OKESIH tanpa OTP/Email ribet.
 *
 * Mengonversi username staf (misal: "kasir1", "dapur") menjadi format email internal
 * yang diterima Supabase Auth (misal: "kasir1@okesih.local" atau "kasir1.warkopA@okesih.local").
 */

export const AUTH_DUMMY_DOMAIN = "okesih.local";

/**
 * Normalisasi username menjadi email internal Supabase Auth.
 * Jika input sudah berupa format email, biarkan apa adanya.
 * Jika warkopSlug diberikan, format menjadi username.warkopSlug@okesih.local agar username unik antar warkop.
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
