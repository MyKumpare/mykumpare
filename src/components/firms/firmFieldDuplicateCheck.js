// Website / email / LinkedIn duplicate & similarity detection for firms.
// Used to alert the user when a firm's website, email, or LinkedIn URL matches
// (exactly or closely) another firm already in the system, before saving.

function norm(s) {
  return (s == null ? "" : String(s)).trim().toLowerCase();
}

// Normalize a website URL for exact comparison: strip protocol, leading
// "www.", and trailing slashes — so "https://www.Acme.com/" and
// "http://acme.com" are treated as the same site.
export function normalizeWebsite(u) {
  let v = norm(u);
  if (!v) return "";
  v = v.replace(/^https?:\/\//, "");
  v = v.replace(/^www\./, "");
  v = v.replace(/\/+$/, "");
  return v;
}

// Extract the hostname (no path/query) of a website URL, normalized the same
// way as normalizeWebsite. Used for "similar" detection: the same hostname
// with a different path (e.g. "acme.com" vs "acme.com/careers") is plausibly
// the same firm.
export function websiteHostname(u) {
  const n = normalizeWebsite(u);
  if (!n) return "";
  return n.split("/")[0].split("?")[0];
}

export function normalizeEmail(e) {
  return norm(e);
}

export function emailDomain(e) {
  const n = normalizeEmail(e);
  if (!n || !n.includes("@")) return "";
  return n.split("@").pop();
}

// Common consumer/free email providers — a shared domain here (e.g. two firms
// both using @gmail.com) is NOT evidence of being the same firm, so it's
// excluded from "similar" email detection.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com",
  "icloud.com", "protonmail.com", "live.com", "msn.com", "yandex.com",
  "mail.com", "zoho.com", "gmx.com", "proton.me",
]);

// Normalize a LinkedIn URL: strip protocol, leading www., optional locale
// prefix (e.g. "uk."), and trailing slashes. LinkedIn company pages are
// unique, so a normalized match is treated as exact.
export function normalizeLinkedin(u) {
  let v = norm(u);
  if (!v) return "";
  v = v.replace(/^https?:\/\//, "");
  v = v.replace(/^www\./, "");
  v = v.replace(/^([a-z]{2}-[a-z]{2})\./, "");
  v = v.replace(/\/+$/, "");
  return v;
}

const FIELD_LABELS = {
  website: "Website",
  email: "Email",
  linkedin_url: "LinkedIn",
};

export function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

// Compare a firm's website / email / LinkedIn against a list of existing
// firms. Returns a list of conflicts:
//   [{ field, currentValue, existingFirm, existingValue, matchType }]
// matchType is "exact" (normalized values identical) or "similar" (same
// website hostname, or same non-free email domain).
//
// `excludeId` is the id of the firm currently being edited, so it never
// conflicts with itself.
export function findFirmFieldConflicts(current, existingFirms, excludeId) {
  const conflicts = [];
  const list = Array.isArray(existingFirms) ? existingFirms : [];

  const cw = normalizeWebsite(current?.website);
  const ch = websiteHostname(current?.website);
  const ce = normalizeEmail(current?.email);
  const cd = emailDomain(current?.email);
  const cl = normalizeLinkedin(current?.linkedin_url);

  for (const f of list) {
    if (!f) continue;
    if (f.deleted_at) continue;
    if (excludeId && f.id === excludeId) continue;

    // Website — exact (normalized full URL) then similar (same hostname).
    // NOTE: do NOT `continue` here — that would skip the email/LinkedIn checks
    // for this same firm. Only the similar-hostname sub-check is mutually
    // exclusive with the exact match.
    if (cw) {
      const ew = normalizeWebsite(f.website);
      if (ew && ew === cw) {
        conflicts.push({ field: "website", currentValue: current.website, existingFirm: f, existingValue: f.website, matchType: "exact" });
      } else {
        const eh = websiteHostname(f.website);
        if (ch && eh && ch === eh) {
          conflicts.push({ field: "website", currentValue: current.website, existingFirm: f, existingValue: f.website, matchType: "similar" });
        }
      }
    }

    // Email — exact then similar (same non-free domain)
    if (ce) {
      const ee = normalizeEmail(f.email);
      if (ee && ee === ce) {
        conflicts.push({ field: "email", currentValue: current.email, existingFirm: f, existingValue: f.email, matchType: "exact" });
      } else {
        const ed = emailDomain(f.email);
        if (cd && ed && cd === ed && !FREE_EMAIL_DOMAINS.has(cd)) {
          conflicts.push({ field: "email", currentValue: current.email, existingFirm: f, existingValue: f.email, matchType: "similar" });
        }
      }
    }

    // LinkedIn — normalized match is exact (company pages are unique)
    if (cl) {
      const el = normalizeLinkedin(f.linkedin_url);
      if (el && el === cl) {
        conflicts.push({ field: "linkedin_url", currentValue: current.linkedin_url, existingFirm: f, existingValue: f.linkedin_url, matchType: "exact" });
      }
    }
  }

  return conflicts;
}