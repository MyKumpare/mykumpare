/**
 * Duplicate contact detection with fuzzy matching.
 * Detects name variations (nicknames, missing middle names, swapped fields),
 * email similarity, and phone number overlap.
 */

// Salutations / suffixes that should be ignored when comparing names, so that
// "Mrs. Sumali Sanyal" and "Sumali Sanyal" (or "Sumali Sanyal, CFA") are treated
// as the same person rather than slipping through as a duplicate.
const NAME_STOPWORDS = new Set([
  "mr", "mrs", "ms", "miss", "dr", "prof", "professor", "hon", "sir", "madam",
  "jr", "sr", "ii", "iii", "iv", "v", "esq", "cfa", "cpa", "mba", "phd", "md",
]);

function normalizeName(str) {
  if (!str) return "";
  return str
    .trim()
    .replace(/[.'’\-(),]/g, " ")
    .split(/\s+/)
    .filter((t) => {
      if (!t) return false;
      // Strip designation abbreviations written in ALL CAPS (e.g. CFA, APFI,
      // CMFC). Catches designations not in the stopword list so names like
      // "Choppin, CFA, APFI" normalize to "choppin" and match "Choppin".
      if (t.length >= 2 && t === t.toUpperCase() && /[A-Z]/.test(t)) return false;
      const lower = t.toLowerCase();
      if (NAME_STOPWORDS.has(lower)) return false;
      return true;
    })
    .map((t) => t.toLowerCase())
    .join(" ")
    .trim();
}

function normalizeEmail(str) {
  if (!str) return "";
  return str.toLowerCase().trim();
}

function normalizePhone(phone) {
  if (!phone) return "";
  const digits = [
    phone.country_code,
    phone.area_code,
    phone.number_mid,
    phone.number_last,
  ]
    .filter(Boolean)
    .join("")
    .replace(/\D/g, "");
  return digits;
}

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

function nameSimilarity(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / maxLen;
}

function fullName(first, middle, last) {
  return [first, middle, last].filter(Boolean).join(" ").trim();
}

/**
 * Check a new contact against existing contacts for potential duplicates.
 * @param {Object} newContact - { first_name, middle_name, last_name, email, phones }
 * @param {Array} existingContacts - array of Contact entities
 * @returns {Array} potential duplicates with match reasons
 */
export function findContactDuplicates(newContact, existingContacts) {
  if (!existingContacts || existingContacts.length === 0) return [];

  const newName = fullName(newContact.first_name, newContact.middle_name, newContact.last_name);
  const newFirst = normalizeName(newContact.first_name);
  const newLast = normalizeName(newContact.last_name);
  const newEmail = normalizeEmail(newContact.email);
  const newPhones = (newContact.phones || [])
    .map(normalizePhone)
    .filter((p) => p.length >= 7);

  const duplicates = [];

  for (const existing of existingContacts) {
    if (existing.deleted_at) continue;

    const reasons = [];
    let score = 0;

    // Name matching
    const existingName = fullName(existing.first_name, existing.middle_name, existing.last_name);
    const existingFirst = normalizeName(existing.first_name);
    const existingLast = normalizeName(existing.last_name);

    const fullSim = nameSimilarity(newName, existingName);
    const firstSim = nameSimilarity(newContact.first_name, existing.first_name);
    const lastSim = nameSimilarity(newContact.last_name, existing.last_name);

    if (fullSim >= 0.85) {
      reasons.push(`Name is very similar to "${existingName}"`);
      score = Math.max(score, fullSim);
    } else if (firstSim >= 0.8 && lastSim >= 0.8) {
      reasons.push(`First and last name match "${existingName}"`);
      score = Math.max(score, 0.8);
    } else if (newFirst && newLast && newFirst === existingFirst && newLast === existingLast) {
      reasons.push(`Same first and last name as "${existingName}"`);
      score = Math.max(score, 0.75);
    }

    // Photo matching — same photo URL + same first name strongly implies the
    // same person even when last names differ (maiden/married names). Rehosted
    // URLs differ, so we compare the raw stored photo_url strings.
    if (newContact.photo_url && existing.photo_url && newContact.photo_url === existing.photo_url) {
      if (newFirst && newFirst === existingFirst) {
        reasons.push(`Same profile photo and first name as "${existingName}"`);
        score = Math.max(score, 0.8);
      } else {
        reasons.push(`Same profile photo as "${existingName}"`);
        score = Math.max(score, 0.7);
      }
    }

    // Email matching
    if (newEmail && existing.email) {
      const existingEmail = normalizeEmail(existing.email);
      if (newEmail === existingEmail) {
        reasons.push(`Same email: ${newEmail}`);
        score = Math.max(score, 0.9);
      } else if (newEmail.includes(existingEmail) || existingEmail.includes(newEmail)) {
        reasons.push(`Email is very similar to: ${existingEmail}`);
        score = Math.max(score, 0.7);
      }
    }

    // Phone matching
    if (newPhones.length > 0 && existing.phones?.length > 0) {
      for (const ep of existing.phones) {
        const epDigits = normalizePhone(ep);
        if (epDigits.length < 7) continue;
        for (const np of newPhones) {
          if (np === epDigits) {
            reasons.push(`Same phone number`);
            score = Math.max(score, 0.85);
            break;
          }
          // Check if one contains the other (last 7+ digits match)
          if (np.length >= 7 && epDigits.length >= 7) {
            const npTail = np.slice(-7);
            const epTail = epDigits.slice(-7);
            if (npTail === epTail) {
              reasons.push(`Phone number matches existing contact`);
              score = Math.max(score, 0.7);
              break;
            }
          }
        }
      }
    }

    if (reasons.length > 0 && score >= 0.7) {
      duplicates.push({
        contact: existing,
        name: existingName,
        email: existing.email || "",
        reasons,
        score,
      });
    }
  }

  return duplicates.sort((a, b) => b.score - a.score);
}

/**
 * Find contacts with the same normalized first + last name.
 * Stricter than findContactDuplicates — catches cases where suffixes or
 * designations (e.g. "Jr.", "CMFC") are embedded in the last_name field
 * but the core name is identical after normalization. Used as a fallback
 * during enrichment to prevent creating duplicate contact records.
 * @param {Object} newContact - { first_name, last_name }
 * @param {Array} existingContacts - array of Contact entities
 * @returns {Array} matching contacts with their display name
 */
export function findContactsByNormalizedName(newContact, existingContacts) {
  if (!existingContacts || existingContacts.length === 0) return [];
  const newFirst = normalizeName(newContact.first_name);
  const newLast = normalizeName(newContact.last_name);
  if (!newFirst || !newLast) return [];
  return existingContacts
    .filter((c) => {
      if (c.deleted_at) return false;
      const exFirst = normalizeName(c.first_name);
      const exLast = normalizeName(c.last_name);
      return exFirst === newFirst && exLast === newLast;
    })
    .map((c) => ({
      contact: c,
      name: fullName(c.first_name, c.middle_name, c.last_name),
      email: c.email || "",
      title: c.title || "",
    }));
}

/**
 * Build a comparable signature from a contact's meaningful fields.
 * Two contacts with the same signature are considered exact matches
 * (all information is identical, not just the name).
 */
function contactSignature(c) {
  const fields = {
    salutation: c.salutation || "",
    first_name: (c.first_name || "").toLowerCase().trim(),
    middle_name: (c.middle_name || "").toLowerCase().trim(),
    last_name: (c.last_name || "").toLowerCase().trim(),
    suffix: c.suffix || "",
    title: c.title || "",
    designations: [...(c.designations || [])].sort(),
    email: (c.email || "").toLowerCase().trim(),
    linkedin_url: c.linkedin_url || "",
    photo_url: c.photo_url || "",
    employee_status: c.employee_status || "",
    contact_status: c.contact_status || "Active",
    contact_role: c.contact_role || "",
    contact_type: Array.isArray(c.contact_type) ? [...c.contact_type].sort() : (c.contact_type || ""),
    contact_roles: [...(c.contact_roles || [])].sort(),
    contact_firm_roles: [...(c.contact_firm_roles || [])].sort(),
    gender: c.gender || "",
    ethnicity: [...(c.ethnicity || [])].sort(),
    veteran_status: c.veteran_status || "",
    disability_status: c.disability_status || "",
    biography: c.biography || "",
    phones: (c.phones || [])
      .map((p) => [p.country_code || "", p.area_code || "", p.number_mid || "", p.number_last || ""].join(""))
      .sort(),
    addresses: (c.addresses || [])
      .map((a) => [a.country || "", a.state || "", a.city || "", a.postal_code || "", a.address_line1 || "", a.address_line2 || ""].join("|"))
      .sort(),
    education: (c.education || [])
      .map((e) => [e.institution || "", e.degree || "", e.graduation_year || "", e.area_of_specialization || "", ...(e.majors || []).sort(), ...(e.minors || []).sort()].join("|"))
      .sort(),
    professional_experience: (c.professional_experience || [])
      .map((e) => [e.company_name || "", e.title || "", e.start_year || "", e.end_year || ""].join("|"))
      .sort(),
    firm_ids: [...(c.firm_ids || [])].sort(),
    notes: c.notes || "",
  };
  return JSON.stringify(fields);
}

/**
 * Check if two contacts have identical information (all fields match).
 */
export function isExactMatch(a, b) {
  return contactSignature(a) === contactSignature(b);
}

/**
 * Check if all contacts in a group have identical information.
 */
export function isExactMatchGroup(group) {
  if (!group || group.length < 2) return false;
  const sig = contactSignature(group[0]);
  return group.every((c) => contactSignature(c) === sig);
}