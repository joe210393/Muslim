/** 合約／證書編輯器共用的字級與對齊規則（畫面、清理、PDF 同一來源）。 */
export const FONT_SIZE_OPTIONS_PT = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36] as const;
export const FONT_SIZE_MIN_PT = 6;
export const FONT_SIZE_MAX_PT = 72;

export type TextAlignValue = "left" | "center" | "right" | "justify";

/** PDF 畫布 1240px 對應 A4 寬 595.28pt。 */
export const PDF_PX_PER_PT = 1240 / 595.28;

/** 接受 14 / "14" / "14pt" / "18.67px"；超出範圍回傳 null。 */
export function normalizeFontSizePt(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value >= FONT_SIZE_MIN_PT && value <= FONT_SIZE_MAX_PT ? Math.round(value * 2) / 2 : null;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(pt|px)?$/i);
  if (!match) return null;
  const raw = Number(match[1]);
  const pt = match[2]?.toLowerCase() === "px" ? raw * 0.75 : raw;
  return normalizeFontSizePt(pt);
}

export function normalizeTextAlign(value: unknown): TextAlignValue | null {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "left" || text === "center" || text === "right" || text === "justify" ? text : null;
}

/** 從 inline style 取出允許的字級與對齊，其餘一律丟掉。 */
export function parseSafeStyle(style: string | null | undefined): { fontSizePt: number | null; textAlign: TextAlignValue | null } {
  let fontSizePt: number | null = null;
  let textAlign: TextAlignValue | null = null;
  for (const decl of String(style ?? "").split(";")) {
    const [rawName, ...rest] = decl.split(":");
    const name = rawName?.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (name === "font-size") fontSizePt = normalizeFontSizePt(value);
    if (name === "text-align") textAlign = normalizeTextAlign(value);
  }
  return { fontSizePt, textAlign };
}

/** 一段同字級的文字；sizePt 為 null 時用該區塊的預設字級。 */
export type TextRun = { text: string; sizePt: number | null };

export function runsText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

/** 合併相鄰同字級的 run。 */
export function compactRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = out[out.length - 1];
    if (last && last.sizePt === run.sizePt) last.text += run.text;
    else out.push({ ...run });
  }
  return out;
}
