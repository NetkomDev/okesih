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
  durationMs: number;
  memoryRssMb: number;
};

// Semaphore antrean: batasi konkurensi maksimum eksekusi Tesseract menjadi 1 job pada satu waktu
// per instance untuk mencegah lonjakan memori ganda OOM (N * 200MB) dan CPU throttling di serverless.
let activeOcrQueue: Promise<unknown> = Promise.resolve();

function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) return false;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  return false;
}

export async function verifyBillingProof(
  image: Buffer,
  expectedAmount: number,
  timeoutMs = 25_000
): Promise<BillingProofOcrResult> {
  const startTime = performance.now();

  // 1. Validasi cepat magic bytes citra sebelum memuat worker WASM
  if (!isValidImageBuffer(image)) {
    return {
      verified: false,
      confidence: 0,
      extractedAmounts: [],
      rawText: "",
      reason: "Berkas bukan format citra valid (PNG, JPEG, atau WebP).",
      durationMs: Math.round(performance.now() - startTime),
      memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
  }

  // 2. Jalankan melalui antrean berurutan (serialized queue)
  const previousQueue = activeOcrQueue;
  let releaseSlot: () => void;
  const currentSlot = new Promise<void>((resolve) => {
    releaseSlot = resolve;
  });
  activeOcrQueue = previousQueue.then(() => currentSlot, () => currentSlot);

  await previousQueue.catch(() => {});

  try {
    const ocrTask = recognize(image, "eng", {
      workerPath: path.join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js"),
      langPath: path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0"),
      gzip: true,
      cacheMethod: "none",
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Batas waktu pengenalan teks (OCR) terlampaui.")), timeoutMs);
    });

    const result = await Promise.race([ocrTask, timeoutPromise]);
    const durationMs = Math.round(performance.now() - startTime);
    const memoryRssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

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

    return {
      verified,
      confidence,
      extractedAmounts: [...new Set(extractedAmounts)],
      rawText,
      reason,
      durationMs,
      memoryRssMb,
    };
  } finally {
    releaseSlot!();
  }
}
