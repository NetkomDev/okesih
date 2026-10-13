import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

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
    if (authError || !auth.user) throw new Error(authError?.message || "Akun staf gagal dibuat.");

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
    const { data: member, error: memberError } = await admin.from("warkop_members").select("id,user_id").eq("id", body.id).eq("warkop_id", warkopId).neq("role", "OWNER").single();
    if (memberError) throw memberError;
    if (body.password) {
      if (String(body.password).length < 6) return Response.json({ error: "Password minimal 6 karakter." }, { status: 400 });
      const { error } = await admin.auth.admin.updateUserById(member.user_id, { password: String(body.password) });
      if (error) throw error;
    }
    if (body.isActive !== undefined) {
      const active = Boolean(body.isActive);
      const { error: authError } = await admin.auth.admin.updateUserById(member.user_id, { ban_duration: active ? "none" : "876000h" });
      if (authError) throw authError;
      const { error } = await admin.from("warkop_members").update({ is_active: active }).eq("id", member.id);
      if (error) throw error;
    }
    return Response.json({ success: true });
  } catch (error) { return ownerErrorResponse(error); }
}
