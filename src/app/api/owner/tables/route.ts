import { assertSameOrigin } from "@/lib/device-auth";
import { ownerErrorResponse, OwnerApiError, requireOwner } from "@/lib/owner-api";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    const labels: unknown[] = Array.isArray(body.labels) ? body.labels : [body.label];
    const normalized = labels.map((value: unknown) => String(value || "").trim()).filter(Boolean);
    if (normalized.some((value) => value.length > 30)) throw new OwnerApiError("Nama meja maksimal 30 karakter.", 400);
    const clean = [...new Set(normalized)].slice(0, 100);
    if (!clean.length) return Response.json({ error: "Masukkan minimal satu nama/nomor meja." }, { status: 400 });
    const rows = clean.map((label, index) => ({ warkop_id: warkopId, label, sort_order: index + 1, is_active: true }));
    const { data, error } = await admin.from("warkop_tables").upsert(rows, { onConflict: "warkop_id,label", ignoreDuplicates: true }).select();
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    const id = String(body.id || "");
    const label = String(body.label || "").trim();
    if (!id || !label || label.length > 30) throw new OwnerApiError("Nama meja wajib diisi, maksimal 30 karakter.", 400);
    const { data, error } = await admin.from("warkop_tables").update({ label }).eq("id", id).eq("warkop_id", warkopId).select("id,label").maybeSingle();
    if (error?.code === "23505") throw new OwnerApiError("Nama meja tersebut sudah digunakan.", 409);
    if (error) throw error;
    if (!data) throw new OwnerApiError("Meja tidak ditemukan.", 404);
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new OwnerApiError("ID meja wajib diisi.", 400);
    const { data, error } = await admin.from("warkop_tables").delete().eq("id", id).eq("warkop_id", warkopId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new OwnerApiError("Meja tidak ditemukan.", 404);
    return Response.json({ success: true });
  } catch (error) { return ownerErrorResponse(error); }
}
