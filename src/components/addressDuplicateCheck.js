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

// Map common country names → ISO 2-letter code so "United States" and "US"
// are treated as the same value when comparing addresses.
const COUNTRY_NAME_TO_CODE = {
  "united states": "US", "usa": "US", "u.s.": "US", "u.s.a.": "US", "america": "US",
  "canada": "CA",
  "united kingdom": "GB", "uk": "GB", "u.k.": "GB", "britain": "GB", "england": "GB",
  "australia": "AU", "germany": "DE", "france": "FR", "japan": "JP",
  "singapore": "SG", "hong kong": "HK", "switzerland": "CH",
  "netherlands": "NL", "holland": "NL", "sweden": "SE", "norway": "NO",
  "denmark": "DK", "finland": "FI", "ireland": "IE", "italy": "IT",
  "spain": "ES", "portugal": "PT", "brazil": "BR", "mexico": "MX",
  "india": "IN", "china": "CN", "south korea": "KR", "korea": "KR",
  "new zealand": "NZ",
};

function normalizeCountryValue(v) {
  const key = norm(v);
  if (!key) return "";
  if (key.length === 2) return key.toUpperCase();
  return COUNTRY_NAME_TO_CODE[key] || key;
}

// Map common US/CA state names → 2-letter code so "New York" and "NY" match.
const STATE_NAME_TO_CODE = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
};

function normalizeStateValue(v) {
  const key = norm(v);
  if (!key) return "";
  if (key.length === 2) return key.toUpperCase();
  return STATE_NAME_TO_CODE[key] || key;
}

// Combined street identity: line1 + line2 joined, so an address stored as
// line1="2605 Meridian Parkway" / line2="Suite 105" matches one stored with
// the whole thing in line1.
function streetOf(a) {
  return normalizeStreet([a.address_line1, a.address_line2].filter(Boolean).join(" "));
}

// Normalize a postal/zip code for comparison: strip the +4 extension on US
// zips (e.g. "19103-1234" → "19103") so the same address isn't treated as
// a duplicate just because one source included the extended zip.
function normalizePostal(v) {
  const n = norm(v);
  if (!n) return "";
  return n.split("-")[0].trim();
}

function addressKey(a) {
  return [
    streetOf(a),
    norm(a.city),
    normalizeStateValue(a.state),
    normalizePostal(a.postal_code),
    normalizeCountryValue(a.country),
  ].join("|");
}

function hasContent(a) {
  return !!(streetOf(a) || norm(a.city) || norm(a.postal_code));
}

// Exact duplicate: all identifying fields match after normalization, OR the
// strongest unique identifiers (street + postal code) match even when a
// lesser field like city is labeled differently (e.g. "Raleigh" vs "Durham"
// for the same 27713 address). A street "contains" relationship (one address
// stores the suite, the other doesn't) at the same postal code + city is
// also exact — it's the same building.
export function addressesAreExact(a1, a2) {
  if (!a1 || !a2) return false;
  if (!hasContent(a1) || !hasContent(a2)) return false;
  if (addressKey(a1) === addressKey(a2)) return true;
  const s1 = streetOf(a1), s2 = streetOf(a2);
  const z1 = normalizePostal(a1.postal_code), z2 = normalizePostal(a2.postal_code);
  const c1 = norm(a1.city), c2 = norm(a2.city);
  // Same postal + same street (exact match)
  if (s1 && s2 && s1 === s2 && z1 && z1 === z2) return true;
  // Same postal + same city + one street contains the other (same building,
  // one just has more detail like a suite number)
  if (z1 && z1 === z2 && c1 && c1 === c2 && s1 && s2 && (s1.includes(s2) || s2.includes(s1))) return true;
  return false;
}

// Similar but not exact: enough overlap to be plausibly the same place
// (e.g. same building, different suite; or same street with slightly
// different postal code).
export function addressesAreSimilar(a1, a2) {
  if (!a1 || !a2) return false;
  if (addressesAreExact(a1, a2)) return false;
  if (!hasContent(a1) || !hasContent(a2)) return false;

  const l1 = streetOf(a1);
  const l2 = streetOf(a2);
  const c1 = norm(a1.city), c2 = norm(a2.city);
  const z1 = normalizePostal(a1.postal_code), z2 = normalizePostal(a2.postal_code);

  // Same postal code + same city → similar
  if (z1 && z2 && z1 === z2 && c1 && c2 && c1 === c2) return true;
  // Same street + same city → similar
  if (l1 && l2 && l1 === l2 && c1 && c2 && c1 === c2) return true;
  // Same street + same postal code → similar
  if (l1 && l2 && l1 === l2 && z1 && z2 && z1 === z2) return true;
  // Same postal code + same state → similar (same zip in same state)
  const st1 = normalizeStateValue(a1.state), st2 = normalizeStateValue(a2.state);
  if (z1 && z2 && z1 === z2 && st1 && st2 && st1 === st2) return true;
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