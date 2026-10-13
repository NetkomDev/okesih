import { ownerErrorResponse, requireOwner } from "@/lib/owner-api";

export async function GET(request: Request) {
  try {
    const { admin, warkopId } = await requireOwner(request);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const start = new Date(`${today}T00:00:00+08:00`).toISOString();
    const end = new Date(`${today}T23:59:59.999+08:00`).toISOString();

    const [profile, menus, members, waiters, tables, transactions, billing] = await Promise.all([
      admin.from("warkops").select("id,nama,slug,is_active,logo_url,qris_image_url,qris_merchant_name").eq("id", warkopId).single(),
      admin.from("menus").select("id,nama,harga,kategori,desc_menu,is_available").eq("warkop_id", warkopId).order("created_at", { ascending: false }),
      admin.from("warkop_members").select("id,username,display_name,role,is_active,user_id").eq("warkop_id", warkopId).neq("role", "OWNER").order("created_at"),
      admin.from("waiters").select("id,name,phone,is_active").eq("warkop_id", warkopId).order("created_at"),
      admin.from("warkop_tables").select("id,label,sort_order,is_active").eq("warkop_id", warkopId).order("sort_order"),
      admin.from("transactions").select("id,total_harga,payment_method,status_pesanan").eq("warkop_id", warkopId).gte("created_at", start).lte("created_at", end).not("status_pesanan", "in", "(VOID,REJECTED)"),
      admin.from("saas_billings").select("tagihan_pokok,kode_unik,total_tagihan,status_bayar").eq("warkop_id", warkopId).eq("tanggal", today).maybeSingle(),
    ]);

    for (const result of [profile, menus, members, waiters, tables, transactions, billing]) {
      if (result.error) throw result.error;
    }

    const tx = transactions.data || [];
    const cash = tx.filter((item) => item.payment_method === "CASH").reduce((sum, item) => sum + Number(item.total_harga), 0);
    const qris = tx.filter((item) => item.payment_method === "QRIS").reduce((sum, item) => sum + Number(item.total_harga), 0);

    return Response.json({
      data: {
        profile: profile.data,
        menus: (menus.data || []).map((item) => ({ id: item.id, name: item.nama, price: Number(item.harga), category: item.kategori, description: item.desc_menu || "-", isAvailable: item.is_available })),
        staff: (members.data || []).map((item) => ({ id: item.id, username: item.username, name: item.display_name || item.username, role: item.role, status: item.is_active ? "ACTIVE" : "INACTIVE" })),
        waiters: waiters.data || [],
        tables: tables.data || [],
        metrics: { receiptCount: tx.length, cash, qris, total: cash + qris, billing: billing.data },
      },
    });
  } catch (error) {
    return ownerErrorResponse(error);
  }
}
