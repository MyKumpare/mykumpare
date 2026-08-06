/**
 * Levenshtein distance + normalization utilities for duplicate detection.
 * Shared across template type pickers to prevent exact or near-duplicate
 * type names from being saved.
 */

export function normalizeTypeName(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = [];
  let curr = [];

  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

const SIMILARITY_THRESHOLD = 0.85;

export function findSimilarTypeName(input, existingNames) {
  const normalized = normalizeTypeName(input);
  if (!normalized) return null;

  for (const existing of existingNames) {
    const existingNorm = normalizeTypeName(existing);
    if (!existingNorm) continue;

    if (existingNorm === normalized) return existing;

    const maxLen = Math.max(normalized.length, existingNorm.length);
    if (maxLen === 0) continue;

    const distance = levenshtein(normalized, existingNorm);
    const similarity = 1 - distance / maxLen;

    if (similarity >= SIMILARITY_THRESHOLD) return existing;
  }

  return null;
}