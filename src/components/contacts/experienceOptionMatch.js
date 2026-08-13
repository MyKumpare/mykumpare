import { base44 } from "@/api/base44Client";
import { nameSimilarity } from "./contactTypeSimilarity";

export const OPTION_SIMILARITY_THRESHOLD = 0.8;

/**
 * Find near-match existing names for a candidate value.
 * @param {string} name - candidate value
 * @param {Array<string>} existingNames - names already in the master list
 * @returns {Array} matches with score >= threshold, sorted by score desc
 */
export function findOptionMatches(name, existingNames = []) {
  if (!name || !name.trim()) return [];
  return existingNames
    .map((n) => ({ name: n, score: nameSimilarity(name, n) }))
    .filter((m) => m.score >= OPTION_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

/**
 * Fetch the company and job-title master lists in parallel.
 */
export async function fetchExperienceOptionLists() {
  const [companies, titles] = await Promise.all([
    base44.entities.CompanyNameOption.list("-created_date", 5000).catch(() => []),
    base44.entities.JobTitleOption.list("-created_date", 5000).catch(() => []),
  ]);
  return {
    companyNames: companies.map((r) => r.name).filter(Boolean),
    titleNames: titles.map((r) => r.name).filter(Boolean),
  };
}

/**
 * Build a list of conflicts between extracted experience items and the master
 * lists. Each conflict references the item index and the field with a match.
 */
export function buildExperienceConflicts(items, companyNames, titleNames) {
  const conflicts = [];
  items.forEach((item, idx) => {
    if (item.company_name) {
      const matches = findOptionMatches(item.company_name, companyNames);
      if (matches.length > 0) conflicts.push({ itemIndex: idx, field: "company_name", newValue: item.company_name, matches });
    }
    if (item.title) {
      const matches = findOptionMatches(item.title, titleNames);
      if (matches.length > 0) conflicts.push({ itemIndex: idx, field: "title", newValue: item.title, matches });
    }
  });
  return conflicts;
}