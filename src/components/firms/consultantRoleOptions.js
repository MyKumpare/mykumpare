// Default preset options for the two consultant-related master lists.
// Users can add custom options beyond these; the pickers persist new
// options to the corresponding master-list entity and validate against
// duplicates (exact, substring, and fuzzy near-matches).

export const CONSULTANT_ROLE_PRESETS = [
  "General Consultant",
  "Asset Class Consultant",
];

export const CONSULTANT_CONTACT_ROLE_PRESETS = [
  "Manager Research",
  "Field Consultant",
];

const normalize = (s) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[^a-z0-9\s]/g, "");

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[n];
}

const similarity = (a, b) => {
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen;
};

/**
 * Find existing options that are an exact match or a close variation of the
 * typed value. Used by both pickers to warn before adding a potential duplicate.
 */
export function findSimilarOptions(val, allOptions) {
  const target = normalize(val);
  if (!target) return [];
  const seen = new Set();
  const matches = [];
  for (const o of allOptions) {
    const n = normalize(o);
    if (seen.has(n)) continue;
    seen.add(n);
    const isExact = n === target;
    const isSubstring = n.includes(target) || target.includes(n);
    const isFuzzy = similarity(n, target) >= 0.82;
    if (isExact || isSubstring || isFuzzy) matches.push(o);
  }
  return matches;
}

export { normalize };