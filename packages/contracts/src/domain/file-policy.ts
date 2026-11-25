export const FILE_POLICY = {
  policyNote: "示範政策，正式限制待確認後可調整",
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"] as const,
  maxFileBytes: 10 * 1024 * 1024,
  maxApplicationBytes: 100 * 1024 * 1024,
  maxImagesPerRequirement: 16,
};

export const COURSE_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export type CourseVideoMime = "video/mp4" | "video/webm";

export type AllowedMimeType = (typeof FILE_POLICY.allowedMimeTypes)[number];

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (FILE_POLICY.allowedMimeTypes as readonly string[]).includes(mimeType);
}

/** 申請附件可接受的格式。照片欄仍只用 JPEG、PNG；文件欄才包含影片。 */
export const ATTACHMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "video/mp4", "video/webm"] as const;

export function isAttachmentMimeType(mimeType: string): mimeType is AllowedMimeType | CourseVideoMime {
  return (ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function detectAttachmentSignature(bytes: Uint8Array): AllowedMimeType | CourseVideoMime | null {
  return detectFileSignature(bytes) ?? detectCourseVideo(bytes);
}

export function formatByteLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

export function detectFileSignature(bytes: Uint8Array): AllowedMimeType | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}

export function detectCourseVideo(bytes: Uint8Array): CourseVideoMime | null {
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "video/mp4";
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}

export function extensionForMime(mimeType: AllowedMimeType | CourseVideoMime): string {
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  return "png";
}

function cjkCount(value: string) {
  return (value.match(/[\u3400-\u9fff]/g) ?? []).length;
}

/** multer 會把 UTF-8 檔名讀成 Latin-1，中文就變成亂碼。已經是中文的檔名維持原樣。 */
export function repairUtf8Mojibake(value: string): string {
  if (cjkCount(value) > 0) return value;
  const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (decoded.includes("\uFFFD") || cjkCount(decoded) === 0) return value;
  return decoded;
}

/** 題庫與教材文字：UTF-8（含 BOM）優先；Excel 另存的 Big5 若才有中文，就改用 Big5。 */
export function decodeUploadedText(bytes: Uint8Array): string {
  const stripBom = (text: string) => text.replace(/^\uFEFF/, "");
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return stripBom(new TextDecoder("utf-8").decode(bytes.subarray(3)));
  }
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (cjkCount(utf8) > 0 && !utf8.includes("\uFFFD")) return stripBom(utf8);
  try {
    const big5 = new TextDecoder("big5").decode(bytes);
    if (cjkCount(big5) > cjkCount(utf8)) return stripBom(big5);
  } catch {
    // 這個環境沒有 Big5 解碼器時，沿用 UTF-8。
  }
  return stripBom(utf8);
}

export function safeDisplayName(originalName: string): string {
  const base = repairUtf8Mojibake(originalName).split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\-\u4e00-\u9fff ()]/g, "_").slice(0, 180);
  return cleaned || "file";
}
