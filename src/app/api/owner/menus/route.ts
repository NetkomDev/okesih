import { readMenuRequest, uploadMenuImage, removeMenuImage } from "@/lib/menu-image";
import { assertSameOrigin } from "@/lib/device-auth";
import { ownerErrorResponse, requireOwner, touchWarkopUpdatedAt } from "@/lib/owner-api";

function normalizeCategory(value: unknown) {
  const category = String(value || "").trim().replace(/\s+/g, " ");
  return category.length > 0 && category.length <= 50 ? category : null;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const { body, image } = await readMenuRequest(request);
    if (!String(body.name || "").trim() || Number(body.price) <= 0) return Response.json({ error: "Nama dan harga menu wajib valid." }, { status: 400 });
    const category = normalizeCategory(body.category);
    if (!category) return Response.json({ error: "Kategori wajib diisi dan maksimal 50 karakter." }, { status: 400 });
    const uploaded = await uploadMenuImage(admin, warkopId, image);
    const { data, error } = await admin.from("menus").insert({ warkop_id: warkopId, nama: String(body.name).trim(), harga: Number(body.price), kategori: category, desc_menu: String(body.description || "-").trim(), is_available: true, image_url: uploaded?.url || null }).select().single();
    if (error) {
      if (uploaded) await removeMenuImage(admin, warkopId, uploaded.url);
      throw error;
    }
    await touchWarkopUpdatedAt(admin, warkopId);
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const { body, image } = await readMenuRequest(request);
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined && String(body.name).trim()) updates.nama = String(body.name).trim();
    if (body.price !== undefined) updates.harga = Number(body.price);
    if (body.description !== undefined) updates.desc_menu = String(body.description || "-").trim();
    if (body.isAvailable !== undefined) updates.is_available = Boolean(body.isAvailable);
    if (body.category !== undefined) {
      const category = normalizeCategory(body.category);
      if (!category) return Response.json({ error: "Kategori wajib diisi dan maksimal 50 karakter." }, { status: 400 });
      updates.kategori = category;
    }
    if (Object.keys(updates).length === 0 && !image) return Response.json({ error: "Tidak ada perubahan menu yang dikirim." }, { status: 400 });
    const { data: current, error: currentError } = await admin.from("menus").select("image_url").eq("id", body.id).eq("warkop_id", warkopId).single();
    if (currentError) throw currentError;
    const uploaded = await uploadMenuImage(admin, warkopId, image);
    if (uploaded) updates.image_url = uploaded.url;
    const { data, error } = await admin.from("menus").update(updates).eq("id", body.id).eq("warkop_id", warkopId).select().single();
    if (error) {
      if (uploaded) await removeMenuImage(admin, warkopId, uploaded.url);
      throw error;
    }
    if (uploaded) await removeMenuImage(admin, warkopId, current.image_url);
    await touchWarkopUpdatedAt(admin, warkopId);
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "ID menu wajib diisi." }, { status: 400 });
    const { data: deleted, error } = await admin.from("menus").delete().eq("id", id).eq("warkop_id", warkopId).select("image_url");
    if (error) throw error;
    for (const menu of deleted || []) await removeMenuImage(admin, warkopId, menu.image_url);
    await touchWarkopUpdatedAt(admin, warkopId);
    return Response.json({ success: true });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function GET(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const { data, error } = await admin.from("menus").select("id,nama,harga,kategori,desc_menu,is_available,image_url").eq("warkop_id", warkopId).order("created_at");
    if (error) throw error;
    return Response.json({ data: { menus: (data || []).map(item => ({ id: item.id, name: item.nama, price: Number(item.harga), category: item.kategori, description: item.desc_menu || "-", isAvailable: item.is_available, imageUrl: item.image_url })) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ownerErrorResponse(error); }
}
