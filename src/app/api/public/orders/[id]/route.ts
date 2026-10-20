import { createAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/device-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || token.length < 30) return Response.json({ error: "Token pesanan diperlukan." }, { status: 401 });
  const { id } = await params;
  if (id.startsWith("demo-")) {
    return Response.json({
      order: {
        id,
        table_number: "01",
        nomor_antrean: 5,
        total_harga: 32000,
        payment_method: "QRIS",
        status_pesanan: "COOKING",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("transactions")
    .select("id,table_number,nomor_antrean,total_harga,payment_method,status_pesanan,created_at,updated_at")
    .eq("id", id)
    .eq("customer_access_token_hash", sha256(token))
    .maybeSingle();
  if (error || !order) return Response.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  return Response.json({ order }, { headers: { "Cache-Control": "no-store" } });
}

