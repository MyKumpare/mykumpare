// Minimal vCard (.vcf) parser — reads a vCard file's text content and maps it
// to the same structured shape the PasteContactDialog uses for its review step.
// No LLM needed: vCard is already structured data, so we parse it directly.
//
// Handles vCard 2.1/3.0/4.0 line folding, property parameters, and the common
// contact properties (N, FN, ORG, TITLE, EMAIL, TEL, URL, ADR). Takes the first
// VCARD block if the file contains multiple contacts.

const DESIGNATION_SET = new Set([
  "CFA", "CPA", "MBA", "PHD", "MD", "CAIA", "FRM", "JD", "CMT", "CMTA",
  "CFP", "CIMA", "AIF", "AIFA", "CSA", "RICP", "CLU", "CHFC", "CIC", "ESQ",
]);

// Extract professional designations from a formatted name string by comparing
// it against the N-field name parts. Anything in FN that isn't the name itself
// is treated as a designation (e.g. "John Smith, CFA" → ["CFA"]).
function extractDesignationsFromFn(fn, nameParts) {
  if (!fn) return [];
  const nameWords = new Set(
    nameParts.filter(Boolean).join(" ").toLowerCase().split(/\s+/).filter(Boolean)
  );
  // Strip the name portion from FN, then look for comma-separated credentials
  const remaining = fn
    .replace(new RegExp(nameParts.filter(Boolean).join(" ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "")
    .trim()
    .replace(/^,/, "")
    .trim();
  if (!remaining) return [];
  return remaining
    .split(/[,\s]+/)
    .map((s) => s.replace(/\.$/, "").trim().toUpperCase())
    .filter((s) => s && DESIGNATION_SET.has(s));
}

export function parseVCardText(text) {
  // Unfold continuation lines (a line starting with space/tab continues the previous)
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r\n|\r|\n/);

  // Collect properties from the first VCARD block
  let inCard = false;
  const props = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toUpperCase() === "BEGIN:VCARD") { inCard = true; continue; }
    if (line.toUpperCase() === "END:VCARD") { if (inCard) break; continue; }
    if (!inCard) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const namePart = line.substring(0, colonIdx);
    const value = line.substring(colonIdx + 1);
    const propName = namePart.split(";")[0].toUpperCase();
    props.push({ name: propName, value, raw: namePart });
  }

  const get = (name) => {
    const found = props.find((p) => p.name === name);
    return found ? found.value : "";
  };
  const getAll = (name) => props.filter((p) => p.name === name);

  // N: family;given;additional( middle);prefix( salutation);suffix
  const nParts = get("N").split(";").map((s) => s.trim().replace(/^"|"$/g, ""));
  const fn = get("FN");
  const nameParts = [nParts[0], nParts[1], nParts[2], nParts[3], nParts[4]];

  // If N is empty, try to parse from FN (split words, last word = last name)
  let last_name = nParts[0] || "";
  let first_name = nParts[1] || "";
  let middle_name = nParts[2] || "";
  let salutation = nParts[3] || "";
  let suffix = nParts[4] || "";

  if (!first_name && !last_name && fn) {
    // Strip trailing designations from FN before splitting
    const cleanFn = fn.replace(/,?\s*(CFA|CPA|MBA|PhD|MD|CAIA|FRM|JD|Esq\.?)\b/gi, "").trim();
    const parts = cleanFn.split(/\s+/);
    first_name = parts[0] || "";
    last_name = parts.length > 1 ? parts[parts.length - 1] : "";
    if (parts.length > 2) middle_name = parts.slice(1, -1).join(" ");
  }

  // Designations: prefer explicit suffix from N field, plus any extracted from FN
  const designationList = extractDesignationsFromFn(fn, [salutation, first_name, middle_name, last_name, suffix]);
  if (suffix && !designationList.includes(suffix.toUpperCase())) designationList.unshift(suffix.toUpperCase());

  // ORG: firm name (first segment); subsequent segments are departments
  const orgRaw = get("ORG");
  const firm_name = orgRaw.split(";")[0].trim().replace(/^"|"$/g, "");

  // TITLE
  const title = get("TITLE");

  // EMAIL — prefer the one marked TYPE=PREF, else first
  const emailProps = getAll("EMAIL");
  const email = (emailProps.find((p) => p.raw.toUpperCase().includes("PREF")) || emailProps[0])?.value || "";

  // TEL — prefer TYPE=PREF, else first
  const telProps = getAll("TEL");
  const phone = (telProps.find((p) => p.raw.toUpperCase().includes("PREF")) || telProps[0])?.value || "";

  // URL — LinkedIn vs general website
  const urlProps = getAll("URL");
  let linkedin_url = "";
  let website = "";
  for (const u of urlProps) {
    const val = u.value;
    if (val.toLowerCase().includes("linkedin")) linkedin_url = val;
    else if (!website) website = val;
  }

  // ADR: post_office_box;extended_address;street;locality;region;postal_code;country
  const adrParts = get("ADR").split(";").map((s) => s.trim().replace(/^"|"$/g, ""));
  const address = {
    address_line1: adrParts[2] || "",
    address_line2: adrParts[1] || "",
    city: adrParts[3] || "",
    state: adrParts[4] || "",
    postal_code: adrParts[5] || "",
    country: adrParts[6] || "",
  };

  return {
    salutation,
    first_name,
    middle_name,
    last_name,
    suffix,
    title,
    designations: designationList,
    email,
    phone,
    linkedin_url,
    firm_name,
    website,
    address,
  };
}