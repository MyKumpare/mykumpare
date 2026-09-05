/**
 * Shared helpers for firm type. A firm has exactly ONE firm type (stored on
 * `firm_type`, a string). Legacy records may still carry a `firm_types` array
 * from the old multi-select model — the helpers below fall back to its first
 * element so existing data keeps working until it's migrated.
 */

/** Returns the firm's single firm type as a string (or "" if unset). */
export function getFirmType(f) {
  if (!f) return "";
  return f.firm_type || (f.firm_types?.length ? f.firm_types[0] : "") || "";
}

/**
 * Returns the firm's type as a single-element array (or [] if unset).
 * Kept for backward-compat with code that iterates over a type list.
 */
export function getFirmTypes(f) {
  const t = getFirmType(f);
  return t ? [t] : [];
}