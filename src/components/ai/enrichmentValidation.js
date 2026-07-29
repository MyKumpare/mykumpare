/**
 * Global enrichment duplicate validation.
 *
 * Standard process for any "auto-fill from web" flow:
 *  - EXACT duplicates are blocked (never auto-added).
 *  - SIMILAR (but not exact) items are flagged for explicit user confirmation.
 *  - NEW items are applied automatically.
 *
 * Every comparison returns one of: "exact" | "similar" | "new".
 */

import { findContactDuplicates } from "@/components/contacts/contactDuplicateCheck";
import { addressesAreExact, addressesAreSimilar } from "@/components/addressDuplicateCheck";

// ─── Shared normalizers ───

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function stringSimilarity(a, b) {
  const na = (a || "").toLowerCase().trim();
  const nb = (b || "").toLowerCase().trim();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

function normalizeUrl(url, { hostOnly = false } = {}) {
  if (!url) return "";
  let v = url.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "");
  // Strip query strings and fragments before comparing identity.
  v = v.split(/[?#]/)[0];
  if (hostOnly) v = v.split("/")[0];
  v = v.replace(/\/+$/, "");
  return v;
}

// Extract the identifying slug from a LinkedIn URL — the path segment right
// after /company/ (firms) or /in/ (people). e.g.
//   linkedin.com/company/xponance-inc/posts/?feedView=all → "xponance-inc"
//   linkedin.com/in/jane-doe/details/                    → "jane-doe"
function linkedinSlug(url) {
  if (!url) return "";
  let v = String(url).toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "");
  v = v.split(/[?#]/)[0].replace(/\/+$/, "");
  const m = v.match(/\/(?:company|in|pub|profile)\/([^/?#]+)/);
  return m ? m[1] : "";
}

function normalizeText(text) {
  if (text == null) return "";
  return String(text).toLowerCase().trim().replace(/\s+/g, " ");
}

// ─── Field-level comparison ───

const URL_FIELDS = new Set(["website", "linkedin_url", "logo_url"]);

/**
 * Compare an incoming scalar value against an existing value.
 * Returns { status, similarity, existing }.
 */
export function compareScalar(field, existingValue, incomingValue) {
  const existing = existingValue == null ? "" : existingValue;
  const incoming = incomingValue == null ? "" : incomingValue;

  if (!incoming) return { status: "new", similarity: 0, existing };

  if (URL_FIELDS.has(field)) {
    // Website identity is the domain (host): locale/marketing paths like
    // /en-us should not count as a different site. Compare by host.
    if (field === "website") {
      const a = normalizeUrl(existing, { hostOnly: true });
      const b = normalizeUrl(incoming, { hostOnly: true });
      if (!a) return { status: "new", similarity: 0, existing };
      if (a === b) return { status: "exact", similarity: 1, existing };
      const sim = stringSimilarity(a, b);
      return { status: sim >= 0.85 ? "similar" : "new", similarity: sim, existing };
    }
    // LinkedIn identity is the company/person slug — the path segment after
    // /company/ or /in/. This is robust to trailing paths (e.g. /posts/,
    // /about/) and query strings that get appended to the stored URL.
    if (field === "linkedin_url") {
      const a = normalizeUrl(existing);
      const b = normalizeUrl(incoming);
      if (!a) return { status: "new", similarity: 0, existing };
      if (a === b) return { status: "exact", similarity: 1, existing };
      const slugA = linkedinSlug(existing);
      const slugB = linkedinSlug(incoming);
      if (slugA && slugB && slugA === slugB) return { status: "exact", similarity: 1, existing };
      const sim = stringSimilarity(a, b);
      return { status: sim >= 0.85 ? "similar" : "new", similarity: sim, existing };
    }
    // Logo URLs are re-hosted on each enrichment, so the stored and incoming
    // URLs are always different even for the same image. If the firm already
    // has a logo, treat the incoming one as "similar" so the user can review
    // and choose to override it (e.g. when the existing logo is incorrect).
    if (field === "logo_url") {
      const a = normalizeUrl(existing);
      if (!a) return { status: "new", similarity: 0, existing };
      return { status: "similar", similarity: 0.8, existing };
    }
  }

  if (field === "year_founded") {
    const a = String(existing || "").trim();
    const b = String(incoming).trim();
    if (!a) return { status: "new", similarity: 0, existing };
    return a === b ? { status: "exact", similarity: 1, existing } : { status: "new", similarity: 0, existing };
  }

  // Description: we never overwrite an existing firm description during
  // enrichment (append-only). If the firm already has any description, the
  // incoming one is treated as "already exists" so it is blocked — even
  // when the wording differs (a fresh scrape often rephrases it).
  if (field === "description") {
    const a = normalizeText(existing);
    const b = normalizeText(incoming);
    if (!b) return { status: "new", similarity: 0, existing };
    if (!a) return { status: "new", similarity: 0, existing };
    if (a === b) return { status: "exact", similarity: 1, existing };
    return { status: "exact", similarity: 0.9, existing };
  }

  if (field === "firm_types") {
    const aSet = new Set((existing || []).map((t) => normalizeText(t)));
    const bSet = new Set((incoming || []).map((t) => normalizeText(t)));
    const onlyNew = [...bSet].filter((t) => !aSet.has(t));
    if (onlyNew.length === 0) return { status: "exact", similarity: 1, existing };
    if (aSet.size > 0 && onlyNew.length < bSet.size) return { status: "similar", similarity: 0.8, existing };
    return { status: "new", similarity: 0, existing };
  }

  // Generic text comparison (description, email, name)
  const a = normalizeText(existing);
  const b = normalizeText(incoming);
  if (!a) return { status: "new", similarity: 0, existing };
  if (a === b) return { status: "exact", similarity: 1, existing };
  const sim = stringSimilarity(a, b);
  return { status: sim >= 0.85 ? "similar" : "new", similarity: sim, existing };
}

// ─── Address comparison ───

export function compareAddress(existingAddresses, incomingAddr) {
  if (!incomingAddr || (!incomingAddr.address_line1 && !incomingAddr.city)) {
    return { status: "new", similarity: 0 };
  }
  for (const ex of existingAddresses || []) {
    if (addressesAreExact(ex, incomingAddr)) return { status: "exact", similarity: 1 };
  }
  for (const ex of existingAddresses || []) {
    if (addressesAreSimilar(ex, incomingAddr)) return { status: "similar", similarity: 0.85 };
  }
  return { status: "new", similarity: 0 };
}

// ─── Phone comparison ───

function phoneDigits(phone) {
  if (!phone) return "";
  return [phone.country_code, phone.area_code, phone.number_mid, phone.number_last]
    .filter(Boolean)
    .join("")
    .replace(/\D/g, "");
}

export function comparePhone(existingPhones, incomingPhone) {
  if (!incomingPhone) return { status: "new", similarity: 0 };
  const inDigits = phoneDigits(incomingPhone);
  if (inDigits.length < 7) return { status: "new", similarity: 0 };
  for (const ex of existingPhones || []) {
    const exDigits = phoneDigits(ex);
    if (exDigits && exDigits === inDigits) return { status: "exact", similarity: 1 };
    if (exDigits.length >= 7 && exDigits.slice(-7) === inDigits.slice(-7)) {
      return { status: "exact", similarity: 1 };
    }
  }
  return { status: "new", similarity: 0 };
}

// ─── Contact (person) comparison ───

/**
 * Compare an enriched person against existing contacts.
 * Exact = same email or very high name match (score >= 0.9).
 * Similar = fuzzy duplicate (score >= 0.7).
 * New = no match.
 */
export function compareContact(person, existingContacts) {
  if (!person || (!person.first_name && !person.last_name)) return { status: "new", similarity: 0, match: null };
  const probe = {
    first_name: person.first_name || "",
    last_name: person.last_name || "",
    email: person.email || "",
    phones: person.phone ? [{ country_code: "", area_code: "", number_mid: "", number_last: "" }] : [],
    photo_url: person.photo_url || "",
  };
  const dups = findContactDuplicates(probe, existingContacts || []);
  if (dups.length === 0) return { status: "new", similarity: 0, match: null };
  const best = dups[0];
  if (best.score >= 0.9) return { status: "exact", similarity: best.score, match: best };
  return { status: "similar", similarity: best.score, match: best };
}

// ─── Full enrichment validation ───

const SCALAR_FIELDS = [
  "logo_url", "description", "website", "email", "linkedin_url", "year_founded", "firm_types",
];

/**
 * Validate a full enriched payload against existing firm + contacts.
 * Returns { items: [{ key, label, status, similarity, existing, value }] } where
 * status is one of "exact" | "similar" | "new".
 */
export function validateEnrichment(enrichedData, existingFirm = {}, existingContacts = []) {
  const items = [];

  for (const field of SCALAR_FIELDS) {
    const incoming = enrichedData[field];
    if (incoming == null || incoming === "" || (Array.isArray(incoming) && incoming.length === 0)) continue;
    const res = compareScalar(field, existingFirm[field], incoming);
    items.push({ key: field, label: fieldToLabel(field), status: res.status, similarity: res.similarity, value: incoming, existing: res.existing });
  }

  (enrichedData.addresses || []).forEach((addr, i) => {
    if (!addr.address_line1 && !addr.city) return;
    const res = compareAddress(existingFirm.addresses || [], addr);
    items.push({ key: `address_${i}`, label: `Address ${addr.is_headquarters ? "(HQ)" : `#${i + 1}`}`, status: res.status, similarity: res.similarity, value: addr });
  });

  (enrichedData.phones || []).forEach((phone, i) => {
    if (!phone.area_code && !phone.number_last && !phone.country_code) return;
    const res = comparePhone(existingFirm.phones || [], phone);
    items.push({ key: `phone_${i}`, label: `Phone ${phone.phone_type ? `(${phone.phone_type})` : `#${i + 1}`}`, status: res.status, similarity: res.similarity, value: phone });
  });

  (enrichedData.people || []).forEach((person, i) => {
    if (!person.first_name && !person.last_name) return;
    const res = compareContact(person, existingContacts);
    const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ");
    items.push({ key: `person_${i}`, label: `Person: ${fullName}${person.title ? ` — ${person.title}` : ""}`, status: res.status, similarity: res.similarity, value: person, match: res.match });
  });

  return { items };
}

function fieldToLabel(field) {
  const map = {
    logo_url: "Firm Logo",
    description: "Description",
    website: "Website",
    email: "Email",
    linkedin_url: "LinkedIn",
    year_founded: "Year Founded",
    firm_types: "Firm Types",
  };
  return map[field] || field;
}

/**
 * Partition validation items into buckets for the standard apply flow.
 */
export function partitionValidation(items) {
  const exact = items.filter((i) => i.status === "exact");
  const similar = items.filter((i) => i.status === "similar");
  const fresh = items.filter((i) => i.status === "new");
  return { exact, similar, fresh };
}