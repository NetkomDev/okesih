import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoSlug } from "@/lib/demo-menu";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizedSlug = (slug || "").trim().toLowerCase();

  if (!normalizedSlug || isDemoSlug(normalizedSlug)) {
    const initializedAt = Date.now();
    return Response.json({
      profile: {
        id: "demo",
        nama: "Warkop Kita",
        slug: "demo",
        logo_url: null,
        queue_dismiss_seconds: 60,
      },
      cooking: [
        { id: "demo-c-1", ticketNumber: 13, tableNumber: "02", createdAt: new Date(initializedAt - 120000).toISOString() },
        { id: "demo-c-2", ticketNumber: 14, tableNumber: "08", createdAt: new Date(initializedAt - 60000).toISOString() },
        { id: "demo-c-3", ticketNumber: 15, tableNumber: "03", createdAt: new Date(initializedAt - 20000).toISOString() },
      ],
      ready: [
        { id: "demo-r-1", ticketNumber: 11, tableNumber: "01", readyAt: initializedAt - 35000 },
        { id: "demo-r-2", ticketNumber: 12, tableNumber: "05", readyAt: initializedAt - 5000 },
      ],
      isDemo: true,
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }

  const admin = createAdminClient();
  const { data: profile, error: warkopError } = await admin
    .from("warkops")
    .select("id,nama,slug,is_active,logo_url,queue_dismiss_seconds")
    .eq("slug", normalizedSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (warkopError || !profile) {
    return Response.json({ error: "Usaha tidak ditemukan atau sedang tidak aktif." }, { status: 404 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: orders, error: ordersError } = await admin
    .from("transactions")
    .select("id,table_number,nomor_antrean,status_pesanan,created_at,updated_at")
    .eq("warkop_id", profile.id)
    .in("status_pesanan", ["COOKING", "READY"])
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (ordersError) {
    return Response.json({ error: "Gagal memuat antrean transaksi." }, { status: 500 });
  }

  const cooking = (orders || [])
    .filter((o) => o.status_pesanan === "COOKING")
    .map((o) => ({
      id: o.id,
      ticketNumber: o.nomor_antrean,
      tableNumber: o.table_number,
      createdAt: o.created_at,
    }));

  const ready = (orders || [])
    .filter((o) => o.status_pesanan === "READY")
    .map((o) => ({
      id: o.id,
      ticketNumber: o.nomor_antrean,
      tableNumber: o.table_number,
      readyAt: new Date(o.updated_at || o.created_at).getTime(),
    }));

  return Response.json({
    profile,
    cooking,
    ready,
    isDemo: false,
  }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
