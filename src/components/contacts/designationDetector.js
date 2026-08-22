/**
 * Detects professional designations from a person's name and biography text.
 * Returns an array of matched designation strings (e.g. ["CFA", "MBA"]).
 *
 * Designations are matched case-insensitively as whole words, so "CFA" won't
 * match inside "confabulate".  Suffix-style usage (e.g. "John Smith, CFA") and
 * inline mentions (e.g. "He holds an MBA from...") are both caught.
 */
const DESIGNATION_PATTERNS = [
  { label: "CFA", regex: /\bCFA\b/i },
  { label: "CPA", regex: /\bCPA\b/i },
  { label: "MBA", regex: /\bMBA\b/i },
  { label: "PhD", regex: /\bPh\.?D\b/i },
  { label: "MD", regex: /\bM\.D\b/i },
  { label: "JD", regex: /\bJ\.D\b/i },
  { label: "LLM", regex: /\bLL\.M\b/i },
  { label: "CFP", regex: /\bCFP\b/i },
  { label: "FRM", regex: /\bFRM\b/i },
  { label: "CAIA", regex: /\bCAIA\b/i },
  { label: "CMT", regex: /\bCMT\b/i },
  { label: "ChFC", regex: /\bChFC\b/i },
  { label: "PMP", regex: /\bPMP\b/i },
  { label: "ASA", regex: /\bASA\b/i },
  { label: "FSA", regex: /\bFSA\b/i },
  { label: "EA", regex: /\bEA\b/i },
  { label: "CIIA", regex: /\bCIIA\b/i },
  { label: "CISI", regex: /\bCISI\b/i },
  { label: "FMVA", regex: /\bFMVA\b/i },
  { label: "CBCP", regex: /\bCBCP\b/i },
];

export function detectDesignations(name, biography) {
  const text = [name, biography].filter(Boolean).join(" ");
  if (!text) return [];

  const found = [];
  for (const { label, regex } of DESIGNATION_PATTERNS) {
    if (regex.test(text) && !found.includes(label)) {
      found.push(label);
    }
  }
  return found;
}

/**
 * Strips a trailing designation (e.g. ", CFA" or " CFA") from a name string
 * so it doesn't appear duplicated in the displayed name.
 */
export function stripDesignationFromName(name) {
  if (!name) return name;
  let cleaned = name;
  for (const { regex } of DESIGNATION_PATTERNS) {
    // Remove ", CFA" or " CFA" or " (CFA)" at the end of the name
    cleaned = cleaned.replace(new RegExp(`[,\\s]+${regex.source}[\\s)]*$`, "i"), "");
    cleaned = cleaned.replace(new RegExp(`\\s*\\(${regex.source}\\)\\s*$`, "i"), "");
  }
  return cleaned.trim();
}

/**
 * Cleans a scraped contact's name fields by stripping embedded designations
 * (e.g. last_name "Best, CFA" → "Best") and merging them into the designations
 * array. Prevents "CFA, CFA" display where the designation appears both in the
 * name and in the designations array. Returns { first_name, last_name, designations }.
 */
export function cleanContactNameFields(contact) {
  const rawFirst = (contact.first_name || "").trim();
  const rawLast = (contact.last_name || "").trim();
  const fullName = `${rawFirst} ${rawLast}`.trim();

  // Detect designations from the full name + biography
  const detected = detectDesignations(fullName, contact.biography);

  // Strip trailing designations from each name part
  const first_name = stripDesignationFromName(rawFirst);
  const last_name = stripDesignationFromName(rawLast);

  // Merge with any designations already on the contact, deduplicated
  const existing = Array.isArray(contact.designations) ? contact.designations : [];
  const designations = [...new Set([...detected, ...existing])].filter(Boolean);

  return { first_name: first_name || rawFirst, last_name: last_name || rawLast, designations };
}