/**
 * Duplicate contact detection with fuzzy matching.
 * Detects name variations (nicknames, missing middle names, swapped fields),
 * email similarity, and phone number overlap.
 */

function normalizeName(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[.'’-]/g, "")
    .replace(/\s+/g, " ");
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