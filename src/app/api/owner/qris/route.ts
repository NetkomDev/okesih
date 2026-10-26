import { assertSameOrigin } from "@/lib/device-auth";
import { ownerErrorResponse, OwnerApiError, requireOwner } from "@/lib/owner-api";
import { randomUUID } from "node:crypto";

const MAX_QRIS_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function storagePath(publicUrl: string | null) {
  if (!publicUrl) return null;
  try {
    const marker = "/storage/v1/object/public/qris-warkop/";
    const path = new URL(publicUrl).pathname;
    const index = path.indexOf(marker);
    return index < 0 ? null : decodeURIComponent(path.slice(index + marker.length));
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const form = await request.formData();
    const file = form.get("file");
    const merchantName = String(form.get("merchantName") || "").trim();
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_QRIS_SIZE) {
      return Response.json({ error: "QRIS wajib berupa PNG/JPG/WebP maksimal 3 MB." }, { status: 400 });
    }
    if (!merchantName || merchantName.length > 180) return Response.json({ error: "Nama merchant wajib diisi, maksimal 180 karakter." }, { status: 400 });

    const { data: current, error: currentError } = await admin.from("warkops").select("qris_image_url").eq("id", warkopId).single();
    if (currentError) throw currentError;
    const path = `${warkopId}/${randomUUID()}.${EXTENSIONS[file.type]}`;
    const { error: uploadError } = await admin.storage.from("qris-warkop").upload(path, file, {
      upsert: false, contentType: file.type, cacheControl: "31536000",
    });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = admin.storage.from("qris-warkop").getPublicUrl(path);
    const versionedUrl = publicUrl.publicUrl;
    const { error } = await admin.from("warkops").update({ qris_image_url: versionedUrl, qris_merchant_name: merchantName, updated_at: new Date().toISOString() }).eq("id", warkopId).select("id").single();
    if (error) {
      await admin.storage.from("qris-warkop").remove([path]);
      throw error;
    }
    const oldPath = storagePath(current?.qris_image_url || null);
    if (oldPath && oldPath !== path) await admin.storage.from("qris-warkop").remove([oldPath]);
    return Response.json({ data: { qrisImageUrl: versionedUrl, merchantName } });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const merchantName = String((await request.json()).merchantName || "").trim();
    if (!merchantName || merchantName.length > 180) throw new OwnerApiError("Nama merchant wajib diisi, maksimal 180 karakter.", 400);
    const { data, error } = await admin.from("warkops").update({ qris_merchant_name: merchantName, updated_at: new Date().toISOString() }).eq("id", warkopId).select("qris_merchant_name").single();
    if (error) throw error;
    return Response.json({ data: { merchantName: data.qris_merchant_name } });
  } catch (error) { return ownerErrorResponse(error); }
}
