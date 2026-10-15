import type { SupabaseClient, User } from "@supabase/supabase-js";
import { OwnerApiError, ownerErrorResponse, requireOwner } from "@/lib/owner-api";

type StaffMember = {
  id: string;
  user_id: string | null;
  username: string;
  display_name: string | null;
  role: "KASIR" | "DAPUR";
  is_active: boolean;
};

async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function ensureStaffAuthUser(admin: SupabaseClient, warkopId: string, member: StaffMember, password?: string) {
  const { data: profile, error: profileError } = await admin.from("warkops").select("slug").eq("id", warkopId).single();
  if (profileError) throw profileError;
  const metadata = { role: member.role, warkop_id: warkopId };
  const userMetadata = { ...metadata, warkop_slug: profile.slug };

  if (member.user_id) {
    const { error } = await admin.auth.admin.updateUserById(member.user_id, {
      ...(password ? { password } : {}),
      app_metadata: metadata,
      user_metadata: userMetadata,
    });
    if (error) throw new OwnerApiError("Akun login staf tidak ditemukan. Hubungi administrator.", 409);
    return member.user_id;
  }

  if (!password) throw new OwnerApiError("Akun staf lama belum memiliki login. Reset password terlebih dahulu.", 409);

  const email = `${member.username}@okesih.local`;
  let createdUserId: string | null = null;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: metadata,
    user_metadata: userMetadata,
  });

  let authUser = created.user;
  if (createError || !authUser) {
    const duplicate = createError?.message.toLowerCase().includes("already") || createError?.message.toLowerCase().includes("registered");
    if (!duplicate) throw new OwnerApiError(createError?.message || "Akun login staf gagal dibuat.", 500);
    authUser = await findAuthUserByEmail(admin, email);
    if (!authUser) throw new OwnerApiError("Akun login lama tidak dapat ditemukan. Hubungi administrator.", 409);

    const { data: linkedMember, error: linkedError } = await admin
      .from("warkop_members")
      .select("id,warkop_id")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (linkedError) throw linkedError;
    if (linkedMember && linkedMember.id !== member.id) {
      throw new OwnerApiError("Username sudah terhubung ke akun usaha lain. Gunakan username berbeda.", 409);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
      password,
      app_metadata: metadata,
      user_metadata: userMetadata,
    });
    if (updateError) throw updateError;
  } else {
    createdUserId = authUser.id;
  }

  const { error: linkError } = await admin
    .from("warkop_members")
    .update({ user_id: authUser.id })
    .eq("id", member.id)
    .eq("warkop_id", warkopId)
    .is("user_id", null);
  if (linkError) {
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    throw linkError;
  }
  return authUser.id;
}

export async function POST(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const password = String(body.password || "");
    const role = String(body.role || "").toUpperCase();
    if (username.length < 3 || password.length < 6 || !["KASIR", "DAPUR"].includes(role)) {
      return Response.json({ error: "Username minimal 3 karakter, password minimal 6 karakter, dan peran wajib valid." }, { status: 400 });
    }

    const { data: profile, error: profileError } = await admin.from("warkops").select("slug").eq("id", warkopId).single();
    if (profileError) throw profileError;
    const email = `${username}@okesih.local`;
    const { data: auth, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      app_metadata: { role, warkop_id: warkopId },
      user_metadata: { role, warkop_id: warkopId, warkop_slug: profile.slug },
    });
    if (authError || !auth.user) {
      const duplicate = authError?.message.toLowerCase().includes("already") || authError?.message.toLowerCase().includes("registered");
      throw new OwnerApiError(duplicate ? "Username tersebut sudah digunakan. Pilih username lain." : authError?.message || "Akun staf gagal dibuat.", duplicate ? 409 : 500);
    }

    const { data, error } = await admin.from("warkop_members").insert({
      warkop_id: warkopId, user_id: auth.user.id, username, display_name: String(body.name || username).trim(), role, is_active: true,
    }).select().single();
    if (error) {
      await admin.auth.admin.deleteUser(auth.user.id);
      throw error;
    }
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    const { data: member, error: memberError } = await admin.from("warkop_members").select("id,user_id,username,display_name,role,is_active").eq("id", body.id).eq("warkop_id", warkopId).in("role", ["KASIR", "DAPUR"]).single();
    if (memberError) throw memberError;
    const staffMember = member as StaffMember;
    let authUserId = staffMember.user_id;
    if (body.password) {
      if (String(body.password).length < 6) return Response.json({ error: "Password minimal 6 karakter." }, { status: 400 });
      authUserId = await ensureStaffAuthUser(admin, warkopId, staffMember, String(body.password));
    }
    if (body.isActive !== undefined) {
      const active = Boolean(body.isActive);
      if (!active) {
        const { data: openShift, error: shiftError } = await admin.from("shifts").select("id").eq("opened_by", member.id).eq("status", "OPEN").maybeSingle();
        if (shiftError) throw shiftError;
        if (openShift) throw new OwnerApiError("Akhiri shift kasir sebelum menonaktifkan akunnya.", 409);
      }
      if (!authUserId) authUserId = await ensureStaffAuthUser(admin, warkopId, staffMember);
      const { error: authError } = await admin.auth.admin.updateUserById(authUserId, { ban_duration: active ? "none" : "876000h" });
      if (authError) throw authError;
      const { error } = await admin.from("warkop_members").update({ is_active: active }).eq("id", member.id);
      if (error) throw error;
    }
    return Response.json({ success: true });
  } catch (error) { return ownerErrorResponse(error); }
}
