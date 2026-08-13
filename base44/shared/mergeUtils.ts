// Shared merge helpers used by mergeContacts, mergeFirms, and mergeProducts.
// Plain module — no Deno.serve. Import from functions via:
//   import { pickScalar, toArray, union, dedupeByKey, mergeAumHistory } from "../../shared/mergeUtils.ts";

/** Pick the non-empty scalar value from primary (preferred) or secondary. */
export function pickScalar(primary, secondary) {
  return (key) => {
    const pv = primary[key];
    const sv = secondary[key];
    if (sv === undefined || sv === null || sv === '') return pv;
    if (pv === undefined || pv === null || pv === '') return sv;
    return pv;
  };
}

/** Normalize any value to an array (null/undefined → [], non-array → [value]). */
export function toArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

/** Union two array-ish values into a deduplicated array. */
export function union(a, b) {
  return Array.from(new Set([...toArray(a), ...toArray(b)]));
}

/**
 * Dedupe an array of objects by a key function. Later entries overwrite
 * earlier ones on key collision (or keep first — caller controls order).
 */
export function dedupeByKey(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    if (item) map.set(keyFn(item), item);
  }
  return Array.from(map.values());
}

/** Phone dedupe key (country|area|mid|last). */
export function phoneKey(p) {
  return `${p?.country_code || ''}|${p?.area_code || ''}|${p?.number_mid || ''}|${p?.number_last || ''}`;
}

/** Address dedupe key (address_line1|city, lowercased). */
export function addrKey(a) {
  return `${(a?.address_line1 || '').toLowerCase()}|${(a?.city || '').toLowerCase()}`;
}

/**
 * Merge two AUM history arrays by month_end_date.
 * Primary entries win on date collision; secondary entries fill gaps.
 */
export function mergeAumHistory(primaryHistory, secondaryHistory) {
  const aumMap = new Map();
  for (const a of toArray(secondaryHistory)) {
    if (a && a.id) aumMap.set(a.month_end_date, a);
  }
  for (const a of toArray(primaryHistory)) {
    if (a && a.id) aumMap.set(a.month_end_date, a);
  }
  return Array.from(aumMap.values());
}