// Address duplicate / similarity detection for manual address entry.
// Used to block exact duplicate addresses and prompt for confirmation on
// similar (but not identical) addresses before they are saved.

function norm(s) {
  return (s == null ? "" : String(s)).trim().toLowerCase().replace(/\s+/g, " ");
}

// Normalize a street address line: lowercase, collapse spaces, strip common
// punctuation and unify common abbreviations so "123 Main St." matches
// "123 main st".
function normalizeStreet(s) {
  if (!s) return "";
  let v = norm(s).replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
  const repl = [
    [/street/g, "st"], [/avenue/g, "ave"], [/boulevard/g, "blvd"],
    [/road/g, "rd"], [/drive/g, "dr"], [/lane/g, "ln"], [/court/g, "ct"],
    [/suite/g, "ste"], [/floor/g, "fl"], [/apartment/g, "apt"],
  ];
  for (const [re, r] of repl) v = v.replace(re, r);
  return v.replace(/\s+/g, " ").trim();
}

function addressKey(a) {
  return [
    normalizeStreet(a.address_line1),
    norm(a.city),
    norm(a.state),
    norm(a.postal_code),
    norm(a.country),
  ].join("|");
}

function hasContent(a) {
  return !!(normalizeStreet(a.address_line1) || norm(a.city) || norm(a.postal_code));
}

// Exact duplicate: all identifying fields match after normalization.
export function addressesAreExact(a1, a2) {
  if (!a1 || !a2) return false;
  if (!hasContent(a1) || !hasContent(a2)) return false;
  return addressKey(a1) === addressKey(a2);
}

// Similar but not exact: enough overlap to be plausibly the same place
// (e.g. same building, different suite; or same street with slightly
// different postal code).
export function addressesAreSimilar(a1, a2) {
  if (!a1 || !a2) return false;
  if (addressesAreExact(a1, a2)) return false;
  if (!hasContent(a1) || !hasContent(a2)) return false;

  const l1 = normalizeStreet(a1.address_line1);
  const l2 = normalizeStreet(a2.address_line1);
  const c1 = norm(a1.city), c2 = norm(a2.city);
  const z1 = norm(a1.postal_code), z2 = norm(a2.postal_code);

  // Same postal code + same city → similar
  if (z1 && z2 && z1 === z2 && c1 && c2 && c1 === c2) return true;
  // Same street + same city → similar
  if (l1 && l2 && l1 === l2 && c1 && c2 && c1 === c2) return true;
  // Same street + same postal code → similar
  if (l1 && l2 && l1 === l2 && z1 && z2 && z1 === z2) return true;
  // Fuzzy street match (one contains the other) + same city
  if (l1 && l2 && c1 && c2 && c1 === c2) {
    if (l1.includes(l2) || l2.includes(l1)) return true;
  }
  return false;
}

// Scan a list of addresses for problematic pairs.
// Returns { exactPairs: [[i,j]...], similarPairs: [[i,j]...] }
export function findAddressIssues(addresses) {
  const exactPairs = [];
  const similarPairs = [];
  const list = addresses || [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (!hasContent(list[i]) || !hasContent(list[j])) continue;
      if (addressesAreExact(list[i], list[j])) {
        exactPairs.push([i, j]);
      } else if (addressesAreSimilar(list[i], list[j])) {
        similarPairs.push([i, j]);
      }
    }
  }
  return { exactPairs, similarPairs };
}

// Human-readable single-line address for display.
export function formatAddress(a) {
  if (!a) return "";
  return [a.address_line1, a.address_line2, a.city, a.state, a.postal_code, a.country]
    .filter(Boolean)
    .join(", ");
}