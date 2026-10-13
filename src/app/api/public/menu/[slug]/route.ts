import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("warkops")
    .select("id,nama,slug,is_active,qris_image_url,qris_merchant_name")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !profile) return Response.json({ error: "Usaha tidak ditemukan atau sedang tidak aktif." }, { status: 404 });

  const [{ data: menus, error: menuError }, { data: tables, error: tableError }] = await Promise.all([
    admin.from("menus").select("id,nama,harga,kategori,desc_menu").eq("warkop_id", profile.id).eq("is_available", true).order("kategori").order("nama"),
    admin.from("warkop_tables").select("label").eq("warkop_id", profile.id).eq("is_active", true).order("sort_order"),
  ]);
  if (menuError || tableError) return Response.json({ error: "Menu belum dapat dimuat." }, { status: 500 });

  return Response.json({ profile, menus: menus || [], tables: (tables || []).map((table) => table.label) }, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" },
  });
}

