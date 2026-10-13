import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

const MAX_QRIS_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const form = await request.formData();
    const file = form.get("file");
    const merchantName = String(form.get("merchantName") || "").trim();
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_QRIS_SIZE) {
      return Response.json({ error: "QRIS wajib berupa PNG/JPG/WebP maksimal 3 MB." }, { status: 400 });
    }
    if (!merchantName) return Response.json({ error: "Nama merchant wajib diisi." }, { status: 400 });

    const path = `${warkopId}/current`;
    const { error: uploadError } = await admin.storage.from("qris-warkop").upload(path, file, {
      upsert: true, contentType: file.type, cacheControl: "0",
    });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = admin.storage.from("qris-warkop").getPublicUrl(path);
    const versionedUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
    const { error } = await admin.from("warkops").update({ qris_image_url: versionedUrl, qris_merchant_name: merchantName }).eq("id", warkopId);
    if (error) throw error;
    return Response.json({ data: { qrisImageUrl: versionedUrl, merchantName } });
  } catch (error) { return ownerErrorResponse(error); }
}
