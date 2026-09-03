// Systemwide persistence of "accept" (keep both) decisions for contact
// sub-record duplicate pairs (education / professional experience / phones).
//
// Accepted pairs are stored on the Contact record itself (accepted_duplicate_pairs
// field) so they persist across sessions, browsers, and users — not just in
// per-browser localStorage. Pair keys are content-based (normalized
// institution / company / phone digits) rather than record-id-based, so they
// stay stable across record reordering and ID changes.

const norm = (s) =>
  (s || "").toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const phoneDigits = (rec) =>
  [rec?.area_code, rec?.number_mid, rec?.number_last].filter(Boolean).join("");

// Content-based pair key — stable across record ID changes and reordering.
// For education: the normalized institution name. For experience: the
// normalized company name. For phones: the concatenated digits. These match
// the duplicate-detection criteria in subRecordDuplicateCheck.js.
export function pairContentKey(p) {
  if (!p) return "";
  if (p.type === "education") {
    return `edu::${norm(p.a?.institution)}`;
  }
  if (p.type === "experience") {
    return `exp::${norm(p.a?.company_name)}`;
  }
  if (p.type === "phones") {
    return `phn::${phoneDigits(p.a)}`;
  }
  return `${p.type}::${p.aId}::${p.bId}`;
}

// Filter a list of detected pairs down to only those the user has NOT already
// accepted. acceptedKeys is the array from the contact record's
// accepted_duplicate_pairs field.
export function filterUnacceptedPairs(acceptedKeys, pairs) {
  if (!acceptedKeys || acceptedKeys.length === 0 || !pairs || pairs.length === 0) return pairs;
  const accepted = new Set(acceptedKeys);
  return pairs.filter((p) => !accepted.has(pairContentKey(p)));
}

// Compute the updated accepted-pairs list after the user resolves a review.
// decisions is the { pairKey: "accept" | "merge" | "delete" } map from the
// dialog. Only "accept" decisions (including the default) are persisted.
export function computeAcceptedKeys(existingKeys, pairs, decisions = {}) {
  const set = new Set(existingKeys || []);
  for (const p of pairs) {
    const idKey = `${p.type}::${p.aId}::${p.bId}`;
    const action = decisions[idKey] || "accept";
    if (action === "accept") {
      set.add(pairContentKey(p));
    }
  }
  return [...set];
}