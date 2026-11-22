import { describe, expect, it } from "vitest";
import { decodeUploadedText, parseQuestionBankUpload, repairUtf8Mojibake } from "@mf/contracts";

describe("上傳中文", () => {
  it("把被讀成 Latin-1 的中文檔名還原", () => {
    const mojibake = String.fromCharCode(...new TextEncoder().encode("教材.pdf"));
    expect(mojibake).not.toContain("教");
    expect(repairUtf8Mojibake(mojibake)).toBe("教材.pdf");
    expect(repairUtf8Mojibake("教材.pdf")).toBe("教材.pdf");
  });

  it("題庫 CSV 用 Big5 時仍讀得到中文", () => {
    const bytes = Uint8Array.from([
      0xc3, 0x44, 0xa5, 0xd8, 0x2c, 0xbf, 0xef, 0xb6, 0xb5, 0x2c, 0x30, 0x0a,
      0xa7, 0x41, 0xa6, 0x6e, 0x2c, 0xa5, 0xd2, 0x7c, 0xa4, 0x41, 0x2c, 0x30,
    ]);
    const text = decodeUploadedText(bytes);
    const parsed = parseQuestionBankUpload(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.rows[0]).toEqual({ prompt: "你好", options: ["甲", "乙"], correctIndex: 0 });
  });

  it("UTF-8 題庫維持原文字", () => {
    const text = "題目,選項,正解索引\n你好,甲|乙,0\n";
    expect(decodeUploadedText(new TextEncoder().encode(text))).toContain("你好");
  });
});
