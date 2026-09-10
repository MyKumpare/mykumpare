// Duplicate detection for contacts based on normalized name + email matching.
// Three match levels: exact (name+email), same_email, same_name.

const SALUTATIONS = ["mr", "ms", "mrs", "dr", "prof", "hon"];
const SUFFIXES = ["jr", "sr", "ii", "iii", "iv", "esq", "cfa", "cpa", "mba", "phd", "md"];

/** Normalize a contact's full name for matching: lowercase, strip salutations/suffixes, collapse whitespace. */
export function normalizeContactName(c) {
  const parts = [c.first_name, c.middle_name, c.last_name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim();
  if (!parts) return "";
  let tokens = parts.split(/\s+/);
  tokens = tokens.filter((t) => !SALUTATIONS.includes(t.replace(/\./g, "")));
  tokens = tokens.filter((t) => !SUFFIXES.includes(t.replace(/\./g, "")));
  return tokens.join(" ").trim();
}

/** Normalize an email address: lowercase, trim, extract address from angle brackets. */
export function normalizeEmail(email) {
  if (!email) return "";
  let e = email.toString().toLowerCase().trim();
  // Extract from "Name <email@domain.com>" format
  const match = e.match(/<([^>]+)>/);
  if (match) e = match[1];
  // Strip mailto: prefix
  e = e.replace(/^mailto:/, "");
  return e.trim();
}

/** Full display name for a contact (with salutation/suffix). */
export function contactDisplayName(c) {
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix]
    .filter(Boolean)
    .join(" ") || [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

/**
 * Build duplicate groups from a contact list, keyed by match level.
 * Returns { exact: Group[], sameEmail: Group[], sameName: Group[] }
 * Each Group = { key, contacts: Contact[], matchType: 'exact'|'same_email'|'same_name' }
 */
export function findNameEmailDuplicates(contacts) {
  const active = (contacts || []).filter((c) => !c.deleted_at);

  // Group by normalized email
  const byEmail = new Map();
  // Group by normalized name
  const byName = new Map();

  for (const c of active) {
    const email = normalizeEmail(c.email);
    const name = normalizeContactName(c);

    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(c);
    }
    if (name) {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(c);
    }
  }

  const exact = [];
  const sameEmail = [];
  const sameName = [];

  // Exact: same normalized name AND same normalized email
  const exactSeen = new Set();
  for (const [email, emailGroup] of byEmail) {
    for (const [name, nameGroup] of byName) {
      // Contacts present in both groups
      const shared = emailGroup.filter((c) => normalizeContactName(c) === name);
      if (shared.length > 1) {
        const key = `${email}::${name}`;
        if (exactSeen.has(key)) continue;
        exactSeen.add(key);
        exact.push({ key, contacts: shared, matchType: "exact" });
      }
    }
  }

  // Same email, different names
  for (const [email, group] of byEmail) {
    if (group.length < 2) continue;
    // Skip if this is already an exact match group (all same name)
    const names = new Set(group.map(normalizeContactName));
    if (names.size === 1) continue; // already in exact
    sameEmail.push({ key: `email:${email}`, contacts: group, matchType: "same_email" });
  }

  // Same name, different emails
  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    // Skip if all share the same email (already in exact)
    const emails = new Set(group.map((c) => normalizeEmail(c.email)));
    if (emails.size === 1 && emails.has("")) continue;
    if (emails.size === 1) continue; // all same email + same name = exact match
    sameName.push({ key: `name:${name}`, contacts: group, matchType: "same_name" });
  }

  return { exact, sameEmail, sameName };
}