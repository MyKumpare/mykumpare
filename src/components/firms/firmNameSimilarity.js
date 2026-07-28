// Compares the user-entered firm name against the company name derived from a
// LinkedIn company URL slug. Used to guard the "Find" LinkedIn lookup so that
// only the correct firm is matched to the correct LinkedIn page — when the
// distinctive name tokens don't appear in the LinkedIn company name, the caller
// should prompt the user to accept or reject the match.

// Dropped entirely before tokenizing.
const STOPWORDS = new Set([
  "inc", "llc", "ltd", "limited", "co", "corp", "corporation", "company",
  "the", "and", "of", "lp", "llp", "plc", "sa", "ag", "gmbh", "usa", "us",
]);

// Common business-descriptive words. These don't count as "distinctive" name
// tokens even though they're long — "Capital", "Partners", etc. are shared by
// many unrelated firms.
const GENERIC = new Set([
  "capital", "group", "investment", "investments", "management", "managers",
  "partners", "advisor", "advisors", "advisory", "financial", "finance",
  "holdings", "associates", "asset", "assets", "securities", "global",
  "international", "services", "consultants", "consulting", "consultant",
  "wealth", "funds", "fund", "trust", "banking", "bank", "insurance",
  "reinsurance", "solutions", "enterprises", "ventures", "research",
  "investors", "family", "office",
]);

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(name) {
  return normalizeName(name)
    .split(" ")
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t) && t.length >= 3);
}

/**
 * @param {string} firmName The firm name the user entered.
 * @param {string} linkedinCompanyName Company name derived from the LinkedIn slug.
 * @param {string} [linkedinSlug] The raw slug (also searched, as a fallback).
 * @returns {{ similar: boolean, score: number, reason: string }}
 */
export function isFirmNameSimilarToLinkedin(firmName, linkedinCompanyName, linkedinSlug) {
  const liText = normalizeName(`${linkedinCompanyName || ""} ${linkedinSlug || ""}`);
  if (!liText) {
    // No LinkedIn company name available — don't block (avoid false alerts).
    return { similar: true, score: 1, reason: "No LinkedIn company name to compare." };
  }

  const firmToks = tokensOf(firmName);
  if (!firmToks.length) {
    return { similar: false, score: 0, reason: "Firm name is too short to compare." };
  }

  // Distinctive tokens = length >= 4 and not a generic business word.
  const proper = firmToks.filter((t) => t.length >= 4 && !GENERIC.has(t));
  const checkTokens = proper.length ? proper : firmToks;

  // A token "matches" if it appears as a substring anywhere in the normalized
  // LinkedIn text (covers concatenated slug forms like "blackrockinc").
  const matched = checkTokens.filter((t) => liText.includes(t));
  const score = checkTokens.length ? matched.length / checkTokens.length : 0;
  const similar = matched.length === checkTokens.length;

  return {
    similar,
    score,
    reason: similar
      ? "Firm name matches the LinkedIn company name."
      : "The firm's distinctive name was not found in the LinkedIn company name.",
  };
}