import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

function normalizeCategory(value: unknown) {
  const category = String(value || "").trim().replace(/\s+/g, " ");
  return category.length > 0 && category.length <= 50 ? category : null;
}

export async function POST(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    if (!String(body.name || "").trim() || Number(body.price) <= 0) return Response.json({ error: "Nama dan harga menu wajib valid." }, { status: 400 });
    const category = normalizeCategory(body.category);
    if (!category) return Response.json({ error: "Kategori wajib diisi dan maksimal 50 karakter." }, { status: 400 });
    const { data, error } = await admin.from("menus").insert({ warkop_id: warkopId, nama: String(body.name).trim(), harga: Number(body.price), kategori: category, desc_menu: String(body.description || "-").trim(), is_available: true }).select().single();
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.price !== undefined) updates.harga = Number(body.price);
    if (body.isAvailable !== undefined) updates.is_available = Boolean(body.isAvailable);
    if (body.category !== undefined) {
      const category = normalizeCategory(body.category);
      if (!category) return Response.json({ error: "Kategori wajib diisi dan maksimal 50 karakter." }, { status: 400 });
      updates.kategori = category;
    }
    if (Object.keys(updates).length === 0) return Response.json({ error: "Tidak ada perubahan menu yang dikirim." }, { status: 400 });
    const { data, error } = await admin.from("menus").update(updates).eq("id", body.id).eq("warkop_id", warkopId).select().single();
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return Response.json({ error: "ID menu wajib diisi." }, { status: 400 });
    const { error } = await admin.from("menus").delete().eq("id", id).eq("warkop_id", warkopId);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) { return ownerErrorResponse(error); }
}
