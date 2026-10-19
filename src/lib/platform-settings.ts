import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

export type PlatformSettings = {
  queueDismissSeconds: number;
  saasFeePerReceipt: number;
  defaultMarketingCommission: number;
  coordinatorCommissionPerReceipt: number;
  qrisImageUrl: string;
  qrisMerchantName: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  updatedAt: string | null;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  queueDismissSeconds: 60,
  saasFeePerReceipt: 50,
  defaultMarketingCommission: 0,
  coordinatorCommissionPerReceipt: 0,
  qrisImageUrl:
    "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020101021126570014ID.LINKAJA.WWW01189360091100210001000215ID10293847565204549953033605802ID5920OKESIH+SAAS+PUSAT6007JAKARTA61051234062070703A016304",
  qrisMerchantName: "OKESIH SAAS PUSAT (BANK CENTRAL ASIA)",
  bankName: "BCA",
  bankAccountNumber: "8001928374",
  bankAccountName: "PT OKESIH KARYA DIGITAL",
  updatedAt: null,
};

export function parsePlatformSettings(
  row: Record<string, unknown> | null | undefined
): PlatformSettings {
  if (!row) return DEFAULT_PLATFORM_SETTINGS;
  return {
    queueDismissSeconds: Number(
      row.global_queue_dismiss_seconds ?? DEFAULT_PLATFORM_SETTINGS.queueDismissSeconds
    ),
    saasFeePerReceipt: Number(
      row.saas_fee_per_receipt ?? DEFAULT_PLATFORM_SETTINGS.saasFeePerReceipt
    ),
    defaultMarketingCommission: Number(
      row.default_marketing_commission ?? DEFAULT_PLATFORM_SETTINGS.defaultMarketingCommission
    ),
    coordinatorCommissionPerReceipt: Number(row.coordinator_commission_per_receipt ?? 0),
    qrisImageUrl:
      typeof row.qris_image_url === "string" && row.qris_image_url
        ? row.qris_image_url
        : DEFAULT_PLATFORM_SETTINGS.qrisImageUrl,
    qrisMerchantName:
      typeof row.qris_merchant_name === "string" && row.qris_merchant_name
        ? row.qris_merchant_name
        : DEFAULT_PLATFORM_SETTINGS.qrisMerchantName,
    bankName:
      typeof row.bank_name === "string" && row.bank_name
        ? row.bank_name
        : DEFAULT_PLATFORM_SETTINGS.bankName,
    bankAccountNumber:
      typeof row.bank_account_number === "string" && row.bank_account_number
        ? row.bank_account_number
        : DEFAULT_PLATFORM_SETTINGS.bankAccountNumber,
    bankAccountName:
      typeof row.bank_account_name === "string" && row.bank_account_name
        ? row.bank_account_name
        : DEFAULT_PLATFORM_SETTINGS.bankAccountName,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

async function fetchPlatformSettingsRaw(): Promise<PlatformSettings> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_PLATFORM_SETTINGS;

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    if (error) {
      console.warn("Gagal membaca platform_settings:", error.message);
      return DEFAULT_PLATFORM_SETTINGS;
    }
    return parsePlatformSettings(data);
  } catch (err) {
    console.warn("Error saat fetch platform settings:", err);
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export const getPlatformSettings = unstable_cache(
  fetchPlatformSettingsRaw,
  ["platform-settings-global"],
  {
    revalidate: 60,
    tags: ["platform-settings"],
  }
);
