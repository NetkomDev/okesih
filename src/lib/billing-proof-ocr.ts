import "server-only";

import path from "node:path";
import { recognize } from "tesseract.js";

const PAYMENT_TERMS = /TRANSFER|PEMBAYARAN|BERHASIL|SUKSES|SUCCESS|QRIS|NOMINAL|JUMLAH|TOTAL|AMOUNT|TRANSAKSI/i;
const AMOUNT_PATTERN = /(?:RP\.?|IDR|TOTAL|NOMINAL|JUMLAH|AMOUNT)\s*[:=]?\s*([0-9][0-9.,\s]{0,18})/gi;

export type BillingProofOcrResult = {
  verified: boolean;
  confidence: number;
  extractedAmounts: number[];
  rawText: string;
  reason: string;
};

export async function verifyBillingProof(image: Buffer, expectedAmount: number): Promise<BillingProofOcrResult> {
  const result = await recognize(image, "eng", {
    workerPath: path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
    langPath: path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0"),
    gzip: true,
    cacheMethod: "none",
  });
  const rawText = result.data.text.trim().slice(0, 8_000);
  const extractedAmounts = Array.from(rawText.matchAll(AMOUNT_PATTERN))
    .map((match) => Number(match[1].replace(/\D/g, "")))
    .filter((amount) => Number.isSafeInteger(amount) && amount > 0);
  const confidence = Math.round(Number(result.data.confidence || 0) * 10) / 10;
  const hasPaymentContext = PAYMENT_TERMS.test(rawText);
  const amountMatches = extractedAmounts.includes(Math.round(expectedAmount));
  const verified = confidence >= 30 && hasPaymentContext && amountMatches;

  let reason = "Bukti transfer terverifikasi.";
  if (!rawText) reason = "Teks pada gambar tidak terbaca.";
  else if (!hasPaymentContext) reason = "Gambar tidak dikenali sebagai bukti transaksi.";
  else if (!amountMatches) reason = `Nominal Rp ${Math.round(expectedAmount).toLocaleString("id-ID")} tidak ditemukan pada bukti.`;
  else if (confidence < 30) reason = "Kualitas gambar terlalu rendah untuk diverifikasi.";

  return { verified, confidence, extractedAmounts: [...new Set(extractedAmounts)], rawText, reason };
}
