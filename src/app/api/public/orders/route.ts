import { deviceErrorResponse } from "@/lib/device-auth";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomToken, sha256 } from "@/lib/device-auth";
import { DEMO_MENU_DATA, isDemoSlug } from "@/lib/demo-menu";

const schema = z.object({
  slug: z.string().trim().min(1).max(100),
  tableId: z.string().uuid().optional(),
  tableNumber: z.string().trim().min(1).max(20).optional(),
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

    await enforceRateLimit(admin, request, "public-order", 30, 60);
    const customerToken = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(`order:${profile.id}:${input.idempotencyKey}`).digest("base64url");
    const proofHash = input.proofImage ? sha256(input.proofImage) : null;
    const { proofImage: ignoredProof, ...orderInput } = input;
    void ignoredProof;
    const requestHash = sha256(JSON.stringify({ ...orderInput, proofHash }));
    let proofPath: string | null = null;
    if (input.paymentMethod === "QRIS") {
      if (!input.proofImage) return Response.json({ error: "Bukti pembayaran QRIS wajib diunggah." }, { status: 400 });
      const proof = decodeProof(input.proofImage);
      proofPath = `${profile.id}/orders/${input.idempotencyKey}/${proofHash}.${proof.extension}`;
      const { error: uploadError } = await admin.storage.from("bukti-transfer").upload(proofPath, proof.buffer, { contentType: proof.contentType, upsert: false });
      if (uploadError && String(uploadError.statusCode) !== "409") throw uploadError;
    }

    const { data: order, error: rpcError } = await admin.rpc("create_order_v2", {
      p_warkop_id: profile.id, p_input: orderInput, p_hash: requestHash,
      p_token_hash: sha256(customerToken), p_proof_path: proofPath,
    });
    if (rpcError) {
      // A tenant may have been deleted while the proof was uploading.
      if (proofPath) {
        const tenant = await admin.from("warkops").select("id").eq("id", profile.id).maybeSingle();
        if (!tenant.error && !tenant.data) {
          const queued = await admin.from("storage_cleanup_jobs").upsert({ bucket: "bukti-transfer", path: proofPath }, { onConflict: "bucket,path" });
          if (queued.error) console.error("Deleted tenant proof cleanup could not be queued", queued.error);
        }
      }
      // Keep deterministic proof on transient failures; retries may have committed.
      if (rpcError.code === "P0001") return Response.json({ error: rpcError.message }, { status: 409 });
      throw rpcError;
    }

    return Response.json({ order, customerToken }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Data pesanan tidak valid." }, { status: 400 });
    return deviceErrorResponse(error);
  }
}
