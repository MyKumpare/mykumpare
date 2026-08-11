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
    const sim = nameSimilarity(newFirmName, existing.name);

    // Exact normalized match
    if (sim === 1) {
      reasons.push("Firm name is an exact match.");
    } else if (sim >= 0.85) {
      reasons.push(`Name is very similar to "${existing.name}".`);
    } else if (sim >= 0.7) {
      // Only flag if the normalized names share a token prefix (first word)
      // to reduce false positives on short generic names.
      const newTokens = normalizedName.split(" ");
      const existTokens = normalizeFirmName(existing.name).split(" ");
      if (newTokens[0] && existTokens[0] && newTokens[0] === existTokens[0]) {
        reasons.push(`Name is similar to "${existing.name}".`);
      } else {
        continue;
      }
    } else {
      continue;
    }

    duplicates.push({
      firm: existing,
      name: existing.name,
      score: sim,
      reasons,
    });
  }

  return duplicates.sort((a, b) => b.score - a.score);
}