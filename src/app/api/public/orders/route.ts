import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken, sha256 } from "@/lib/device-auth";
import { DEMO_MENU_DATA, isDemoSlug } from "@/lib/demo-menu";

const schema = z.object({
  slug: z.string().trim().min(1).max(100),
  tableId: z.string().uuid().optional(),
  tableNumber: z.string().trim().min(1).max(30).optional(),
  paymentMethod: z.enum(["QRIS", "CASH"]),
  idempotencyKey: z.string().uuid(),
  proofImage: z.string().max(3_000_000).nullable().optional(),
  items: z.array(z.object({
    menuId: z.string().uuid(),
    qty: z.number().int().min(1).max(99),
    notes: z.string().trim().max(300).default(""),
  })).min(1).max(50),
}).refine((value) => value.tableId || value.tableNumber, { message: "Identitas meja wajib ada." });

function decodeProof(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Format bukti pembayaran tidak didukung.");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 2 * 1024 * 1024) throw new Error("Ukuran bukti pembayaran maksimal 2 MB.");
  return { buffer, contentType: match[1], extension: match[1].split("/")[1].replace("jpeg", "jpg") };
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());

    if (isDemoSlug(input.slug)) {
      const items = input.items.map((item) => {
        const found = DEMO_MENU_DATA.menus.find((m) => m.id === item.menuId);
        return {
          menu_id: item.menuId,
          name: found ? found.nama : "Menu Demo",
          price: found ? found.harga : 15000,
          qty: item.qty,
          notes: item.notes,
        };
      });
      const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
      const customerToken = randomToken();
      const fakeOrder = {
        id: `demo-${randomUUID()}`,
        queueNumber: Math.floor(Math.random() * 25) + 1,
        total,
      };
      return Response.json({ order: fakeOrder, customerToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin.from("warkops").select("id,is_active").eq("slug", input.slug).eq("is_active", true).maybeSingle();
    if (!profile) return Response.json({ error: "Usaha tidak ditemukan atau sedang tidak aktif." }, { status: 404 });

    let tableQuery = admin.from("warkop_tables").select("id,label").eq("warkop_id", profile.id).eq("is_active", true);
    tableQuery = input.tableId ? tableQuery.eq("id", input.tableId) : tableQuery.eq("label", input.tableNumber!);
    const { data: table } = await tableQuery.maybeSingle();
    if (!table) return Response.json({ error: "Nomor meja tidak valid." }, { status: 400 });

    const uniqueMenuIds = [...new Set(input.items.map((item) => item.menuId))];
    const { data: menuRows, error: menuError } = await admin.from("menus").select("id,nama,harga,is_available").eq("warkop_id", profile.id).in("id", uniqueMenuIds).eq("is_available", true);
    if (menuError || !menuRows || menuRows.length !== uniqueMenuIds.length) return Response.json({ error: "Salah satu menu tidak tersedia." }, { status: 400 });
    const menuMap = new Map(menuRows.map((menu) => [menu.id, menu]));
    const items = input.items.map((item) => {
      const menu = menuMap.get(item.menuId)!;
      return { menu_id: menu.id, name: menu.nama, price: Number(menu.harga), qty: item.qty, notes: item.notes };
    });
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    if (!Number.isFinite(total) || total <= 0) return Response.json({ error: "Total pesanan tidak valid." }, { status: 400 });

    let proofPath: string | null = null;
    if (input.paymentMethod === "QRIS") {
      if (!input.proofImage) return Response.json({ error: "Bukti pembayaran QRIS wajib diunggah." }, { status: 400 });
      const proof = decodeProof(input.proofImage);
      proofPath = `${profile.id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${proof.extension}`;
      const { error: uploadError } = await admin.storage.from("bukti-transfer").upload(proofPath, proof.buffer, { contentType: proof.contentType, upsert: false });
      if (uploadError) throw uploadError;
    }

    const customerToken = randomToken();
    const { data: order, error: rpcError } = await admin.rpc("create_customer_order", {
      p_warkop_id: profile.id,
      p_table_number: table.label,
      p_payment_method: input.paymentMethod,
      p_payment_proof_url: proofPath,
      p_items: items,
      p_total: total,
      p_idempotency_key: input.idempotencyKey,
      p_customer_token_hash: sha256(customerToken),
    });
    if (rpcError) throw rpcError;

    return Response.json({ order, customerToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data pesanan tidak valid." }, { status: 400 });
    return Response.json({ error: error instanceof Error ? error.message : "Pesanan gagal disimpan." }, { status: 500 });
  }
}
