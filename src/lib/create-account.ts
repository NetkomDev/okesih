import type { SupabaseClient, AdminUserAttributes } from "@supabase/supabase-js";

// Retry only generated usernames; Auth remains the authority for uniqueness.
export async function createAccount(admin: SupabaseClient, username: string, attributes: AdminUserAttributes) {
  const generated = /^(owner|marketing)_(\d{3})$/.exec(username);
  const start = generated ? Number(generated[2]) - 100 : 0;
  for (let attempt = 0; ; attempt++) {
    const candidate = generated ? `${generated[1]}_${100 + (start + attempt) % 900}` : username;
    const result = await admin.auth.admin.createUser({ ...attributes, email: `${candidate}@okesih.local` });
    if (!generated || !["email_exists", "user_already_exists"].includes(result.error?.code || "") || attempt === 899) {
      return { ...result, username: candidate };
    }
  }
}
