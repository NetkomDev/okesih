import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrustedUserRole } from "@/lib/auth-role";
import { randomUUID } from "node:crypto";

const MAX_QRIS_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const role = getTrustedUserRole(user);
    const isSuperAdmin = role === "SUPERADMIN" || user?.email?.toLowerCase().startsWith("superadmin");

    if (!user || !isSuperAdmin) {
      return NextResponse.json({ error: "Hanya super admin yang berhak mengunggah QRIS Pusat." }, { status: 403 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Konfigurasi server database belum lengkap." }, { status: 500 });
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_QRIS_SIZE) {
      return NextResponse.json(
        { error: "File QRIS Pusat wajib berupa gambar PNG, JPG, atau WebP maksimal 4 MB." },
        { status: 400 }
      );
    }

    const ext = EXTENSIONS[file.type] || "png";
    const path = `central-qris/qris-pusat-${randomUUID()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("qris-warkop")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.error("Gagal mengunggah QRIS Pusat ke storage:", uploadError);
      return NextResponse.json({ error: "Gagal mengunggah gambar ke storage." }, { status: 500 });
    }

    const { data: publicUrlData } = admin.storage.from("qris-warkop").getPublicUrl(path);
    const qrisImageUrl = publicUrlData.publicUrl;

    // Perbarui URL gambar QRIS di platform_settings
    const { error: updateError } = await admin
      .from("platform_settings")
      .update({
        qris_image_url: qrisImageUrl,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", "global");

    if (updateError) {
      console.error("Gagal mengupdate platform_settings dengan QRIS baru:", updateError);
      return NextResponse.json({ error: "Gambar berhasil diunggah namun gagal disimpan ke konfigurasi platform." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        qrisImageUrl,
      },
    });
  } catch (error) {
    console.error("Superadmin upload QRIS error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan saat mengunggah QRIS Pusat." },
      { status: 500 }
    );
  }
}
