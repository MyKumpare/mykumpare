/**
 * Title-case a company name or job title: uppercase the first letter of every
 * whitespace-separated word, leaving the rest of each word unchanged so
 * acronyms (LLC, CIO, NY) and existing capitalization are preserved.
 *
 * "goldman sachs LLC"          → "Goldman Sachs LLC"
 * "ceo"                        → "Ceo"
 * "Chief Investment Officer"   → unchanged
 */
export function titleCase(value) {
  if (!value || typeof value !== "string") return value;
  return value
    .split(/(\s+)/)
    .map((part) => (part.trim() ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join("");
}