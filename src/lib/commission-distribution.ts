import type { SupabaseClient } from "@supabase/supabase-js";
import { isCoordinatorLevel } from "./affiliate";

/**
 * Mendistribusikan komisi tagihan sewa (SaaS Billing) secara otomatis dan idempoten:
 * - Komisi Langsung ke Mitra Marketing
 * - Bonus Jaringan ke Koordinator Mitra (jika mitra memiliki upline koordinator)
 * Berjalan aman baik bila trigger database aktif maupun sebagai fallback aplikasi.
 */
export async function distributeBillingCommissions(
  billingId: string,
  adminClient: SupabaseClient
): Promise<void> {
  try {
    // 1. Ambil data tagihan
    const { data: billing, error: bError } = await adminClient
      .from("saas_billings")
      .select("id, warkop_id, total_transactions, status_bayar")
      .eq("id", billingId)
      .maybeSingle();

    if (bError || !billing || billing.status_bayar !== "PAID") return;
    const receipts = Number(billing.total_transactions) || 0;
    if (receipts <= 0) return;

    // 2. Ambil warkop & agen marketing terkait
    const { data: warkop, error: wError } = await adminClient
      .from("warkops")
      .select("id, nama, marketing_agent_id")
      .eq("id", billing.warkop_id)
      .maybeSingle();

    if (wError || !warkop || !warkop.marketing_agent_id) return;

    // 3. Baca Parameter Master Global
    const { data: settings } = await adminClient
      .from("platform_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    const directRate = Number(settings?.default_marketing_commission ?? 10);
    const networkRate = Number(settings?.coordinator_commission_per_receipt ?? 5);

    // 4. Ambil data Mitra Marketing langsung
    const { data: partner, error: pError } = await adminClient
      .from("marketing_partners")
      .select("id, full_name, status, membership_level, upline_id, notes_admin")
      .eq("id", warkop.marketing_agent_id)
      .maybeSingle();

    if (pError || !partner) return;

    // Tentukan upline ID (dari kolom upline_id atau tag [UPLINE:uuid] pada notes_admin)
    let uplineId = partner.upline_id;
    if (!uplineId && typeof partner.notes_admin === "string") {
      const match = partner.notes_admin.match(/\[UPLINE:([a-f0-9-]+)\]/i);
      if (match) uplineId = match[1];
    }

    // 5. Catat Komisi Langsung Mitra Marketing
    if (directRate > 0) {
      const directAmount = receipts * directRate;
      await adminClient
        .from("marketing_commission_mutations")
        .upsert(
          {
            billing_id: billing.id,
            warkop_id: warkop.id,
            partner_id: partner.id,
            source_partner_id: partner.id,
            kind: "DIRECT",
            receipts_count: receipts,
            rate_per_receipt: directRate,
            total_amount: directAmount,
            notes: `Komisi Struk ${warkop.nama || "Tenant"} (${receipts} struk @ Rp ${directRate})`,
          },
          { onConflict: "billing_id,kind" }
        );
    }

    // 6. Catat Bonus Jaringan Koordinator Mitra
    if (uplineId && networkRate > 0) {
      const { data: upline } = await adminClient
        .from("marketing_partners")
        .select("id, full_name, status, membership_level, notes_admin")
        .eq("id", uplineId)
        .maybeSingle();

      if (upline) {
        const isCoord = isCoordinatorLevel(upline.membership_level) ||
          (typeof upline.notes_admin === "string" && upline.notes_admin.includes("[LEVEL:COORDINATOR]"));

        if (isCoord) {
          const networkAmount = receipts * networkRate;
          await adminClient
            .from("marketing_commission_mutations")
            .upsert(
              {
                billing_id: billing.id,
                warkop_id: warkop.id,
                partner_id: upline.id,
                source_partner_id: partner.id,
                kind: "NETWORK",
                receipts_count: receipts,
                rate_per_receipt: networkRate,
                total_amount: networkAmount,
                notes: `Bonus Jaringan: ${partner.full_name || "Mitra"} - ${warkop.nama || "Tenant"} (${receipts} struk @ Rp ${networkRate})`,
              },
              { onConflict: "billing_id,kind" }
            );
        }
      }
    }
  } catch (err) {
    console.warn("Peringatan saat distribusi komisi billing:", err);
  }
}
