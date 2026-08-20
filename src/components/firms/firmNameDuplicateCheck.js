/**
 * Duplicate firm detection with fuzzy name matching.
 * Normalizes firm names by stripping legal suffixes (Inc, LLC, Ltd, etc.)
 * and common punctuation, then uses Levenshtein distance for near-match scoring.
 */

// Legal/business suffixes stripped before comparing firm names so that
// "Acme Capital Inc." and "Acme Capital LLC" are treated as the same firm.
const FIRM_SUFFIXES = new Set([
  "inc", "inc.", "llc", "l.l.c.", "ltd", "ltd.", "limited", "co", "co.",
  "corp", "corp.", "corporation", "company", "lp", "l.p.", "llp", "l.l.p.",
  "plc", "sa", "ag", "gmbh", "holdings", "group", "partners",
]);

function normalizeFirmName(str) {
  if (!str) return "";
  return (str || "")
    .trim()
    .replace(/[.'’\-(),&]/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((t) => {
      if (!t) return false;
      const lower = t.toLowerCase();
      if (FIRM_SUFFIXES.has(lower)) return false;
      return true;
    })
    .map((t) => t.toLowerCase())
    .join(" ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a, b) {
  const na = normalizeFirmName(a);
  const nb = normalizeFirmName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

/**
 * Check a new firm name against existing firms for potential duplicates.
 * @param {string} newFirmName - The firm name the user entered.
 * @param {Array} existingFirms - Array of Firm entities.
 * @returns {Array} potential duplicates: [{ firm, name, score, reasons }]
 */
export function findFirmNameDuplicates(newFirmName, existingFirms) {
  if (!newFirmName || !existingFirms || existingFirms.length === 0) return [];

  const normalizedName = normalizeFirmName(newFirmName);
  if (!normalizedName) return [];

  const duplicates = [];

  for (const existing of existingFirms) {
    if (!existing || existing.deleted_at) continue;
    if (!existing.name) continue;

    const reasons = [];
    const rawMatch = newFirmName.trim().toLowerCase() === existing.name.trim().toLowerCase();
    const sim = nameSimilarity(newFirmName, existing.name);

    if (rawMatch) {
      // True exact match — raw strings are identical (case-insensitive).
      reasons.push("Firm name is an exact match.");
      duplicates.push({ firm: existing, name: existing.name, score: 1, reasons });
    } else if (sim === 1) {
      // Normalized match but raw strings differ (e.g. one has a legal suffix
      // like "LLC" the other lacks). Treat as a near match, not exact, so the
      // user can choose which name version to keep on the firm record.
      reasons.push("Firm name is a near match (differs only by legal suffix or punctuation).");
      duplicates.push({ firm: existing, name: existing.name, score: 0.99, reasons });
    } else if (sim >= 0.7) {
      // Only flag near-matches if the normalized names share the same first
      // (distinguishing) token. Generic shared words like "investment
      // management" alone must not make two different firms look alike.
      const newTokens = normalizedName.split(" ");
      const existTokens = normalizeFirmName(existing.name).split(" ");
      if (!newTokens[0] || !existTokens[0] || newTokens[0] !== existTokens[0]) {
        continue;
      }
      if (sim >= 0.85) {
        reasons.push(`Name is very similar to "${existing.name}".`);
      } else {
        reasons.push(`Name is similar to "${existing.name}".`);
      }
      duplicates.push({ firm: existing, name: existing.name, score: sim, reasons });
    }
  }

  return duplicates.sort((a, b) => b.score - a.score);
}