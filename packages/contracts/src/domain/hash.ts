export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function formatApplicationNo(year: number, sequence: number): string {
  return `MF-${year}-${String(sequence).padStart(5, "0")}`;
}

export function taipeiYear(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en", { timeZone: "Asia/Taipei", year: "numeric" }).format(date),
  );
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
