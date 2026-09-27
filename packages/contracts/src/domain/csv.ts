export function sanitizeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replaceAll('"', '""')}"`;
  return guarded;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}

export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char ?? "";
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

export function rowsToObjects(rows: string[][]): { headers: string[]; records: Record<string, string>[] } {
  const [headers, ...body] = rows;
  if (!headers) return { headers: [], records: [] };
  const records = body.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header.trim()] = row[index]?.trim() ?? "";
    });
    return record;
  });
  return { headers: headers.map((header) => header.trim()), records };
}
