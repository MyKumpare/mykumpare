/**
 * Duplicate product detection with fuzzy name matching within the same firm.
 * Two products are potential duplicates only when they belong to the same firm
 * AND their normalized names are exact or near-exact matches.
 *
 * Name normalization reuses the same legal-suffix stripping + Levenshtein
 * approach as firm duplicate detection.
 */

const PRODUCT_SUFFIXES = new Set([
  "inc", "inc.", "llc", "l.l.c.", "ltd", "ltd.", "limited", "co", "co.",
  "corp", "corp.", "corporation", "company", "lp", "l.p.", "llp", "l.l.p.",
  "fund", "funds", "strategy", "strategies", "series", "portfolio",
]);

function normalizeProductName(str) {
  if (!str) return "";
  return (str || "")
    .trim()
    .replace(/[.'’\-(),&]/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter((t) => {
      if (!t) return false;
      return !PRODUCT_SUFFIXES.has(t.toLowerCase());
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
  const na = normalizeProductName(a);
  const nb = normalizeProductName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

/**
 * Check a product against a list of other products (same firm) for duplicates.
 * @returns {Array} potential duplicates: [{ product, score }]
 */
export function findProductDuplicates(product, others) {
  if (!product || !others || others.length === 0) return [];
  const dups = [];
  for (const other of others) {
    if (!other || other.id === product.id) continue;
    if (other.deleted_at) continue;
    // Only compare within the same firm.
    if ((product.firm_id || "") !== (other.firm_id || "")) continue;
    const sim = nameSimilarity(product.name, other.name);
    if (sim >= 0.85) {
      dups.push({ product: other, score: sim });
    }
  }
  return dups.sort((a, b) => b.score - a.score);
}

/**
 * Group a list of products into duplicate clusters (same firm + similar name).
 * @param {Array} products - active (non-deleted) product records
 * @returns {Array<Array>} clusters of duplicate products (each cluster length >= 2)
 */
export function findDuplicateProductClusters(products) {
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < products.length; i++) {
    const a = products[i];
    if (assigned.has(a.id)) continue;
    const group = [a];
    assigned.add(a.id);

    const rest = products.filter((p) => p.id !== a.id && !assigned.has(p.id));
    const dups = findProductDuplicates(a, rest);
    for (const d of dups) {
      group.push(d.product);
      assigned.add(d.product.id);
    }

    if (group.length > 1) clusters.push(group);
  }
  return clusters;
}