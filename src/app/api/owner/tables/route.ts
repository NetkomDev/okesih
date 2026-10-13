import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

export async function POST(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    const labels: unknown[] = Array.isArray(body.labels) ? body.labels : [body.label];
    const clean = [...new Set(labels.map((value: unknown) => String(value || "").trim()).filter(Boolean))].slice(0, 100);
    if (!clean.length) return Response.json({ error: "Masukkan minimal satu nama/nomor meja." }, { status: 400 });
    const rows = clean.map((label, index) => ({ warkop_id: warkopId, label, sort_order: index + 1, is_active: true }));
    const { data, error } = await admin.from("warkop_tables").upsert(rows, { onConflict: "warkop_id,label", ignoreDuplicates: true }).select();
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const id = new URL(request.url).searchParams.get("id");
    const { error } = await admin.from("warkop_tables").delete().eq("id", id).eq("warkop_id", warkopId);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) { return ownerErrorResponse(error); }
}
