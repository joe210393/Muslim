import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

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

/** 依畫面匯款單內容產出可下載的 PDF（前端產生，中文字型取自站內字型檔）。 */
export async function buildRemittanceSlipPdf(input: RemittanceSlipPdfInput): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await fetch("/fonts/NotoSansTC-Subset.otf").then((res) => {
    if (!res.ok) throw new Error("無法載入字型");
    return res.arrayBuffer();
  });
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.35, 0.35, 0.35);
  const line = rgb(0.75, 0.75, 0.75);
  let y = height - 64;

  const draw = (text: string, size: number, color = ink, x = 56) => {
    page.drawText(text, { x, y, size, font, color });
    y -= size + 10;
  };

  draw("穆斯林友善驗證 · 匯款單", 18);
  draw("請依下列資訊完成匯款，並於期限內上傳繳費單據。", 11, muted);
  y -= 8;
  page.drawLine({ start: { x: 56, y }, end: { x: width - 56, y }, thickness: 1, color: line });
  y -= 24;

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
    page.drawText(label, { x: 56, y, size: 11, font, color: muted });
    page.drawText(value, { x: 200, y, size: 12, font, color: ink });
    y -= 28;
  }

  y -= 12;
  page.drawLine({ start: { x: 56, y }, end: { x: width - 56, y }, thickness: 1, color: line });
  y -= 24;
  draw("備註", 11, muted);
  draw("1. 匯款後請保留收據，並於會員區上傳 PDF／JPEG／PNG 單據。", 10, muted);
  draw("2. 逾期未上傳將改為未成立，需重新申請方案。", 10, muted);
  draw("3. 收款帳戶如有異動，以系統設定頁最新內容為準。", 10, muted);

  const bytes = await pdf.save();
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
