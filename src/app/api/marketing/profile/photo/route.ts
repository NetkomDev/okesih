import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSameOrigin, DeviceApiError } from "@/lib/device-auth";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await createServerSupabaseClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user || user.app_metadata?.role !== "MARKETING") throw new DeviceApiError("Silakan login sebagai KorMit.", 401);
    const admin = createAdminClient();
    const { data: partner, error } = await admin.from("marketing_partners").select("id, profile_photo_url, updated_at")
      .eq("user_id", user.id).eq("status", "ACTIVE").eq("membership_level", "COORDINATOR").maybeSingle();
    if (error) throw error;
    if (!partner) throw new DeviceApiError("Upload foto hanya tersedia untuk KorMit aktif.", 403);
    if (Number(request.headers.get("content-length")) > 2 * 1024 * 1024) throw new DeviceApiError("Foto terlalu besar.", 413);
    const file = (await request.formData()).get("image");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 1024 * 1024) {
      throw new DeviceApiError("Pilih foto JPG, PNG, atau WebP maksimal 1 MB setelah crop.", 400);
    }
    let image: Buffer;
    try {
      image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000 })
        .rotate().resize(480, 720, { fit: "cover" }).webp({ quality: 75 }).toBuffer();
      if (image.length > 200 * 1024) throw new Error("Image too large");
    } catch { throw new DeviceApiError("Foto tidak dapat diproses. Pilih foto lain.", 400); }
    const storage = admin.storage.from("partner-photos");
    const path = `${partner.id}/${randomUUID()}.webp`;
    const uploaded = await storage.upload(path, image, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (uploaded.error) throw uploaded.error;
    const url = storage.getPublicUrl(path).data.publicUrl;
    const saved = await admin.from("marketing_partners").update({ profile_photo_url: url })
      .eq("id", partner.id).eq("updated_at", partner.updated_at).eq("status", "ACTIVE").eq("membership_level", "COORDINATOR").select("id").maybeSingle();
    if (saved.error || !saved.data) {
      await storage.remove([path]);
      if (saved.error) throw saved.error;
      throw new DeviceApiError("Profil berubah. Muat ulang halaman lalu coba lagi.", 409);
    }
    const prefix = storage.getPublicUrl(`${partner.id}/`).data.publicUrl;
    if (partner.profile_photo_url?.startsWith(prefix)) {
      const filename = partner.profile_photo_url.slice(prefix.length);
      if (/^[a-f0-9-]+\.webp$/.test(filename)) await storage.remove([`${partner.id}/${filename}`]);
    }
    return NextResponse.json({ photoUrl: url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Coordinator photo upload failed", error);
    return NextResponse.json({ error: error instanceof DeviceApiError ? error.message : "Foto belum tersimpan. Silakan coba lagi." }, { status: error instanceof DeviceApiError ? error.status : 500 });
  }
}
