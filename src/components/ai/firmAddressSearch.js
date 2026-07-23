import { base44 } from "@/api/base44Client";

// ─── Intent detection ───
// Detects when the user is asking the AI agent to look up the address(es)
// of a specific firm (any firm type — investment manager, allocator, etc.),
// even when the name provided is only a partial / incomplete match.
export function detectAddressIntent(query) {
  const q = query.toLowerCase();

  const hasAddressKeyword =
    /address|addresses|location|located|where is|where's|office|offices|headquarter|headquarters|based\b/i.test(q);

  if (!hasAddressKeyword) return { isAddressSearch: false };

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
      "headquarters", "of", "for", "firm", "company", "and", "their", "an", "a",
      "investment", "manager", "allocator", "consultant", "brokerage",
      "trade", "organization", "securities", "managers", "of", "managers",
    ]);
    const words = query.split(/\s+/);
    const properNouns = words
      .filter((w) => /^[A-Z]/.test(w) && !stopWords.has(w.toLowerCase().replace(/[^a-z]/g, "")))
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""));
    if (properNouns.length > 0) firmName = properNouns.join(" ");
  }

  if (firmName) {
    // Strip trailing firm-type descriptors and punctuation the regex may capture
    firmName = firmName
      .replace(/\s+(firm|company|managers?|allocator|consultant|brokerage|organization|securities)\s*$/i, "")
      .replace(/['"]/g, "")
      .trim();
  }

  return { isAddressSearch: !!firmName, firmName };
}

// ─── Partial matching ───
// Return ALL firms whose name partially matches the query (in either direction),
// ranked by match quality, so the user can decide which one they want.
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

  // Rank: exact match first, then firm-name-starts-with query, then query-starts-with firm-name, then substring.
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

function formatAddress(a) {
  return [a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country]
    .filter(Boolean)
    .join(", ");
}

// ─── Search & format ───
export async function searchFirmAddresses(firmName) {
  try {
    const matches = await findFirmsByPartialName(firmName);

    if (matches.length === 0) {
      return {
        role: "assistant",
        content: `I couldn't find any firms whose name matches **"${firmName}"** (including partial matches). Try a shorter or alternate spelling, or ask me to populate the firm from the web.`,
      };
    }

    // Build a table: one row per firm address (a firm with multiple addresses gets multiple rows).
    const headers = ["Firm", "Type", "Address", "Notes"];
    const rows = [];
    for (const f of matches) {
      const type = f.firm_types?.join(", ") || f.firm_type || "";
      const addresses = f.addresses?.length
        ? f.addresses
        : [];
      if (addresses.length === 0) {
        rows.push([f.name, type, "No address on file", ""]);
      } else {
        for (const a of addresses) {
          const note = a.is_headquarters ? "Headquarters" : "";
          rows.push([f.name, type, formatAddress(a), note]);
        }
      }
    }

    const intro =
      matches.length === 1
        ? `Here is the address on file for **${matches[0].name}**:`
        : `I found **${matches.length}** firms matching **"${firmName}"** (including partial matches). Please review the addresses below and let me know which firm you'd like to see.`;

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