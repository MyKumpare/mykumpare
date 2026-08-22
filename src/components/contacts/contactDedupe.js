// Collapse duplicate contacts that share the same normalized first + last
// name. Keeps the most complete (longest full name) record, tiebreaking by
// most recently updated. Used by pickers/lists that should show one entry per
// person even when duplicate records exist in the database.

const NAME_STOPWORDS = new Set([
  "mr", "mrs", "ms", "miss", "dr", "prof", "hon",
  "jr", "sr", "ii", "iii", "iv", "esq", "cfa", "cpa", "mba", "phd", "md",
]);

function normalizeNamePart(s) {
  if (!s) return "";
  return s
    .toLowerCase()
    .trim()
    .replace(/[.'’-]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NAME_STOPWORDS.has(t))
    .join(" ")
    .trim();
}

function nameKey(c) {
  const first = (normalizeNamePart(c.first_name) || "").split(" ")[0] || "";
  const last = normalizeNamePart(c.last_name) || "";
  return `${first}|${last}`;
}

function getFullName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ");
}

/**
 * Deduplicate contacts by normalized first + last name.
 * When two records share a name, keeps the one with the longer full name
 * (more complete), tiebreaking by most recently updated.
 * @param {Array} contacts - Contact records (may include soft-deleted)
 * @returns {Array} Deduplicated list (soft-deleted records excluded)
 */
export function dedupeContacts(contacts) {
  const groups = new Map();
  for (const c of contacts) {
    if (c.deleted_at) continue;
    const k = nameKey(c);
    if (!k || k === "|") {
      groups.set(`__${c.id}`, [c]);
      continue;
    }
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }

  const fullNameLen = (c) => getFullName(c).length;
  const result = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // Keep the most complete record; tiebreak by most recently updated
    let best = group[0];
    for (let i = 1; i < group.length; i++) {
      const c = group[i];
      if (
        fullNameLen(c) > fullNameLen(best) ||
        (fullNameLen(c) === fullNameLen(best) &&
          new Date(c.updated_date || c.created_date || 0).getTime() >
            new Date(best.updated_date || best.created_date || 0).getTime())
      ) {
        best = c;
      }
    }
    result.push(best);
  }
  return result;
}