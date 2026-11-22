import { PDFDocument } from "pdf-lib";
import { parseBlockRuns, splitContractBody, type ContractBodyPart, type ContractTableRow } from "./official-contract";
import { normalizeSealLayout, type SealLayout } from "./seal-layout";
import { PDF_PX_PER_PT, compactRuns, type TextAlignValue, type TextRun } from "./rich-text";

export const CONTRACT_PAGE_WIDTH = 1240;
export const CONTRACT_PAGE_HEIGHT = 1754;

export type ContractPainter = {
  fillText: (text: string, x: number, y: number, size: number) => void;
  measureText?: (text: string, size: number) => number;
  strokeRect: (x: number, y: number, width: number, height: number, lineWidth?: number) => void;
  fillRect?: (x: number, y: number, width: number, height: number, color: string) => void;
  drawSignature?: (x: number, y: number, width: number, height: number) => void;
  drawFace?: (x: number, y: number, width: number, height: number) => void;
  drawSeal?: (x: number, y: number, size: number, kind: "company" | "person") => void;
  newPage: () => void;
};

const CHECK_MARKS = /[□☑☐■]/;

export function paintContract(
  painter: ContractPainter,
  input: {
    title: string;
    contractNo: string;
    body: string;
    signerName?: string;
    signerTitle?: string;
    signedAtLabel?: string;
    mode?: "unsigned" | "signed";
    sealLayout?: Partial<SealLayout> | null;
  },
) {
  const sealLayout = normalizeSealLayout(input.sealLayout);
  // 整份合約每頁邊界放寬，閱讀較舒適
  const margin = 108;
  const contentWidth = CONTRACT_PAGE_WIDTH - margin * 2;
  const topY = 128;
  let y = topY;

  const ensure = (height: number) => {
    if (y + height <= CONTRACT_PAGE_HEIGHT - margin) return;
    painter.newPage();
    y = topY;
  };

  const measure = (text: string, size: number) => {
    if (painter.measureText) return painter.measureText(text, size);
    let units = 0;
    for (const char of text) units += char.charCodeAt(0) < 128 ? 0.55 : 1;
    return units * size;
  };

  const drawCheck = (x: number, baseline: number, size: number, checked: boolean) => {
    const box = Math.max(14, Math.floor(size * 0.78));
    const top = baseline - box + 2;
    if (checked && painter.fillRect) {
      painter.fillRect(x, top, box, box, "#111111");
    } else {
      painter.strokeRect(x, top, box, box, 3);
      if (painter.fillRect) painter.fillRect(x + 2, top + 2, box - 4, box - 4, "#ffffff");
      painter.strokeRect(x, top, box, box, 3);
    }
    return box + 6;
  };

  const layout = (runs: TextRun[], basePx: number, width: number) => layoutRunLines(runs, basePx, width, measureGlyph);

  const drawSegments = (segs: RunSegment[], x0: number, baseline: number, extraPerChar = 0) => {
    let x = x0;
    for (const seg of segs) {
      let buffer = "";
      const flush = () => {
        if (!buffer) return;
        if (extraPerChar) {
          for (const ch of buffer) {
            painter.fillText(ch, x, baseline, seg.px);
            x += measure(ch, seg.px) + extraPerChar;
          }
        } else {
          painter.fillText(buffer, x, baseline, seg.px);
          x += measure(buffer, seg.px);
        }
        buffer = "";
      };
      for (const char of seg.text) {
        if (CHECK_MARKS.test(char)) {
          flush();
          x += drawCheck(x, baseline, seg.px, char === "☑" || char === "■") + extraPerChar;
        } else {
          buffer += char;
        }
      }
      flush();
    }
    return x;
  };

  const measureGlyph = (text: string, px: number) => {
    if (CHECK_MARKS.test(text)) return Math.max(14, Math.floor(px * 0.78)) + 6;
    return measure(text, px);
  };

  /** 依對齊算起點；左右對齊時回傳每字額外間距。 */
  const placeLine = (line: RunLine, x0: number, width: number, align: TextAlignValue | null, isLast: boolean) => {
    if (align === "center") return { x: x0 + Math.max(0, (width - line.width) / 2), extra: 0 };
    if (align === "right") return { x: x0 + Math.max(0, width - line.width), extra: 0 };
    if (align === "justify" && !isLast && line.chars > 1) return { x: x0, extra: Math.max(0, (width - line.width) / (line.chars - 1)) };
    return { x: x0, extra: 0 };
  };

  const writeRuns = (runs: TextRun[], size: number, options: { seal?: "company" | "person"; align?: TextAlignValue | null } = {}) => {
    const lines = layout(runs, size, contentWidth);
    lines.forEach((line, index) => {
      ensure(line.maxPx + 20);
      if (line.maxPx > size) y += line.maxPx - size;
      const isLast = index === lines.length - 1;
      const { x, extra } = placeLine(line, margin, contentWidth, options.align ?? null, isLast);
      drawSegments(line.segs, x, y, extra);
      if (isLast && options.seal && painter.drawSeal) {
        const stampSize = options.seal === "company" ? 150 : 110;
        painter.drawSeal(margin + Math.min(420, line.width * 0.55), y - stampSize * 0.35, stampSize, options.seal);
      }
      y += size + 18;
    });
    y += 10;
  };

  const writeText = (text: string, size: number, seal?: "company" | "person") => {
    writeRuns([{ text, sizePt: null }], size, { seal });
  };

  const drawTable = (rows: ContractTableRow[]) => {
    const pad = 14;
    const size = 20;
    const border = 3;
    for (const row of rows) {
      const cells = row.cells && row.cells.length >= 2 ? row.cells : [row.left, row.right];
      const colCount = Math.max(2, cells.length);
      const colWidth = Math.floor(contentWidth / colCount);
      const cellRuns = cells.map((cell, index) => row.cellRuns?.[index] ?? [{ text: cell, sizePt: null }]);
      const cellLines = cellRuns.map((runs) => layout(runs, size, colWidth - pad * 2));
      const cellHeights = cellLines.map((lines) => lines.reduce((sum, line) => sum + Math.max(line.maxPx, size) + 10, 0));
      const rowHeight = Math.max(56, Math.max(...cellHeights, 0) + pad * 2);
      ensure(rowHeight + 6);
      if (row.header && painter.fillRect) {
        painter.fillRect(margin, y, contentWidth, rowHeight, "#e7e5e4");
      }
      painter.strokeRect(margin, y, contentWidth, rowHeight, border);
      for (let i = 0; i < colCount; i += 1) {
        painter.strokeRect(margin + i * colWidth, y, i === colCount - 1 ? contentWidth - i * colWidth : colWidth, rowHeight, border);
      }
      cellLines.forEach((lines, index) => {
        const cellX = margin + index * colWidth + pad;
        const cellW = (index === colCount - 1 ? contentWidth - index * colWidth : colWidth) - pad * 2;
        let ty = y + pad;
        lines.forEach((line, lineIndex) => {
          ty += Math.max(line.maxPx, size);
          const { x, extra } = placeLine(line, cellX, cellW, row.cellAligns?.[index] ?? null, lineIndex === lines.length - 1);
          drawSegments(line.segs, x, ty, extra);
          ty += 10;
        });
      });
      y += rowHeight;
    }
    y += 18;
  };

  const paintParts = (parts: ContractBodyPart[]) => {
    for (const part of parts) {
      if (part.type === "table") {
        drawTable(part.rows);
        continue;
      }
      if (part.type === "parties") {
        painter.newPage();
        y = topY;
        paintPartiesPage(part);
        continue;
      }
      const size = part.heading ? Math.max(26, 40 - part.heading * 2) : 24;
      writeRuns(part.runs?.length ? part.runs : [{ text: part.text, sizePt: null }], size, { seal: part.seal, align: part.align });
    }
  };

  const paintPartiesPage = (part: Extract<ContractBodyPart, { type: "parties" }>) => {
    const title = part.title?.replace(/[：:]\s*$/, "") || "立約方";
    ensure(40);
    painter.fillText(title, margin, y, 30);
    y += 48;

    const hasColumns = (part.partyA?.length ?? 0) > 0 || (part.partyB?.length ?? 0) > 0;
    if (!hasColumns) {
      paintParts(part.parts);
      return;
    }

    const gap = 64;
    const colWidth = Math.floor((contentWidth - gap) / 2);
    const leftX = margin;
    const rightX = margin + colWidth + gap;
    const lineSize = 24;
    const lineGap = 64;
    const startY = y;
    const partyA = part.partyA ?? [];
    const partyB = part.partyB ?? [];
    const rows = Math.max(partyA.length, partyB.length, 1);

    const blockHeight = rows * (lineSize + lineGap) + 100;
    ensure(blockHeight + 160);

    const drawColumn = (lines: typeof partyA, x: number) => {
      let ty = startY;
      for (const line of lines) {
        const wrapped = layout(line.runs?.length ? line.runs : [{ text: line.text, sizePt: null }], lineSize, colWidth);
        wrapped.forEach((row, index) => {
          if (index > 0) ty += Math.max(row.maxPx, lineSize) + 10;
          drawSegments(row.segs, x, ty);
        });
        ty += lineSize + lineGap;
      }
      return ty;
    };

    const endA = drawColumn(partyA, leftX);
    const endB = drawColumn(partyB, rightX);
    y = Math.max(endA, endB, startY + blockHeight);

    if (painter.drawSeal && partyA.length) {
      const companySize = 168;
      const personSize = 118;
      const companyX = leftX + (colWidth - companySize) * (sealLayout.companySealX / 100);
      const companyY = startY + Math.max(0, blockHeight - companySize) * (sealLayout.companySealY / 100);
      const personX = leftX + (colWidth - personSize) * (sealLayout.personSealX / 100);
      const personY = startY + Math.max(0, blockHeight - personSize) * (sealLayout.personSealY / 100);
      painter.drawSeal(companyX, companyY, companySize, "company");
      painter.drawSeal(personX, personY, personSize, "person");
    }

    const dateSize = 26;
    y = CONTRACT_PAGE_HEIGHT - margin - dateSize;
    const dateRaw = (part.dateLine || "").trim() || "中華民國　　年　　月　　日";
    writeDistributedLine(rocDateGlyphs(dateRaw), dateSize, margin, contentWidth, true);
  };

  const writeDistributedLine = (glyphs: string[], size: number, x0: number, width: number, pinToBottom = false) => {
    if (!pinToBottom) ensure(size + 28);
    const chars = glyphs.filter((item) => item.length > 0);
    if (chars.length === 0) return;
    if (chars.length === 1) {
      painter.fillText(chars[0]!, x0, y, size);
      y += size + 18;
      return;
    }
    const totalGlyph = chars.reduce((sum, ch) => sum + measure(ch, size), 0);
    const gap = Math.max(4, (width - totalGlyph) / (chars.length - 1));
    let x = x0;
    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i]!;
      painter.fillText(ch, x, y, size);
      x += measure(ch, size) + (i === chars.length - 1 ? 0 : gap);
    }
    y += size + 18;
  };

  writeText(input.title, 34);
  y += 6;
  writeText(`合約編號 ${input.contractNo}`, 22);
  y += 10;

  paintParts(splitContractBody(input.body));

  if (input.mode === "signed" && input.signerName) {
    // 已上傳蓋章 PDF 時不在範本頁再印上傳提示
  }
}

/** 立約頁日期拆成逐字，供整列等距分布；西元年會轉民國年。 */
function rocDateGlyphs(raw: string): string[] {
  const normalized = raw.replace(/\s+/g, "").trim();
  const match = normalized.match(/中華民國([0-9０-９]*)年([0-9０-９]*)月([0-9０-９]*)日/);
  if (!match) {
    return Array.from(normalized.replace(/[　\s]/g, ""));
  }
  const toHalf = (value: string) => value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  let year = match[1] && match[1].length ? toHalf(match[1]) : "";
  let month = match[2] && match[2].length ? toHalf(match[2]) : "";
  let day = match[3] && match[3].length ? toHalf(match[3]) : "";
  if (year.length === 4 && Number(year) >= 1912) year = String(Number(year) - 1911);
  return [
    "中", "華", "民", "國",
    ...(year ? Array.from(year) : ["　"]),
    "年",
    ...(month ? Array.from(month) : ["　"]),
    "月",
    ...(day ? Array.from(day) : ["　"]),
    "日",
  ];
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

export type CertificatePagePainter = {
  fillText: (text: string, x: number, y: number, size: number) => void;
  measureText: (text: string, size: number) => number;
  /** 置中 Logo，回傳占用高度 */
  drawLogo?: (centerX: number, topY: number, maxW: number, maxH: number) => number;
  /** 驗證單位簽名，回傳占用高度 */
  drawAuditorSignature?: (x: number, topY: number, maxW: number, maxH: number) => number;
  /** 簽名虛線 */
  drawSignatureLine?: (x: number, y: number, width: number) => void;
};

export type CertificatePaintBlock =
  | { type: "center"; text: string; emphasis?: boolean; runs?: TextRun[]; align?: TextAlignValue | null }
  | { type: "left"; text: string; runs?: TextRun[]; align?: TextAlignValue | null }
  | { type: "logo" }
  | { type: "signature" };

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripHtmlToText(html: string) {
  return decodeHtmlEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** 把證書 HTML 拆成置中／左欄／Logo／簽名區塊（單頁 PDF 用）。 */
export function splitCertificateBlocks(body: string): CertificatePaintBlock[] {
  const blocks: CertificatePaintBlock[] = [];
  const chunk = body.replace(/\r/g, "");
  const parts = chunk.match(/<(p|div|h[1-4])\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  if (!parts.length) {
    for (const line of chunk.split(/\n+/)) {
      const text = stripHtmlToText(line);
      if (text) blocks.push({ type: "left", text });
    }
    return blocks;
  }
  for (const part of parts) {
    if (/data-certificate-logo/i.test(part)) {
      blocks.push({ type: "logo" });
      continue;
    }
    if (/data-certificate-signature/i.test(part)) {
      blocks.push({ type: "signature" });
      continue;
    }
    const parsed = parseBlockRuns(part);
    const text = parsed.text || stripHtmlToText(part);
    if (!text) continue;
    const runs = parsed.runs.length ? parsed.runs : [{ text, sizePt: null }];
    const centerClass =
      /class="[^"]*certificate-center/i.test(part)
      || /class='[^']*certificate-center/i.test(part);
    const align = parsed.align ?? (centerClass ? "center" : null);
    const centered = parsed.align ? parsed.align === "center" : centerClass;
    const emphasis = /<strong\b/i.test(part) || /<b\b/i.test(part) || /^<h[1-4]\b/i.test(part);
    if (/^<h[1-4]\b/i.test(part) && !parsed.align && !centered) {
      blocks.push({ type: "center", text, emphasis: false, runs, align: "center" });
      continue;
    }
    blocks.push(centered ? { type: "center", text, emphasis, runs, align } : { type: "left", text, runs, align });
  }
  return blocks;
}

/**
 * 驗證許可證書單頁排版（依官方樣式＋使用者示意）：
 * 抬頭／Logo／業者／標題置中；欄位「標籤：值」，值的續行對齊冒號後；
 * 行高 1.5、字距略開；多出的高度平均分配到各段落間。
 */
export function paintCertificate(
  painter: CertificatePagePainter,
  input: { body: string },
) {
  const marginX = Math.round(CONTRACT_PAGE_WIDTH * 0.17);
  const marginTop = Math.round(CONTRACT_PAGE_HEIGHT * 0.1);
  const marginBottom = Math.round(CONTRACT_PAGE_HEIGHT * 0.08);
  const centerX = CONTRACT_PAGE_WIDTH / 2;
  const contentRight = CONTRACT_PAGE_WIDTH - marginX;
  const letterSpacingEm = 0.06;
  const lineHeight = 1.5;
  const fieldSize = 22;
  const logoBox = 260;
  const signatureBox = 100;
  const blocks = splitCertificateBlocks(input.body);
  const measure = (text: string, size: number) => painter.measureText(text, size);

  const lines = (runs: TextRun[], size: number, width: number) => layoutRunLines(runs, size, width, measure, letterSpacingEm);

  const measureRuns = (runs: TextRun[], size: number) => lines(runs, size, Number.POSITIVE_INFINITY)[0]?.width ?? 0;

  const drawSegs = (segs: RunSegment[], x: number, baseline: number, extraPerChar = 0) => {
    let cx = x;
    for (const seg of segs) {
      const extra = seg.px * letterSpacingEm + extraPerChar;
      for (const ch of seg.text) {
        painter.fillText(ch, cx, baseline, seg.px);
        cx += measure(ch, seg.px) + extra;
      }
    }
  };

  /** 在 runs 文字的第 index 個字切開。 */
  const splitRuns = (runs: TextRun[], index: number): [TextRun[], TextRun[]] => {
    const head: TextRun[] = [];
    const tail: TextRun[] = [];
    let offset = 0;
    for (const run of runs) {
      const chars = Array.from(run.text);
      const end = offset + chars.length;
      if (end <= index) head.push(run);
      else if (offset >= index) tail.push(run);
      else {
        head.push({ ...run, text: chars.slice(0, index - offset).join("") });
        tail.push({ ...run, text: chars.slice(index - offset).join("") });
      }
      offset = end;
    }
    return [head, tail];
  };

  const run = (draw: boolean, unit: number) => {
    let y = marginTop;
    let weights = 0;
    const gap = (weight: number) => {
      weights += weight;
      y += weight * unit;
    };
    /** 畫一組已換行的列；字級較大時先往下讓位。 */
    const paintLines = (rows: RunLine[], size: number, place: (row: RunLine, isLast: boolean) => { x: number; extra?: number }) => {
      rows.forEach((row, index) => {
        if (row.maxPx > size) y += row.maxPx - size;
        const { x, extra } = place(row, index === rows.length - 1);
        if (draw) drawSegs(row.segs, x, y, extra ?? 0);
        y += Math.max(row.maxPx, size) * lineHeight - Math.max(0, row.maxPx - size);
      });
    };
    const placeIn = (left: number, width: number, align: TextAlignValue | null | undefined) => (row: RunLine, isLast: boolean) => {
      if (align === "center") return { x: left + Math.max(0, (width - row.width) / 2) };
      if (align === "right") return { x: left + Math.max(0, width - row.width) };
      if (align === "justify" && !isLast && row.chars > 1) return { x: left, extra: Math.max(0, (width - row.width) / (row.chars - 1)) };
      return { x: left };
    };
    const writeAt = (runs: TextRun[], x: number, size: number, align?: TextAlignValue | null) => {
      const width = contentRight - x;
      paintLines(lines(runs, size, width), size, placeIn(x, width, align));
    };

    let phase: "header" | "fields" = "header";
    let centerCount = 0;
    let indentX: number | null = null;
    let fieldRows = 0;

    for (const block of blocks) {
      if (block.type === "logo") {
        gap(1.5);
        const top = y - 18;
        if (draw) painter.drawLogo?.(centerX, top, logoBox, logoBox);
        y = top + logoBox + 40;
        gap(1.5);
        centerCount = 3;
        continue;
      }
      if (block.type === "signature") {
        gap(1);
        const top = y - 14;
        if (draw) {
          painter.drawAuditorSignature?.(marginX, top, 300, signatureBox);
          painter.drawSignatureLine?.(marginX, top + signatureBox - 4, 340);
        }
        y = top + signatureBox + 34;
        indentX = null;
        continue;
      }
      const runs = block.runs?.length ? block.runs : [{ text: block.text, sizePt: null }];
      if (block.type === "center") {
        if (phase === "fields") {
          writeAt(runs, indentX ?? marginX, fieldSize);
          continue;
        }
        centerCount += 1;
        let size: number;
        if (centerCount <= 3) size = centerCount === 1 ? 26 : centerCount === 2 ? 28 : 22;
        else {
          if (centerCount === 6) gap(1);
          size = block.emphasis ? 28 : 22;
        }
        writeAt(runs, marginX, size, block.align ?? "center");
        continue;
      }

      if (phase === "header") {
        phase = "fields";
        gap(2);
      }
      if (block.align === "center" || block.align === "right") {
        writeAt(runs, marginX, fieldSize, block.align);
        indentX = null;
        continue;
      }
      const colon = Array.from(block.text).indexOf("：");
      if (colon >= 0 && colon < 60) {
        if (fieldRows > 0) gap(1);
        fieldRows += 1;
        const [labelRuns, rest] = splitRuns(runs, colon + 1);
        const valueRuns = trimLeadingSpace(rest);
        const valueX = marginX + measureRuns(labelRuns, fieldSize) + fieldSize * 0.2;
        const labelLine = lines(labelRuns, fieldSize, Number.POSITIVE_INFINITY)[0];
        const valueLines = valueRuns.length ? lines(valueRuns, fieldSize, contentRight - valueX) : [];
        const first = valueLines[0];
        const firstMax = Math.max(labelLine?.maxPx ?? fieldSize, first?.maxPx ?? fieldSize);
        if (firstMax > fieldSize) y += firstMax - fieldSize;
        if (draw && labelLine) drawSegs(labelLine.segs, marginX, y);
        if (draw && first) drawSegs(first.segs, valueX, y);
        y += firstMax * lineHeight - Math.max(0, firstMax - fieldSize);
        if (valueLines.length > 1) paintLines(valueLines.slice(1), fieldSize, () => ({ x: valueX }));
        indentX = /^驗證單位/.test(block.text) ? null : valueX;
        continue;
      }
      writeAt(runs, indentX ?? marginX, fieldSize, block.align);
    }
    return { bottom: y, weights };
  };

  const dry = run(false, 0);
  const free = CONTRACT_PAGE_HEIGHT - marginBottom - dry.bottom;
  const unit = dry.weights > 0 ? Math.max(0, Math.min(64, free / dry.weights)) : 0;
  run(true, unit);
}

function trimLeadingSpace(runs: TextRun[]): TextRun[] {
  const out = runs.map((run) => ({ ...run }));
  while (out.length && !out[0]!.text.trim()) out.shift();
  if (out[0]) out[0].text = out[0].text.trimStart();
  return out;
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

export type RunSegment = { text: string; px: number };
export type RunLine = { segs: RunSegment[]; width: number; maxPx: number; chars: number };

/** 不可放在行首的標點，寧可略超出也接在上一行。 */
const NO_LINE_START = /^[，。、；：！？）」』〉》】,.;:!?)\]]$/;
const TOKEN_PATTERN = /\n|[□☑☐■]|[\u2e80-\u9fff\uff00-\uffef\u3000-\u303f]|[^\s\u2e80-\u9fff\uff00-\uffef\u3000-\u303f□☑☐■]+|[^\S\n]+/g;

/** 依實際寬度換行（英文按字詞、中文逐字），每段可有不同字級。 */
export function layoutRunLines(
  runs: TextRun[],
  basePx: number,
  width: number,
  measure: (text: string, px: number) => number,
  letterSpacingEm = 0,
): RunLine[] {
  const lines: RunLine[] = [];
  let current: RunLine = { segs: [], width: 0, maxPx: basePx, chars: 0 };
  let hasContent = false;
  const spacing = (px: number) => px * letterSpacingEm;
  const tokenWidth = (token: string, px: number) => {
    if (!letterSpacingEm) return measure(token, px);
    let w = 0;
    for (const ch of token) w += measure(ch, px) + spacing(px);
    return w;
  };
  const pushLine = () => {
    const last = current.segs[current.segs.length - 1];
    if (last) {
      const trimmed = last.text.replace(/[^\S\n]+$/, "");
      if (trimmed !== last.text) {
        current.width -= tokenWidth(last.text.slice(trimmed.length), last.px);
        current.chars -= last.text.length - trimmed.length;
        last.text = trimmed;
      }
    }
    if (letterSpacingEm && current.segs.length) {
      const tail = current.segs[current.segs.length - 1]!;
      current.width -= spacing(tail.px);
    }
    lines.push(current);
    current = { segs: [], width: 0, maxPx: basePx, chars: 0 };
    hasContent = false;
  };
  const append = (token: string, px: number) => {
    const last = current.segs[current.segs.length - 1];
    if (last && last.px === px) last.text += token;
    else current.segs.push({ text: token, px });
    current.width += tokenWidth(token, px);
    current.chars += Array.from(token).length;
    current.maxPx = Math.max(current.maxPx, px);
    hasContent = true;
  };
  for (const run of compactRuns(runs)) {
    const px = run.sizePt ? run.sizePt * PDF_PX_PER_PT : basePx;
    for (const token of run.text.match(TOKEN_PATTERN) ?? []) {
      if (token === "\n") {
        pushLine();
        continue;
      }
      const isSpace = /^[^\S\n]+$/.test(token);
      if (isSpace && !hasContent) continue;
      const w = tokenWidth(token, px);
      if (hasContent && !isSpace && current.width + w > width && !NO_LINE_START.test(token)) pushLine();
      if (!hasContent && w > width && !isSpace && token.length > 1) {
        for (const ch of token) {
          if (hasContent && current.width + tokenWidth(ch, px) > width) pushLine();
          append(ch, px);
        }
        continue;
      }
      append(token, px);
    }
  }
  if (hasContent || !lines.length) pushLine();
  return lines;
}
