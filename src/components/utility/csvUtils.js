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
  for (const [fieldKey, aliases] of Object.entries(fieldAliases)) {
    if (aliases.some((a) => normalizeKey(a) === norm)) return fieldKey;
  }
  return "";
}

export function validateEnum(value, options) {
  if (!value || !value.trim()) return undefined;
  const v = value.trim();
  if (options.includes(v)) return v;
  return options.find((o) => o.toLowerCase() === v.toLowerCase());
}