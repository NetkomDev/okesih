import { assertSameOrigin } from "@/lib/device-auth";
import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId, user } = await requireOwner(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_LOGO_SIZE) {
      return Response.json({ error: "Logo wajib berupa PNG/JPG/WebP maksimal 2 MB." }, { status: 400 });
    }

    const path = `${warkopId}/current`;
    const { error: uploadError } = await admin.storage.from("business-logos").upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "0",
    });
    if (uploadError) throw uploadError;

    const { data } = admin.storage.from("business-logos").getPublicUrl(path);
    const logoUrl = `${data.publicUrl}?v=${Date.now()}`;
    const { error } = await admin.from("warkops").update({ logo_url: logoUrl }).eq("id", warkopId);
    if (error) throw error;
    await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, action: "BUSINESS_LOGO_UPDATED", target_type: "warkop", target_id: warkopId });
    return Response.json({ data: { logoUrl } });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId, user } = await requireOwner(request);
    const { error } = await admin.from("warkops").update({ logo_url: null }).eq("id", warkopId);
    if (error) throw error;
    await admin.storage.from("business-logos").remove([`${warkopId}/current`]);
    await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, action: "BUSINESS_LOGO_REMOVED", target_type: "warkop", target_id: warkopId });
    return Response.json({ success: true });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}
