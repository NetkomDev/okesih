import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { OwnerApiError } from "@/lib/owner-api";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function readMenuRequest(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return { body: await request.json(), image: null };
  }
  const form = await request.formData();
  let body;
  try { body = JSON.parse(String(form.get("menu") || "{}")); }
  catch { throw new OwnerApiError("Data menu tidak valid.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new OwnerApiError("Data menu tidak valid.", 400);
  const file = form.get("image");
  if (file === null) return { body, image: null };
  if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 2 * 1024 * 1024) {
    throw new OwnerApiError("Foto menu harus berupa JPG, PNG, atau WebP maksimal 2 MB.", 400);
  }
  try {
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000 })
      .rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return { body, image };
  } catch {
    throw new OwnerApiError("Foto menu tidak dapat dibaca. Pilih gambar lain.", 400);
  }
}

export async function uploadMenuImage(admin: Admin, warkopId: string, image: Buffer | null) {
  if (!image) return null;
  const path = `${warkopId}/${randomUUID()}.webp`;
  const { error } = await admin.storage.from("menu-images").upload(path, image, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return { path, url: admin.storage.from("menu-images").getPublicUrl(path).data.publicUrl };
}

export async function removeMenuImage(admin: Admin, warkopId: string, url: string | null) {
  if (!url) return;
  const prefix = admin.storage.from("menu-images").getPublicUrl(`${warkopId}/`).data.publicUrl;
  if (url.startsWith(prefix)) {
    const filename = url.slice(prefix.length);
    if (/^[a-f0-9-]+\.webp$/.test(filename)) await admin.storage.from("menu-images").remove([`${warkopId}/${filename}`]);
  }
}
