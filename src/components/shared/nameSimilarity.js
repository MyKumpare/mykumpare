// Generic name-similarity / duplicate-detection utility used by creatable
// pickers and the paste-and-scrub flow to validate master-list values
// (benchmarks, eVestment Universe, etc.). An exact normalized match is treated
// as a duplicate (score 1); a near match (score >= SIMILARITY_THRESHOLD) is
// surfaced to the user to accept-merge or reject.

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
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

export const SIMILARITY_THRESHOLD = 0.82;
export const EXACT_THRESHOLD = 0.99;

export function normalizeName(str) {
  return normalize(str);
}

/**
 * Returns a similarity ratio (0-1) between two names.
 */
export function nameSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Substring containment = strong match (e.g. "S&P 500" inside "S&P 500 Index")
  if (na.includes(nb) || nb.includes(na)) return 0.95;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

/**
 * Find near-match items for a candidate name.
 * @param {string} name - candidate name
 * @param {Array<{id: string, name: string}>} existing - existing items
 * @param {number} threshold - minimum similarity to count as a near match
 * @returns {Array} matches with score >= threshold, sorted by score desc
 */
export function findNameDuplicates(name, existing = [], threshold = SIMILARITY_THRESHOLD) {
  const candidate = normalize(name);
  if (!candidate) return [];
  return existing
    .map((item) => {
      const score = nameSimilarity(name, item.name);
      return { id: item.id, name: item.name, score };
    })
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

/**
 * Classify a candidate name against existing items.
 * Returns { status: 'exact' | 'near' | 'new', match }
 */
export function classifyNameMatch(name, existing = []) {
  const matches = findNameDuplicates(name, existing, EXACT_THRESHOLD);
  if (matches.length > 0) {
    const exact = matches.find((m) => m.score >= EXACT_THRESHOLD);
    if (exact) return { status: "exact", match: exact };
    return { status: "near", match: matches[0] };
  }
  const near = findNameDuplicates(name, existing, SIMILARITY_THRESHOLD);
  if (near.length > 0) return { status: "near", match: near[0] };
  return { status: "new", match: null };
}