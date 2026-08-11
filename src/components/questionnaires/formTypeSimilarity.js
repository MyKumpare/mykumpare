// Duplicate detection for form type names using Levenshtein distance.

function normalize(str) {
  return (str || "")
    .toLowerCase()
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

export const SIMILARITY_THRESHOLD = 0.8;

/**
 * Returns a similarity ratio (0-1) between two form type names.
 */
export function nameSimilarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

/**
 * Find near-match form types for a candidate name.
 * @param {string} name - candidate form type name
 * @param {Array} formTypes - existing FormType records
 * @returns {Array} matches with score >= SIMILARITY_THRESHOLD, sorted by score desc
 */
export function findFormTypeDuplicates(name, formTypes = []) {
  const candidate = normalize(name);
  if (!candidate) return [];
  return formTypes
    .map((ft) => {
      const score = nameSimilarity(name, ft.name);
      return { formType: ft, score };
    })
    .filter((m) => m.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}