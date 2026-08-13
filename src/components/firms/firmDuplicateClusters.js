/**
 * Duplicate firm clustering using fuzzy name matching.
 * Reuses the normalization + similarity logic from firmNameDuplicateCheck.js
 * to group firms whose normalized names are exact or near-exact matches.
 */
import { findFirmNameDuplicates } from "@/components/firms/firmNameDuplicateCheck";

/**
 * Group a list of firms into duplicate clusters.
 * Two firms are considered duplicates when findFirmNameDuplicates (which
 * normalizes legal suffixes and uses Levenshtein similarity >= 0.7 with a
 * shared first token) reports a match in either direction.
 *
 * @param {Array} firms - active (non-deleted) firm records
 * @returns {Array<Array>} clusters of duplicate firms (each cluster length >= 2)
 */
export function findDuplicateFirmClusters(firms) {
  const clusters = [];
  const assigned = new Set();

  for (let i = 0; i < firms.length; i++) {
    const a = firms[i];
    if (assigned.has(a.id)) continue;
    const group = [a];
    assigned.add(a.id);

    // Use findFirmNameDuplicates with `a` as the "new" name against the rest.
    const rest = firms.filter((f) => f.id !== a.id && !assigned.has(f.id));
    const dups = findFirmNameDuplicates(a.name, rest);
    for (const d of dups) {
      group.push(d.firm);
      assigned.add(d.firm.id);
    }

    if (group.length > 1) clusters.push(group);
  }
  return clusters;
}