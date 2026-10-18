import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

export async function POST(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return Response.json({ error: "Nama waiter wajib diisi." }, { status: 400 });
    const { data, error } = await admin.from("waiters").insert({ warkop_id: warkopId, name, phone: String(body.phone || "").trim() || null }).select().single();
    if (error) throw error;
    return Response.json({ data });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const id = new URL(request.url).searchParams.get("id");
    const { error } = await admin.from("waiters").delete().eq("id", id).eq("warkop_id", warkopId);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) { return ownerErrorResponse(error); }
}

export async function GET(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const { data, error } = await admin.from("waiters").select("id,name,phone,is_active").eq("warkop_id", warkopId).order("created_at");
    if (error) throw error;
    return Response.json({ data: { waiters: data || [] } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return ownerErrorResponse(error); }
}
