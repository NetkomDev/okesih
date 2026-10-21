import { deleteExpiredBillingProofs } from "@/lib/billing-proof-retention";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorizedBySecret = Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
  if (!authorizedBySecret) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await deleteExpiredBillingProofs(createAdminClient());
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("Gagal membersihkan bukti billing kedaluwarsa:", error);
    return Response.json({ error: "Pembersihan bukti billing gagal." }, { status: 500 });
  }
}
