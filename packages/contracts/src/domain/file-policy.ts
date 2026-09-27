export const FILE_POLICY = {
  policyNote: "示範政策，正式限制待確認後可調整",
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"] as const,
  maxFileBytes: 10 * 1024 * 1024,
  maxApplicationBytes: 100 * 1024 * 1024,
};

export type AllowedMimeType = (typeof FILE_POLICY.allowedMimeTypes)[number];

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (FILE_POLICY.allowedMimeTypes as readonly string[]).includes(mimeType);
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

export function extensionForMime(mimeType: AllowedMimeType): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  return "png";
}

export function safeDisplayName(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\-\u4e00-\u9fff ()]/g, "_").slice(0, 180);
  return cleaned || "file";
}
