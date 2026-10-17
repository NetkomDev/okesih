import { assertSameOrigin } from "@/lib/device-auth";
import { ownerErrorResponse, OwnerApiError, requireOwner } from "@/lib/owner-api";
import { randomUUID } from "node:crypto";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function storagePath(publicUrl: string | null, bucket: string) {
  if (!publicUrl) return null;
  try {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const path = new URL(publicUrl).pathname;
    const index = path.indexOf(marker);
    return index < 0 ? null : decodeURIComponent(path.slice(index + marker.length));
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId, user } = await requireOwner(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_LOGO_SIZE) {
      return Response.json({ error: "Logo wajib berupa PNG/JPG/WebP maksimal 2 MB." }, { status: 400 });
    }

    const { data: current, error: currentError } = await admin.from("warkops").select("logo_url").eq("id", warkopId).single();
    if (currentError) throw currentError;
    const path = `${warkopId}/${randomUUID()}.${EXTENSIONS[file.type]}`;
    const { error: uploadError } = await admin.storage.from("business-logos").upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: "31536000",
    });
    if (uploadError) throw uploadError;

    const { data } = admin.storage.from("business-logos").getPublicUrl(path);
    const logoUrl = data.publicUrl;
    const { error } = await admin.from("warkops").update({ logo_url: logoUrl }).eq("id", warkopId);
    if (error) {
      await admin.storage.from("business-logos").remove([path]);
      throw error;
    }
    const oldPath = storagePath(current?.logo_url || null, "business-logos");
    if (oldPath && oldPath !== path) await admin.storage.from("business-logos").remove([oldPath]);
    await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, action: "BUSINESS_LOGO_UPDATED", target_type: "warkop", target_id: warkopId });
    return Response.json({ data: { logoUrl } });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId, user } = await requireOwner(request);
    const body = await request.json();
    const businessName = String(body.businessName || "").trim();
    const address = String(body.address || "").trim();
    if (businessName.length < 2 || businessName.length > 150) {
      throw new OwnerApiError("Nama usaha harus terdiri dari 2–150 karakter.", 400);
    }
    if (address.length < 5 || address.length > 500) {
      throw new OwnerApiError("Alamat lengkap usaha harus terdiri dari 5–500 karakter.", 400);
    }
    const { data, error } = await admin.from("warkops").update({ nama: businessName, address, updated_at: new Date().toISOString() }).eq("id", warkopId).select("nama,address").single();
    if (error) throw error;
    await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, action: "BUSINESS_IDENTITY_UPDATED", target_type: "warkop", target_id: warkopId });
    return Response.json({ data: { businessName: data.nama, address: data.address } });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId, user } = await requireOwner(request);
    const { data: current, error: currentError } = await admin.from("warkops").select("logo_url").eq("id", warkopId).single();
    if (currentError) throw currentError;
    const { error } = await admin.from("warkops").update({ logo_url: null }).eq("id", warkopId);
    if (error) throw error;
    const oldPath = storagePath(current?.logo_url || null, "business-logos");
    if (oldPath) await admin.storage.from("business-logos").remove([oldPath]);
    await admin.from("audit_logs").insert({ warkop_id: warkopId, actor_user_id: user.id, action: "BUSINESS_LOGO_REMOVED", target_type: "warkop", target_id: warkopId });
    return Response.json({ success: true });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}
