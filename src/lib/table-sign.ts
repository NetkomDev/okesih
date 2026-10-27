import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { BusinessTable, Profile } from "@/components/owner/types";

export const TABLE_SIGN_WIDTH = 1024;
export const TABLE_SIGN_HEIGHT = 1536;
export const DEFAULT_TEMPLATE_PATH = "/images/qr-menu-table-sign.png";

/**
 * Format label meja agar rapi untuk dicetak.
 * Misalnya "1" menjadi "01", "meja 1" menjadi "01", dan mempertahankan nama khusus seperti "VIP 1".
 */
export function formatTableNumberForSign(rawLabel: string): string {
  const trimmed = (rawLabel || "").trim();
  const withoutMejaPrefix = trimmed.replace(/^meja\s+/i, "").trim();
  if (/^\d+$/.test(withoutMejaPrefix)) {
    return withoutMejaPrefix.length === 1 ? `0${withoutMejaPrefix}` : withoutMejaPrefix;
  }
  return withoutMejaPrefix || trimmed || "01";
}

/**
 * Memuat gambar secara asynchronous dengan error handling.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Gagal memuat gambar: ${src} (${err})`));
    img.src = src;
  });
}

/**
 * Menggambar stiker/papan meja standar resmi OKESIH ke dalam HTML5 Canvas.
 * Mengikuti tata letak "Papan meja cafeone.id nomor 01":
 * - Nama bisnis di bagian paling atas (Y: ~80)
 * - Teks "NOMOR MEJA" bawaan template
 * - Nomor meja oranye berukuran besar (Y: ~282)
 * - Pembatas garis oranye dan petunjuk bawaan template
 * - QR Code menu digital di kotak putih tengah (Y: ~868, size: 540x540)
 */
export async function renderTableSignToCanvas(
  canvas: HTMLCanvasElement,
  profile: Profile,
  table: BusinessTable,
  origin: string,
  templateImg?: HTMLImageElement
): Promise<void> {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Gagal menginisialisasi 2D Canvas");

  canvas.width = TABLE_SIGN_WIDTH;
  canvas.height = TABLE_SIGN_HEIGHT;

  // 1. Gambar Template Latar Belakang Global
  const template = templateImg || (await loadImage(DEFAULT_TEMPLATE_PATH));
  ctx.drawImage(template, 0, 0, TABLE_SIGN_WIDTH, TABLE_SIGN_HEIGHT);

  // 2. Gambar Nama Bisnis (di atas teks "NOMOR MEJA")
  // Ukuran dikurangi 10% dari sebelumnya (115px -> 104px) dengan jarak vertikal rapi
  const businessName = (profile.nama || "OKESIH").trim();
  ctx.save();
  ctx.textBaseline = "middle";

  // Cek apakah nama bisnis memiliki ekstensi seperti .id, .com, .coffee dll seperti "cafeone.id"
  const domainMatch = businessName.match(/^(.+?)(\.[a-z0-9_-]+)$/i);
  if (domainMatch) {
    const baseName = domainMatch[1];
    const ext = domainMatch[2];

    let fontSize = 104;
    ctx.font = `800 ${fontSize}px "Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    let totalWidth = ctx.measureText(baseName).width + ctx.measureText(ext).width;
    while (totalWidth > 820 && fontSize > 32) {
      fontSize -= 2;
      ctx.font = `800 ${fontSize}px "Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      totalWidth = ctx.measureText(baseName).width + ctx.measureText(ext).width;
    }

    const startX = (TABLE_SIGN_WIDTH - totalWidth) / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(baseName, startX, 108);

    ctx.fillStyle = "#fe5415"; // Warna aksen oranye untuk dot extension
    ctx.fillText(ext, startX + ctx.measureText(baseName).width, 108);
  } else {
    // Teks nama bisnis biasa (warna putih tebal dan bersih)
    let fontSize = 104;
    ctx.font = `800 ${fontSize}px "Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    while (ctx.measureText(businessName).width > 820 && fontSize > 32) {
      fontSize -= 2;
      ctx.font = `800 ${fontSize}px "Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(businessName, TABLE_SIGN_WIDTH / 2, 108);
  }
  ctx.restore();

  // 3. Gambar Nomor Meja (di bawah teks "NOMOR MEJA" dan di atas garis pembatas Y: 485)
  // Ukuran ditingkatkan ~3x lipat (sebelumnya 165px, kini 340px) mengisi penuh area vertikal
  const formattedNumber = formatTableNumberForSign(table.label);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fe5415"; // Oranye resmi OKESIH

  let numFontSize = 340;
  if (formattedNumber.length > 2) numFontSize = 240;
  if (formattedNumber.length > 4) numFontSize = 170;
  if (formattedNumber.length > 7) numFontSize = 120;

  ctx.font = `900 ${numFontSize}px "Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  while (ctx.measureText(formattedNumber).width > 780 && numFontSize > 60) {
    numFontSize -= 4;
    ctx.font = `900 ${numFontSize}px "Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  }

  ctx.fillText(formattedNumber, TABLE_SIGN_WIDTH / 2, 354);
  ctx.restore();

  // 4. Hasilkan dan Gambar QR Code Menu Digital
  // UUID meja menjaga QR tetap valid ketika label meja diubah.
  const menuUrl = `${origin}/menu/${profile.slug}?tid=${encodeURIComponent(table.id)}`;
  const qrDataUrl = await QRCode.toDataURL(menuUrl, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: "L", // Level L (Low) menghasilkan matriks paling renggang & responsif
    color: {
      dark: "#0b1018",
      light: "#ffffff",
    },
  });

  const qrImg = await loadImage(qrDataUrl);

  // Kotak putih presisi di tengah-tengah frame area template (Y: 681 - 1243):
  // Center: X=512, Y=965. Ukuran QR: 480 x 480 px (diperkecil sedikit dari 540px).
  const qrSize = 480;
  const qrX = Math.round(512 - qrSize / 2);
  const qrY = Math.round(965 - qrSize / 2);
  const boxPadding = 16;

  // Bersihkan latar belakang kotak putih untuk menjamin kontras maksimal
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qrX - boxPadding, qrY - boxPadding, qrSize + boxPadding * 2, qrSize + boxPadding * 2);

  // Gambar QR Code
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
}

/**
 * Download file PDF untuk satu meja tertentu (Ukuran akrilik standar 10 x 15 cm / ratio 2:3).
 */
export async function downloadSingleTablePdf(
  profile: Profile,
  table: BusinessTable,
  origin: string,
  templateImg?: HTMLImageElement
): Promise<void> {
  const canvas = document.createElement("canvas");
  await renderTableSignToCanvas(canvas, profile, table, origin, templateImg);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 150],
    compress: true,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  pdf.addImage(imgData, "JPEG", 0, 0, 100, 150);

  const cleanNumber = formatTableNumberForSign(table.label);
  const cleanSlug = (profile.slug || "okesih").toLowerCase();
  pdf.save(`Papan-Meja-${cleanNumber}-${cleanSlug}.pdf`);
}

/**
 * Download file PDF gabungan untuk semua meja (Multi-page PDF, 1 halaman per meja).
 */
export async function downloadAllTablesPdf(
  profile: Profile,
  tables: BusinessTable[],
  origin: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (!tables.length) throw new Error("Tidak ada meja yang terdaftar untuk diunduh.");

  const template = await loadImage(DEFAULT_TEMPLATE_PATH);
  const canvas = document.createElement("canvas");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [100, 150],
    compress: true,
  });

  for (let i = 0; i < tables.length; i++) {
    if (i > 0) {
      pdf.addPage([100, 150], "portrait");
    }
    onProgress?.(i + 1, tables.length);

    await renderTableSignToCanvas(canvas, profile, tables[i], origin, template);
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    pdf.addImage(imgData, "JPEG", 0, 0, 100, 150);
  }

  const cleanSlug = (profile.slug || "okesih").toLowerCase();
  pdf.save(`Semua-Papan-Meja-${cleanSlug}.pdf`);
}

/**
 * Mencetak papan meja menggunakan dialog cetak bawaan browser.
 */
export async function printTableSigns(
  profile: Profile,
  tables: BusinessTable[],
  origin: string,
  singleTableId?: string
): Promise<void> {
  const targetTables = singleTableId
    ? tables.filter((t) => t.id === singleTableId)
    : tables;

  if (!targetTables.length) throw new Error("Meja tidak ditemukan.");

  const template = await loadImage(DEFAULT_TEMPLATE_PATH);
  const canvas = document.createElement("canvas");

  const signImages: Array<{ table: BusinessTable; dataUrl: string }> = [];
  for (const table of targetTables) {
    await renderTableSignToCanvas(canvas, profile, table, origin, template);
    signImages.push({
      table,
      dataUrl: canvas.toDataURL("image/jpeg", 0.95),
    });
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("Izinkan pop-up browser untuk mencetak papan meja.");
  }

  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <title>Cetak Papan Meja - ${profile.nama || "OKESIH"}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px;
      color: #0f172a;
    }
    .print-bar {
      max-width: 800px;
      margin: 0 auto 24px;
      background: #ffffff;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .print-btn {
      background: #fe5415;
      color: #ffffff;
      border: 0;
      padding: 10px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 750;
      cursor: pointer;
    }
    .print-grid {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      max-width: 800px;
      margin: 0 auto;
    }
    .sign-card {
      width: 100mm;
      height: 150mm;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      background: #090e17;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sign-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    @media print {
      body { background: transparent; padding: 0; }
      .print-bar { display: none; }
      .print-grid { gap: 0; }
      .sign-card {
        box-shadow: none;
        border-radius: 0;
        margin: 0 auto;
        page-break-after: always;
        break-after: page;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div>
      <h3 style="font-size: 16px; font-weight: 800; color: #0f172a;">Cetak Papan QR Meja (${targetTables.length} Meja)</h3>
      <p style="font-size: 12px; color: #64748b; margin-top: 2px;">Ukuran siap cetak standar akrilik meja (10 x 15 cm)</p>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ Cetak Sekarang</button>
  </div>
  <div class="print-grid">
    ${signImages
      .map(
        ({ table, dataUrl }) => `
      <div class="sign-card">
        <img src="${dataUrl}" alt="Meja ${table.label}"/>
      </div>
    `
      )
      .join("")}
  </div>
  <script>
    window.onload = () => {
      setTimeout(() => window.print(), 350);
    };
  </script>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}
