import { escapeHtml,renderMultilineBizName } from "./helpers";
import type { BusinessTable,Profile,StickerConfig } from "./types";
export async function printTableStickers(data: { profile: Profile; tables: BusinessTable[] }, stickerConfig: StickerConfig, setError: (message: string) => void, singleTableId?: string) {
    if (!data?.tables.length) return setError("Tambahkan meja terlebih dahulu.");
    const tablesToPrint = singleTableId
      ? data.tables.filter((t) => t.id === singleTableId)
      : data.tables;
    if (!tablesToPrint.length) return setError("Meja yang dipilih tidak ditemukan.");

    const { default: QRCode } = await import("qrcode");
    const cards = await Promise.all(
      tablesToPrint.map(async (table) => {
        // Gunakan URL ringkas ?t= agar modul QR Code berukuran paling besar dan simpel tanpa kotak rapat
        const url = `${window.location.origin}/menu/${data.profile.slug}?t=${encodeURIComponent(table.label)}`;
        return {
          table,
          url,
          qr: await QRCode.toDataURL(url, {
            width: Math.max(260, stickerConfig.qrSize * 2),
            margin: 1,
            errorCorrectionLevel: "L", // Level L (Low) menghasilkan QR Code paling simpel & minim kotak-kotak agar mudah discan HP walau cetak non-HD
          }),
        };
      })
    );

    const popup = window.open("", "_blank");
    if (!popup) return setError("Izinkan pop-up browser untuk mencetak stiker meja.");

    const showBiz = stickerConfig.showBusinessName;
    const showLogo = stickerConfig.showLogo && Boolean(data.profile.logo_url);
    const showInst = stickerConfig.showInstruction;
    const logoUrl = data.profile.logo_url || "";

    popup.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Stiker QR ${escapeHtml(data.profile.nama)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 20px; background: #fff; color: #0f172a; }
    .toolbar { margin-bottom: 20px; display: flex; gap: 12px; align-items: center; }
    .print-btn { background: #ea580c; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; }
    .toolbar span { font-size: 13px; color: #64748b; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .card {
      border: 2px solid #0f172a;
      border-radius: 16px;
      padding: 18px;
      text-align: center;
      break-inside: avoid;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }
    .top-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px 18px;
      width: 100%;
      margin-bottom: ${stickerConfig.tableOffset}px;
    }
    .biz-header {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transform: translateX(${stickerConfig.businessNameOffsetX || 0}px);
    }
    .biz-logo {
      width: ${stickerConfig.logoSize || 28}px;
      height: ${stickerConfig.logoSize || 28}px;
      object-fit: contain;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .biz-name {
      font-size: ${stickerConfig.businessNameSize}px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      text-align: ${stickerConfig.businessNameAlign || "center"};
    }
    .table-label {
      font-size: ${stickerConfig.tableLabelSize}px;
      font-weight: 900;
      color: #ea580c;
      transform: translateX(${stickerConfig.tableOffsetX || 0}px);
      line-height: 1.1;
      letter-spacing: -0.5px;
    }
    .qr-img {
      width: ${stickerConfig.qrSize}px;
      height: ${stickerConfig.qrSize}px;
      display: block;
      margin: 4px auto;
      image-rendering: pixelated;
    }
    .instruction {
      font-size: ${stickerConfig.instructionSize}px;
      font-weight: 600;
      color: #334155;
      margin-top: 6px;
    }
    @media print {
      body { margin: 0; }
      .toolbar { display: none; }
      .grid { gap: 14px; }
      .card { page-break-inside: avoid; border: 2px solid #000; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print-btn" onclick="window.print()">🖨️ Cetak Stiker</button>
    <span>(Format sesuai hasil preview live di Dashboard Owner)</span>
  </div>
  <div class="grid">
    ${cards
      .map(
        ({ table, qr }) => `
      <div class="card">
        <div class="top-row">
          ${showBiz ? `
            <div class="biz-header">
              ${showLogo ? `<img class="biz-logo" src="${escapeHtml(logoUrl)}" alt="Logo"/>` : ""}
              <div class="biz-name">${renderMultilineBizName(data.profile.nama).map((w) => `<div>${escapeHtml(w)}</div>`).join("")}</div>
            </div>
          ` : ""}
          <div class="table-label">${escapeHtml(table.label)}</div>
        </div>
        <img class="qr-img" src="${qr}" alt="QR ${escapeHtml(table.label)}"/>
        ${showInst ? `<div class="instruction">${escapeHtml(stickerConfig.instructionText || "Scan untuk melihat menu & memesan")}</div>` : ""}
      </div>
    `
      )
      .join("")}
  </div>
  <script>window.onload=()=>window.print()</script>
</body>
</html>`);
    popup.document.close();
  }
