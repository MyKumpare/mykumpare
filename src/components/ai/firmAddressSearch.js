import { base44 } from "@/api/base44Client";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

// Map common phrasings (incl. plurals) to the canonical firm type.
function detectFirmType(text) {
  const t = text.toLowerCase();
  // Order matters: check more-specific / multi-word types first.
  if (/\binvestment\s+manager(s)?\b/.test(t) || /\bim(s)?\b/.test(t)) return "Investment Manager";
  if (/\binvestment\s+consultant(s)?\b/.test(t)) return "Investment Consultant";
  if (/\bsecurities\s+brokerage(s)?\b/.test(t) || /\bbrokerage(s)?\b/.test(t) || /\bbroker(s)?\b/.test(t)) return "Securities Brokerage";
  if (/\btrade\s+organization(s)?\b/.test(t) || /\btrade\s+org(s)?\b/.test(t)) return "Trade Organizations";
  if (/\ballocator(s)?\b/.test(t)) return "Allocator";
  return null;
}

function hasExcelIntent(text) {
  return /\b(excel|spreadsheet|\.csv|\.xlsx)\b/i.test(text) || /\bexport\s+to\s+(excel|csv)\b/i.test(text) || /\bin\s+(excel|csv)\b/i.test(text) || /\bas\s+(excel|csv)\b/i.test(text);
}

// ─── Intent detection ───
// Detects when the user is asking the AI agent to look up the address(es)
// of firms. Two shapes are supported:
//   1. A specific firm name (incl. partial / incomplete matches).
//   2. "all <firm type>" (or "all firms") → every firm of that type.
// An optional "in excel" / "export to excel" triggers a CSV download.
export function detectAddressIntent(query) {
  const q = query.toLowerCase();

  const hasAddressKeyword =
    /address|addresses|location|located|where is|where's|office|offices|headquarter|headquarters|based\b/i.test(q);

  if (!hasAddressKeyword) return { isAddressSearch: false };

  const isAll = /\ball\b/i.test(q);
  const firmTypeFilter = detectFirmType(query);
  const exportExcel = hasExcelIntent(query);
  const withAddressOnly = /\bwith\s+(?:an?\s+)?address(es)?\b/i.test(q);

  // "all <firm type>" or "all firms" with address(es): type-based report
  if (isAll && (firmTypeFilter || /\bfirm(s)?\b/i.test(q))) {
    return { isAddressSearch: true, firmName: null, firmTypeFilter, isAll: true, exportExcel, withAddressOnly };
  }

  const patterns = [
    /(?:show|get|find|give me|tell me|list)\s+(?:me\s+)?(?:the\s+)?address(?:es)?\s+(?:of|for)\s+(.+?)(?:\s*$|[,.\?!])/i,
    /what(?:'s|s| is| are)\s+(?:the\s+)?address(?:es)?\s+(?:of|for)\s+(.+?)(?:\s*$|[,.\?!])/i,
    /address(?:es)?\s+(?:of|for)\s+(.+?)(?:\s*$|[,.\?!])/i,
    /where is\s+(.+?)(?:\s+located)?\s*[,.\?!]?$/i,
    /where's\s+(.+?)(?:\s+located)?\s*[,.\?!]?$/i,
    /(.+?)\s+address(?:es)?\s*[,.\?!]?$/i,
  ];

  let firmName = null;
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      firmName = match[1].trim();
      break;
    }
  }

  if (!firmName) {
    const stopWords = new Set([
      "show", "get", "find", "give", "tell", "list", "me", "the", "what", "is", "are",
      "where", "address", "addresses", "location", "located", "office", "offices",
      "headquarters", "of", "for", "firm", "firms", "company", "companies", "and", "their", "an", "a",
      "investment", "manager", "managers", "allocator", "allocators", "consultant", "consultants",
      "brokerage", "brokerages", "organization", "organizations", "securities", "all",
      "report", "create", "generate", "build", "with", "in", "excel", "csv", "export", "to", "as",
    ]);
    const words = query.split(/\s+/);
    const properNouns = words
      .filter((w) => /^[A-Z]/.test(w) && !stopWords.has(w.toLowerCase().replace(/[^a-z]/g, "")))
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""));
    if (properNouns.length > 0) firmName = properNouns.join(" ");
  }

  if (firmName) {
    firmName = firmName
      .replace(/\s+(firm|company|firms|companies|managers?|allocator|allocators|consultant|consultants|brokerage|brokerages|organization|organizations|securities)\s*$/i, "")
      .replace(/['"]/g, "")
      .trim();
  }

  return { isAddressSearch: !!firmName, firmName, firmTypeFilter: null, isAll: false, exportExcel, withAddressOnly };
  }

// ─── Partial name matching ───
async function findFirmsByPartialName(firmName) {
  const allFirms = await base44.entities.Firm.list(null, 500);
  const activeFirms = allFirms.filter((f) => !f.deleted_at);

  const clean = (s) => s.toLowerCase().replace(/[.,\-&'"`]/g, " ").replace(/\s+/g, " ").trim();
  const q = clean(firmName);
  if (!q) return [];

  const matches = activeFirms.filter((f) => {
    const fn = clean(f.name);
    return fn.includes(q) || q.includes(fn);
  });

  const score = (f) => {
    const fn = clean(f.name);
    if (fn === q) return 0;
    if (fn.startsWith(q)) return 1;
    if (q.startsWith(fn)) return 2;
    return 3;
  };
  matches.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  return matches;
}

// ─── Type-based "all" matching ───
async function findAllFirmsByType(firmTypeFilter) {
  const allFirms = await base44.entities.Firm.list(null, 500);
  const activeFirms = allFirms.filter((f) => !f.deleted_at);
  if (!firmTypeFilter) return activeFirms.sort((a, b) => a.name.localeCompare(b.name));
  return activeFirms
    .filter((f) => {
      const types = f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
      return types.includes(firmTypeFilter);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatAddress(a) {
  return [a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country]
    .filter(Boolean)
    .join(", ");
}

// ─── CSV download (Excel-compatible) ───
function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  // Prepend BOM so Excel reads UTF-8 correctly.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildRows(matches) {
  const rows = [];
  for (const f of matches) {
    const type = f.firm_types?.join(", ") || f.firm_type || "";
    const addresses = f.addresses?.length ? f.addresses : [];
    if (addresses.length === 0) {
      rows.push([f.name, type, "No address on file", ""]);
    } else {
      for (const a of addresses) {
        rows.push([f.name, type, formatAddress(a), a.is_headquarters ? "Headquarters" : ""]);
      }
    }
  }
  return rows;
}

// ─── Search & format ───
export async function searchFirmAddresses(intent) {
  const { firmName, firmTypeFilter, isAll, exportExcel, withAddressOnly } = intent;
  try {
    let matches;
    let scopeLabel;
    if (isAll || firmTypeFilter) {
      matches = await findAllFirmsByType(firmTypeFilter);
      scopeLabel = firmTypeFilter
        ? `all ${firmTypeFilter.toLowerCase()}s`
        : "all firms";
    } else {
      matches = await findFirmsByPartialName(firmName);
      scopeLabel = `"${firmName}"`;
    }

    // When the user asked for firms "with address(es)", drop firms that have none.
    if (withAddressOnly) {
      matches = matches.filter((f) => f.addresses && f.addresses.length > 0);
    }

    if (matches.length === 0) {
      return {
        role: "assistant",
        content: `I couldn't find any firms matching ${scopeLabel}. Try a shorter or alternate spelling, or ask me to populate the firm from the web.`,
      };
    }

    const headers = ["Firm", "Type", "Address", "Notes"];
    const rows = buildRows(matches);
    const firmsWithAddresses = matches.filter((f) => f.addresses?.length).length;

    if (exportExcel) {
      const fname = (firmTypeFilter ? firmTypeFilter.replace(/\s+/g, "_").toLowerCase() : "firms") + "_addresses.csv";
      downloadCsv(fname, headers, rows);
    }

    const intro = isAll || firmTypeFilter
      ? `Here are the addresses for ${scopeLabel} — **${matches.length}** firm(s)${withAddressOnly ? " with an address on file" : `, ${firmsWithAddresses} with an address on file`}.${exportExcel ? " A CSV (Excel-compatible) download has started." : ""}`
      : (matches.length === 1
        ? `Here is the address on file for **${matches[0].name}**:`
        : `I found **${matches.length}** firms matching ${scopeLabel} (including partial matches). Please review the addresses below and let me know which firm you'd like to see.${exportExcel ? " A CSV (Excel-compatible) download has started." : ""}`);

    return {
      role: "assistant",
      content: intro,
      tables: [{ title: "Firm Addresses", headers, rows }],
    };
  } catch (error) {
    return {
      role: "assistant",
      content: `I encountered an error while searching for firm addresses: ${error.message}. Please try again.`,
    };
  }
}