// Duplicate product-name detection with fuzzy matching, scoped to the
// products of a single firm. Used by the CSV product import to prevent
// creating a product that is an exact or near-exact match of one already
// associated with the same firm.
function normalizeProductName(str) {
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
 * Check a new product name against existing products (typically the ones
 * belonging to the same firm) for exact or near-exact matches.
 * @param {string} newProductName
 * @param {Array} existingProducts - Product entities to compare against.
 * @returns {Array} [{ product, name, score, reasons }]
 */
export function findProductDuplicates(newProductName, existingProducts) {
  if (!newProductName || !existingProducts || existingProducts.length === 0) return [];
  const duplicates = [];
  for (const existing of existingProducts) {
    if (!existing || existing.deleted_at) continue;
    if (!existing.name) continue;
    const sim = nameSimilarity(newProductName, existing.name);
    if (sim === 1) {
      duplicates.push({ product: existing, name: existing.name, score: sim, reasons: ["Product name is an exact match."] });
    } else if (sim >= 0.85) {
      duplicates.push({ product: existing, name: existing.name, score: sim, reasons: [`Name is similar to "${existing.name}".`] });
    }
  }
  return duplicates.sort((a, b) => b.score - a.score);
}