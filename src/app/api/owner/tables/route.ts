import { assertSameOrigin } from "@/lib/device-auth";
import { ownerErrorResponse, OwnerApiError, requireOwner } from "@/lib/owner-api";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { admin, warkopId } = await requireOwner(request);
    const body = await request.json();
    const labels: unknown[] = Array.isArray(body.labels) ? body.labels : [body.label];
    const normalized = labels
      .map((value: unknown) => String(value || "").trim())
      .filter(Boolean);
    if (normalized.some((value) => value.length > 30)) throw new OwnerApiError("Nama nomor meja/kursi maksimal 30 karakter.", 400);
    const clean = [...new Set(normalized)].slice(0, 100);
    if (!clean.length) return Response.json({ error: "Masukkan minimal satu nama/nomor meja atau kursi." }, { status: 400 });

    const { data: existingTables } = await admin
      .from("warkop_tables")
      .select("sort_order")
      .eq("warkop_id", warkopId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const baseOrder = existingTables?.[0]?.sort_order || 0;
    const rows = clean.map((label, index) => ({
      warkop_id: warkopId,
      label,
      sort_order: baseOrder + index + 1,
      is_active: true,
    }));
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
    const id = String(body.id || "").trim();
    const label = String(body.label || "").trim();

    if (!id || !label || label.length > 30) throw new OwnerApiError("Nama/nomor meja atau kursi wajib diisi, maksimal 30 karakter.", 400);

    const { data: targetTable, error: targetError } = await admin
      .from("warkop_tables")
      .select("id,label")
      .eq("id", id)
      .eq("warkop_id", warkopId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!targetTable) throw new OwnerApiError("Meja tidak ditemukan.", 404);

    if (targetTable.label === label) {
      return Response.json({ data: targetTable });
    }

    // Cari apakah ada baris meja lain di warkop ini dengan label yang sama (atau varian 'Meja '+label)
    // agar tidak membuat nomor ganda
    const { data: conflictTable } = await admin
      .from("warkop_tables")
      .select("id,label")
      .eq("warkop_id", warkopId)
      .neq("id", id)
      .or(`label.ilike.${label},label.ilike.Meja ${label}`)
      .limit(1)
      .maybeSingle();

    if (conflictTable) {
      // Hapus meja duplikat tersebut agar nomor tidak ganda di Supabase
      await admin
        .from("warkop_tables")
        .delete()
        .eq("id", conflictTable.id)
        .eq("warkop_id", warkopId);
    }

    const { data, error } = await admin
      .from("warkop_tables")
      .update({ label })
      .eq("id", id)
      .eq("warkop_id", warkopId)
      .select("id,label")
      .single();

    if (error) throw error;
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
