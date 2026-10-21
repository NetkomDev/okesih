import "server-only";
import path from "node:path";
import { fork } from "node:child_process";
import sharp from "sharp";

export type BillingProofOcrResult = {
  verified: boolean; confidence: number; extractedAmounts: number[];
  rawText: string; reason: string; durationMs: number; memoryRssMb: number;
};
let active = false;

/** OCR supplies advisory text only. It never authorizes settlement. */
export async function verifyBillingProof(image: Buffer, expectedAmount: number, timeoutMs = 25_000): Promise<BillingProofOcrResult> {
  const start = performance.now();
  const result = (reason: string, rawText = "", confidence = 0): BillingProofOcrResult => {
    const amounts = [...rawText.matchAll(/(?:RP\.?|IDR|TOTAL|NOMINAL|JUMLAH|AMOUNT)\s*[:=]?\s*([0-9][0-9.,]{0,18})/gi)]
      .map(match => Number(match[1].replace(/[.,]\d{2}$/, "").replace(/\D/g, "")))
      .filter(amount => Number.isSafeInteger(amount) && amount > 0);
    return { verified: confidence >= 30 && amounts.includes(Math.round(expectedAmount)), confidence,
      extractedAmounts: [...new Set(amounts)], rawText, reason,
      durationMs: Math.round(performance.now() - start), memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024) };
  };
  if (image.length > 4 * 1024 * 1024) throw new Error("Gambar melebihi batas 4 MB.");
  const metadata = await sharp(image, { limitInputPixels: 16_000_000 }).metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format || "") || (metadata.pages || 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > 16_000_000) {
    throw new Error("Format atau dimensi gambar tidak didukung.");
  }
  if (active) return result("OCR sedang sibuk; bukti memerlukan pemeriksaan manual.");
  active = true;
  try {
    return await new Promise<BillingProofOcrResult>((resolve) => {
      const child = fork(path.join(process.cwd(), "scripts/ocr-task.mjs"), [], { stdio: ["ignore", "ignore", "ignore", "ipc"], execArgv: [] });
      let output = result("OCR tidak tersedia; bukti memerlukan pemeriksaan manual.");
      const timer = setTimeout(() => { output = result("Batas waktu OCR tercapai; bukti memerlukan pemeriksaan manual."); child.kill("SIGKILL"); }, timeoutMs);
      child.once("message", (value: { text?: string; confidence?: number }) => {
        output = result("Hasil OCR hanya petunjuk; Superadmin wajib memeriksa pembayaran.", String(value.text || "").slice(0, 8000), Number(value.confidence) || 0);
      });
      child.once("error", () => { /* close follows error, including failure to spawn. */ });
      child.once("close", () => { clearTimeout(timer); resolve(output); });
      child.send({ image: image.toString("base64") }, () => {});
    });
  } finally { active = false; }
}
