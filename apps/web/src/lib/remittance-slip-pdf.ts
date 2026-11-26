import { pngPagesToPdf } from "@mf/contracts";

export type RemittanceSlipPdfInput = {
  slipNo: string;
  organizationName: string;
  planName: string;
  amountLabel: string;
  dueAtLabel: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};

const PAGE_WIDTH = 1191;
const PAGE_HEIGHT = 1684;

let fontReady: Promise<void> | null = null;

function ensureFont() {
  if (!fontReady) {
    fontReady = (async () => {
      const font = new FontFace("NotoSansTC", "url(/fonts/NotoSansTC-Subset.otf)");
      await font.load();
      document.fonts.add(font);
    })();
  }
  return fontReady;
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("無法產生匯款單圖片"));
        return;
      }
      void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
    }, "image/png");
  });
}

/** 依畫面匯款單內容產出可下載的 PDF（前端以站內中文字型繪製後轉 PDF）。 */
export async function buildRemittanceSlipPdf(input: RemittanceSlipPdfInput): Promise<Blob> {
  await ensureFont();
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("無法產生匯款單 PDF");

  const ink = "#1a1a1a";
  const muted = "#595959";
  const line = "#bfbfbf";
  const left = 112;
  const right = PAGE_WIDTH - 112;
  let y = 128;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.textBaseline = "alphabetic";
  context.textAlign = "left";

  const draw = (text: string, size: number, color = ink, x = left) => {
    context.font = `${size}px NotoSansTC`;
    context.fillStyle = color;
    context.fillText(text, x, y);
    y += size + 20;
  };

  draw("穆斯林友善驗證 · 匯款單", 36);
  draw("請依下列資訊完成匯款，並於期限內上傳繳費單據。", 22, muted);
  y += 8;
  context.strokeStyle = line;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(left, y);
  context.lineTo(right, y);
  context.stroke();
  y += 48;

  const rows: Array<[string, string]> = [
    ["匯款單號", input.slipNo || "—"],
    ["業者", input.organizationName || "—"],
    ["方案", input.planName || "—"],
    ["應繳金額（未稅）", input.amountLabel || "—"],
    ["繳費期限", input.dueAtLabel || "—"],
    ["收款銀行", input.bankName || "待管理員設定"],
    ["帳號", input.accountNo || "待管理員設定"],
    ["戶名", input.accountName || "待管理員設定"],
  ];

  for (const [label, value] of rows) {
    context.font = "22px NotoSansTC";
    context.fillStyle = muted;
    context.fillText(label, left, y);
    context.font = "24px NotoSansTC";
    context.fillStyle = ink;
    context.fillText(value, 400, y);
    y += 56;
  }

  y += 16;
  context.strokeStyle = line;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(left, y);
  context.lineTo(right, y);
  context.stroke();
  y += 48;
  draw("備註", 22, muted);
  draw("1. 匯款後請保留收據，並於會員區上傳 PDF／JPEG／PNG 單據。", 20, muted);
  draw("2. 逾期未上傳將改為未成立，需重新申請方案。", 20, muted);
  draw("3. 收款帳戶如有異動，以系統設定頁最新內容為準。", 20, muted);

  const bytes = await pngPagesToPdf([await canvasPng(canvas)]);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function downloadRemittanceSlipPdf(input: RemittanceSlipPdfInput, filename: string) {
  const blob = await buildRemittanceSlipPdf(input);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
