// Shared CSV parsing + mapping helpers used by the bulk-import utilities.

export function detectDelimiter(text) {
  const firstLine = text.split("\n")[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && counts[ch] !== undefined) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

export function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const next = clean[i + 1];
    if (inQuotes) {
      if (char === '"') {
        if (next === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field); field = "";
      } else if (char === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function normalizeKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function autoMapHeader(header, fieldAliases) {
  const norm = normalizeKey(header);
  // 1. Exact match (fast path)
  for (const [fieldKey, aliases] of Object.entries(fieldAliases)) {
    if (aliases.some((a) => normalizeKey(a) === norm)) return fieldKey;
  }
  // 2. Contains fallback: find the longest alias that is a substring of the
  //    normalized header. This catches headers with extra words or hidden
  //    characters (e.g. "Allocator Type" → "allocatortype" contains "allocatortype").
  //    Longest-match-first prevents "type" (firm_types) from winning over
  //    "allocatortype" (allocator_types).
  let bestField = "";
  let bestLen = 0;
  for (const [fieldKey, aliases] of Object.entries(fieldAliases)) {
    for (const alias of aliases) {
      const a = normalizeKey(alias);
      if (a.length > bestLen && norm.includes(a)) {
        bestField = fieldKey;
        bestLen = a.length;
      }
    }
  }
  return bestField;
}

export function validateEnum(value, options) {
  if (!value || !value.trim()) return undefined;
  const v = value.trim();
  if (options.includes(v)) return v;
  return options.find((o) => o.toLowerCase() === v.toLowerCase());
}

/**
 * Parse an Excel (.xlsx/.xls) file into the same 2D-array shape as parseCSV:
 * an array of rows, each an array of stringified cell values, with the first
 * row treated as the header. Empty rows are dropped. Reads the first worksheet.
 */
export async function parseExcel(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return aoa
    .map((row) => (row || []).map((c) => (c == null ? "" : String(c).trim())))
    .filter((r) => r.some((c) => c !== ""));
}

/** True when the file name ends in an Excel extension we can parse. */
export function isExcelFile(name) {
  return /\.(xlsx|xls|xlsm)$/i.test(name || "");
}