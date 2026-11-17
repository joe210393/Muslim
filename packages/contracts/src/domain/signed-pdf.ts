import { PDFDocument } from "pdf-lib";

export const CONTRACT_PAGE_WIDTH = 1240;
export const CONTRACT_PAGE_HEIGHT = 1754;

export type ContractPainter = {
  fillText: (text: string, x: number, y: number, size: number) => void;
  drawSignature: (x: number, y: number, width: number, height: number) => void;
  drawFace: (x: number, y: number, width: number, height: number) => void;
  newPage: () => void;
};

export function paintContract(
  painter: ContractPainter,
  input: { title: string; contractNo: string; body: string; signerName: string; signerTitle: string; signedAtLabel: string },
) {
  const margin = 80;
  const maxUnits = 36;
  let y = 120;

  const ensure = (height: number) => {
    if (y + height <= CONTRACT_PAGE_HEIGHT - margin) return;
    painter.newPage();
    y = 120;
  };

  const write = (text: string, size: number) => {
    for (const paragraph of text.split("\n")) {
      for (const line of wrapUnits(paragraph, maxUnits)) {
        ensure(size + 18);
        painter.fillText(line, margin, y, size);
        y += size + 16;
      }
      y += 8;
    }
  };

  write(input.title, 36);
  y += 8;
  write(`合約編號 ${input.contractNo}`, 24);
  y += 16;
  write(input.body, 26);
  y += 20;
  write(`簽署人：${input.signerName}`, 28);
  write(`職稱：${input.signerTitle}`, 28);
  write(`簽署時間（台北時間）：${input.signedAtLabel}`, 28);
  y += 24;
  const contentWidth = CONTRACT_PAGE_WIDTH - margin * 2;
  ensure(300);
  painter.fillText("手寫簽名", margin, y, 26);
  painter.drawSignature(margin, y + 40, contentWidth, 240);
  y += 300;
  ensure(340);
  painter.fillText("簽署時人像", margin, y, 26);
  painter.drawFace(margin, y + 40, 280, 280);
  y += 340;
  write("本檔於簽署當下產生，已嵌入手寫簽名與當時的人像。已簽署內容不隨後續範本修改而改變。", 22);
}

export type BasicCertificatePainter = {
  fillText: (text: string, x: number, y: number, size: number) => void;
};

export function paintBasicCertificate(
  painter: BasicCertificatePainter,
  input: { title: string; certificateNo: string; holderName: string; organizationName: string; passedAtLabel: string },
) {
  const margin = 80;
  let y = 160;
  const write = (text: string, size: number) => {
    painter.fillText(text, margin, y, size);
    y += size + 28;
  };
  write(input.title, 40);
  y += 12;
  write(`證書編號 ${input.certificateNo}`, 26);
  y += 20;
  write(`受訓人：${input.holderName}`, 30);
  write(`業者：${input.organizationName || "—"}`, 28);
  write(`通過時間（台北時間）：${input.passedAtLabel}`, 26);
  y += 24;
  write("本證書於基礎教育訓練內容與測驗通過後自動產生。正式版式與效力仍待確認。", 22);
}

export async function pngPagesToPdf(pages: Uint8Array[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const bytes of pages) {
    const image = await pdf.embedPng(bytes);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return pdf.save();
}

function wrapUnits(text: string, maxUnits: number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  let current = "";
  let units = 0;
  for (const char of text) {
    const next = char.charCodeAt(0) < 128 ? 0.55 : 1;
    if (units + next > maxUnits && current) {
      lines.push(current);
      current = char;
      units = next;
    } else {
      current += char;
      units += next;
    }
  }
  if (current) lines.push(current);
  return lines;
}
