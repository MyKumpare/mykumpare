import { base44 } from "@/api/base44Client";
import { detectDesignations } from "@/components/contacts/designationDetector";
import { findContactDuplicates } from "@/components/contacts/contactDuplicateCheck";
import { addressesAreExact, addressesAreSimilar } from "@/components/addressDuplicateCheck";
import { compareScalar } from "./enrichmentValidation";

const COUNTRY_NAME_TO_CODE = {
  "united states": "US", "usa": "US", "u.s.": "US", "u.s.a.": "US", "america": "US",
  "canada": "CA",
  "united kingdom": "GB", "uk": "GB", "u.k.": "GB", "britain": "GB", "england": "GB",
  "australia": "AU",
  "germany": "DE",
  "france": "FR",
  "japan": "JP",
  "singapore": "SG",
  "hong kong": "HK",
  "switzerland": "CH",
  "netherlands": "NL", "holland": "NL",
  "sweden": "SE",
  "norway": "NO",
  "denmark": "DK",
  "finland": "FI",
  "ireland": "IE",
  "italy": "IT",
  "spain": "ES",
  "portugal": "PT",
  "brazil": "BR",
  "mexico": "MX",
  "india": "IN",
  "china": "CN",
  "south korea": "KR", "korea": "KR",
  "new zealand": "NZ",
};

function normalizeCountryToCode(raw) {
  if (!raw || typeof raw !== "string") return raw;
  const code = raw.trim().toUpperCase();
  if (code.length === 2 && COUNTRY_NAME_TO_CODE[code.toLowerCase()]) return code;
  const key = raw.trim().toLowerCase();
  if (COUNTRY_NAME_TO_CODE[key]) return COUNTRY_NAME_TO_CODE[key];
  const partial = Object.keys(COUNTRY_NAME_TO_CODE).find((k) => key.includes(k) || k.includes(key));
  return partial ? COUNTRY_NAME_TO_CODE[partial] : raw;
}

function normalizeAddresses(data) {
  if (!data.addresses) return;
  data.addresses = data.addresses.map((a) => (a.country ? { ...a, country: normalizeCountryToCode(a.country) } : a));
}

const ENRICHMENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    alternate_names: {
      type: "array",
      items: { type: "string" },
    },
    logo_url: { type: "string" },
    description: { type: "string" },
    website: { type: "string" },
    email: { type: "string" },
    linkedin_url: { type: "string" },
    year_founded: { type: "integer" },
    firm_types: {
      type: "array",
      items: {
        type: "string",
        enum: ["Investment Manager", "Allocator", "Investment Consultant", "Manager of Managers", "Securities Brokerage", "Trade Organizations"],
      },
    },
    addresses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          is_headquarters: { type: "boolean" },
          country: { type: "string" },
          state: { type: "string" },
          city: { type: "string" },
          postal_code: { type: "string" },
          address_line1: { type: "string" },
          address_line2: { type: "string" },
        },
      },
    },
    phones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phone_type: { type: "string" },
          country_code: { type: "string" },
          area_code: { type: "string" },
          number_mid: { type: "string" },
          number_last: { type: "string" },
        },
      },
    },
    people: {
      type: "array",
      items: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          title: { type: "string" },
          email: { type: "string" },
          linkedin_url: { type: "string" },
          biography: { type: "string" },
          phone: { type: "string" },
          photo_url: { type: "string" },
        },
      },
    },
    confidence: { type: "string" },
    sources_found: { type: "string" },
  },
};

export function parsePhoneString(phoneStr) {
  if (!phoneStr || typeof phoneStr !== "string") return null;
  const digits = phoneStr.replace(/\D/g, "");
  if (!digits) return null;

  // US number: 10 digits, or 11 starting with 1
  if (digits.length === 10) {
    return {
      id: crypto.randomUUID(),
      phone_type: "Work",
      country_code: "1",
      area_code: digits.slice(0, 3),
      number_mid: digits.slice(3, 6),
      number_last: digits.slice(6, 10),
      is_default: true,
    };
  }
  if (digits.length === 11 && digits[0] === "1") {
    return {
      id: crypto.randomUUID(),
      phone_type: "Work",
      country_code: "1",
      area_code: digits.slice(1, 4),
      number_mid: digits.slice(4, 7),
      number_last: digits.slice(7, 11),
      is_default: true,
    };
  }
  // Non-US or unparseable: store full number in country_code per enrichment convention
  return {
    id: crypto.randomUUID(),
    phone_type: "Work",
    country_code: phoneStr.trim(),
    area_code: "",
    number_mid: "",
    number_last: "",
    is_default: true,
  };
}

export function validateFirmData(data) {
  const issues = [];

  if (!data.name || !data.name.trim()) {
    issues.push("Firm name is required");
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    issues.push(`Email "${data.email}" doesn't look like a valid email address`);
  }

  if (data.website && !/^https?:\/\/.+/.test(data.website)) {
    issues.push("Website URL doesn't start with http:// or https://");
  }

  if (data.linkedin_url && !/^https?:\/\/.+/.test(data.linkedin_url)) {
    issues.push("LinkedIn URL doesn't start with http:// or https://");
  }

  if (data.logo_url && !/^https?:\/\/.+/.test(data.logo_url)) {
    issues.push("Logo URL doesn't start with http:// or https://");
  }

  if (data.year_founded) {
    const year = parseInt(data.year_founded);
    const currentYear = new Date().getFullYear();
    if (isNaN(year) || year < 1800 || year > currentYear + 1) {
      issues.push(`Year founded "${data.year_founded}" is not a valid year`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function detectEnrichmentIntent(query) {
  const q = query.toLowerCase();

  const hasEnrichmentKeyword =
    /populate|enrich|fill\s+in|look\s+up\s+(?:online|web)|search\s+(?:the\s+)?web|fetch\s+(?:from|web)|get\s+(?:info|data|details)\s+(?:from|online)|from\s+(?:their\s+)?(?:website|web|public\s+website|public\s+site)|(?:add|create)\s+(?:a\s+)?(?:new\s+)?(?:firm|company|investment\s+manager|allocator|investment\s+consultant|manager\s+of\s+managers|securities\s+brokerage|trade\s+organization)/i.test(
      q
    );

  if (!hasEnrichmentKeyword) return { isEnrichment: false };

  const patterns = [
    /populate\s+(.+?)\s+(?:from|with|using)\s+/i,
    /enrich\s+(.+?)(?:\s+(?:from|with|using)\s+|\s*$)/i,
    /(?:look\s+up|search|fetch|get)\s+(.+?)\s+(?:from|on|via|online|web)/i,
    /fill\s+in\s+(.+?)(?:\s+(?:from|with|using)\s+|\s*$)/i,
    /update\s+(.+?)\s+(?:from|with|using|info|information)/i,
    /(?:add|create)\s+(?:a\s+)?(?:new\s+)?(?:firm|company|investment\s+manager|allocator|investment\s+consultant|manager\s+of\s+managers|securities\s+brokerage|trade\s+organization)\s+(?:called\s+|named\s+)?(.+?)(?:\s+(?:from|with|using)\s+|\s*$)/i,
  ];

  let firmName = null;
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      firmName = match[1].trim();
      break;
    }
  }

  if (!firmName) {
    const stopWords = new Set([
      "populate", "enrich", "fill", "in", "look", "up", "online", "search",
      "the", "web", "fetch", "from", "get", "info", "data", "details",
      "website", "public", "their", "firm", "company", "information",
      "about", "for", "with", "and", "update", "using", "internet", "a", "an", "of",
      "add", "create", "new", "called", "named",
      "investment", "manager", "allocator", "consultant", "brokerage",
      "trade", "organization", "securities",
    ]);
    const words = query.split(/\s+/);
    const properNouns = words
      .filter((w, i) => i > 0 && /^[A-Z]/.test(w) && !stopWords.has(w.toLowerCase().replace(/[^a-z]/g, "")))
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""));
    if (properNouns.length > 0) firmName = properNouns.join(" ");
  }

  if (firmName) {
    firmName = firmName.replace(/\s+(firm|company|data|info|information|details)$/i, "").trim();
    firmName = firmName.replace(/['"]/g, "").trim();
  }

  return { isEnrichment: !!firmName, firmName };
}

export async function findFirmByName(firmName) {
  try {
    const allFirms = await base44.entities.Firm.list(null, 500);
    const activeFirms = allFirms.filter((f) => !f.deleted_at);
    const q = firmName.toLowerCase();

    let match = activeFirms.find((f) => f.name.toLowerCase() === q);
    if (match) return match;

    match = activeFirms.find((f) => f.name.toLowerCase().includes(q) || q.includes(f.name.toLowerCase()));
    if (match) return match;

    const cleanQ = q.replace(/[,.\-&'"]/g, "").trim();
    match = activeFirms.find((f) => f.name.toLowerCase().replace(/[,.\-&'"]/g, "").includes(cleanQ));

    return match || null;
  } catch {
    return null;
  }
}

export async function enrichFirmFromWeb(firmName, websiteUrl) {
  // Use the backend function that fetches the website directly and extracts data.
  // This is more reliable than relying on LLM web search alone, which often returns
  // empty results for smaller firms.
  const response = await base44.functions.invoke('enrichFirmFromWebsite', {
    firm_name: firmName,
    website_url: websiteUrl || '',
  });

  let data;
  if (response.data && typeof response.data === 'object') {
    data = response.data;
  } else if (typeof response.data === 'string') {
    try { data = JSON.parse(response.data); } catch { data = { name: firmName }; }
  } else {
    data = response;
  }

  // If the backend returned an error, throw it so the UI can display it
  if (data.error) throw new Error(data.error);

  // Safety net: clean up string "null" values the LLM sometimes returns
  const cleanStr = (v) => (v === 'null' || v === 'undefined' ? '' : v);
  data.logo_url = cleanStr(data.logo_url) || '';
  data.email = cleanStr(data.email) || '';
  data.linkedin_url = cleanStr(data.linkedin_url) || '';
  data.website = cleanStr(data.website) || '';
  data.description = cleanStr(data.description) || '';
  for (const person of data.people || []) {
    person.photo_url = cleanStr(person.photo_url) || '';
    person.email = cleanStr(person.email) || '';
    person.linkedin_url = cleanStr(person.linkedin_url) || '';
    person.biography = cleanStr(person.biography) || '';
  }

  normalizeAddresses(data);
  if (!data.name) data.name = firmName;

  return data;
}

export function mergeEnrichmentData(existingFirm, enrichedData) {
  const updates = {};
  const updatedFields = [];
  const conflicts = [];

  const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
  const normText = (s) => (s == null ? "" : String(s).toLowerCase().replace(/\s+/g, " ").trim());

  // Scalar firm fields: empty → auto-fill (append-only); already populated and
  // the web returned a different value → surface as a conflict the user must
  // opt into (never silently overwrite existing data).
  const SCALAR_FIELDS = [
    { field: "logo_url", label: "Logo" },
    { field: "description", label: "Description" },
    { field: "website", label: "Website" },
    { field: "email", label: "Email" },
    { field: "linkedin_url", label: "LinkedIn" },
    { field: "year_founded", label: "Year Founded" },
    { field: "firm_types", label: "Firm Types" },
  ];

  for (const { field, label } of SCALAR_FIELDS) {
    const incoming = enrichedData[field];
    if (isEmpty(incoming)) continue;
    const existingVal = existingFirm[field];

    if (isEmpty(existingVal)) {
      updates[field] = incoming;
      updatedFields.push(label);
      continue;
    }

    // Field already populated — only alert if the incoming value actually differs.
    let same;
    if (field === "logo_url") {
      // Logo URLs are re-hosted each scrape, so a different URL doesn't prove a
      // different image. We can't verify equality, so surface every time as a
      // "replace" the user can accept or ignore.
      same = false;
    } else if (field === "description") {
      same = normText(existingVal) === normText(incoming);
    } else {
      same = compareScalar(field, existingVal, incoming).status === "exact";
    }

    if (!same) {
      // firm_types is additive (union), every other field is a straight overwrite.
      conflicts.push({
        field,
        label,
        existing: existingVal,
        incoming,
        additive: field === "firm_types",
      });
    }
  }

  // Addresses: block exact duplicates, flag similar ones for explicit user
  // confirmation, and only auto-apply genuinely new addresses. This mirrors
  // the manual-entry and enrichment-panel behavior so the AI tool can't slip
  // a duplicate (or a near-duplicate) past the user.
  const existingAddresses = existingFirm.addresses || [];
  const candidateAddresses = (enrichedData.addresses || []).filter((a) => a.address_line1 || a.city);
  const similarAddresses = [];
  const uniqueNewAddrs = candidateAddresses.filter((a) => {
    if (existingAddresses.some((ex) => addressesAreExact(a, ex))) return false; // blocked
    const similarMatch = existingAddresses.find((ex) => addressesAreSimilar(a, ex));
    if (similarMatch) {
      similarAddresses.push({ incoming: a, existing: similarMatch });
      return false; // held back for explicit confirmation
    }
    return true;
  });
  if (uniqueNewAddrs.length > 0) {
    if (existingAddresses.length === 0 && uniqueNewAddrs[0]) uniqueNewAddrs[0].is_headquarters = true;
    updates.addresses = [...existingAddresses, ...uniqueNewAddrs.map((a) => ({ ...a, id: crypto.randomUUID() }))];
    updatedFields.push(`${uniqueNewAddrs.length} Address(es)`);
  }
  if (similarAddresses.length > 0) {
    updatedFields.push(`${similarAddresses.length} Similar Address(es) — needs confirmation`);
  }

  // Phones: add only new (non-duplicate) phones, keeping existing ones
  const existingPhones = existingFirm.phones || [];
  const candidatePhones = (enrichedData.phones || []).filter((p) => p.area_code || p.number_last || p.country_code);
  const existingPhoneKeys = new Set(existingPhones.map((p) => `${p.country_code || ""}${p.area_code || ""}${p.number_mid || ""}${p.number_last || ""}`));
  const uniqueNewPhones = candidatePhones.filter((p) => {
    const key = `${p.country_code || ""}${p.area_code || ""}${p.number_mid || ""}${p.number_last || ""}`;
    return key && !existingPhoneKeys.has(key);
  });
  if (uniqueNewPhones.length > 0) {
    if (existingPhones.length === 0 && uniqueNewPhones[0]) uniqueNewPhones[0].is_default = true;
    updates.phones = [...existingPhones, ...uniqueNewPhones.map((p) => ({ ...p, id: crypto.randomUUID() }))];
    updatedFields.push(`${uniqueNewPhones.length} Phone(s)`);
  }

  return { updates, updatedFields, similarAddresses, conflicts };
}

/**
 * Compute field-level updates for an existing contact based on enriched person data.
 * Empty fields are auto-filled. Fields that already have different data are surfaced
 * as conflicts for explicit user approval.
 */
export function computeContactUpdates(existingContact, person, firmId) {
  const updates = {};
  const updatedFields = [];
  const conflicts = [];
  const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

  // Photo: auto-update if empty; flag as conflict if different
  if (person.photo_url) {
    if (!existingContact.photo_url) {
      updates.photo_url = person.photo_url;
      updatedFields.push("Photo");
    } else if (person.photo_url !== existingContact.photo_url) {
      conflicts.push({ field: "photo_url", label: "Photo", existing: existingContact.photo_url, incoming: person.photo_url });
    }
  }

  // Scalar text fields: fill if empty, flag conflict if differs
  const SCALAR = [
    { field: "title", label: "Title" },
    { field: "email", label: "Email" },
    { field: "linkedin_url", label: "LinkedIn" },
  ];
  for (const { field, label } of SCALAR) {
    const incoming = person[field];
    if (!incoming) continue;
    const existing = existingContact[field];
    if (!existing) {
      updates[field] = incoming;
      updatedFields.push(label);
    } else if (norm(existing) !== norm(incoming)) {
      conflicts.push({ field, label, existing, incoming });
    }
  }

  // Biography: fill if empty (or just a name-stub); flag conflict only when a
  // real existing bio differs. The Phase 1 extraction sometimes stores a
  // person's name as their "biography" when the listing page had no bio —
  // that stub is not a real biography and should be auto-replaced.
  const isStubBio = (bio) => {
    const b = (bio || "").trim();
    if (!b) return true;
    if (b.length < 60) {
      const first = (existingContact.first_name || "").trim().toLowerCase();
      if (first && b.toLowerCase().startsWith(first)) return true;
    }
    return false;
  };
  if (person.biography) {
    if (isStubBio(existingContact.biography)) {
      updates.biography = person.biography;
      updatedFields.push("Biography");
    } else if (norm(existingContact.biography) !== norm(person.biography)) {
      conflicts.push({ field: "biography", label: "Biography", existing: existingContact.biography, incoming: person.biography });
    }
  }

  // Designations: merge new ones (additive, no conflict needed)
  const existingDesignations = existingContact.designations || [];
  const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
  const personDesignations = detectDesignations(fullName, person.biography);
  const existingLower = new Set(existingDesignations.map((d) => d.toLowerCase()));
  const newDesignations = personDesignations.filter((d) => !existingLower.has(d.toLowerCase()));
  if (newDesignations.length > 0) {
    updates.designations = [...existingDesignations, ...newDesignations];
    updatedFields.push("Designations");
  }

  // Phones: add new ones not already present (additive)
  const existingPhones = existingContact.phones || [];
  const existingPhoneKeys = new Set(
    existingPhones.map((p) => `${p.country_code || ""}${p.area_code || ""}${p.number_mid || ""}${p.number_last || ""}`)
  );
  const parsedPhone = person.phone ? parsePhoneString(person.phone) : null;
  if (parsedPhone) {
    const key = `${parsedPhone.country_code || ""}${parsedPhone.area_code || ""}${parsedPhone.number_mid || ""}${parsedPhone.number_last || ""}`;
    if (key && !existingPhoneKeys.has(key)) {
      updates.phones = [...existingPhones, parsedPhone];
      updatedFields.push("Phone");
    }
  }

  // Firm association: ensure the contact is linked to this firm (additive)
  if (firmId) {
    const existingFirmIds = existingContact.firm_ids || [];
    if (!existingFirmIds.includes(firmId)) {
      updates.firm_ids = [...existingFirmIds, firmId];
      updatedFields.push("Firm Association");
    }
  }

  return { updates, updatedFields, conflicts };
}

/**
 * Match enriched people against existing contacts.
 * For matches: compute field-level updates (fills only empty fields).
 * For non-matches: return as newPeople to be created.
 */
export function mergeContactEnrichment(people, existingContacts, firmId) {
  const contactUpdates = [];
  const newPeople = [];
  const allUpdatedFields = [];

  for (const person of (people || [])) {
    if (!person.first_name && !person.last_name) continue;

    const contactData = {
      first_name: person.first_name || "",
      last_name: person.last_name || "",
      email: person.email || "",
    };

    const dups = findContactDuplicates(contactData, existingContacts);

    if (dups.length > 0) {
      const bestMatch = dups[0].contact;
      const { updates, updatedFields, conflicts } = computeContactUpdates(bestMatch, person, firmId);
      if (Object.keys(updates).length > 0 || conflicts.length > 0) {
        const contactName = `${bestMatch.first_name || ""} ${bestMatch.last_name || ""}`.trim();
        contactUpdates.push({ id: bestMatch.id, updates, updatedFields, conflicts, contactName });
        const conflictLabels = conflicts.map((c) => `${c.label} (review)`);
        allUpdatedFields.push(`${contactName}: ${[...updatedFields, ...conflictLabels].join(", ")}`);
      }
    } else {
      newPeople.push(person);
    }
  }

  return { contactUpdates, newPeople, allUpdatedFields };
}

export function enrichmentToTable(enrichedData, updatedFields) {
  const headers = ["Field", "Value"];
  const rows = [];

  rows.push(["Name", String(enrichedData.name || "")]);

  if (enrichedData.logo_url) {
    rows.push(["Logo URL", enrichedData.logo_url.length > 80 ? enrichedData.logo_url.substring(0, 80) + "..." : enrichedData.logo_url]);
  }

  const desc = enrichedData.description || "";
  rows.push(["Description", desc.length > 100 ? desc.substring(0, 100) + "..." : desc]);

  rows.push(["Website", String(enrichedData.website || "")]);
  rows.push(["Email", String(enrichedData.email || "")]);
  rows.push(["LinkedIn", String(enrichedData.linkedin_url || "")]);
  rows.push(["Year Founded", enrichedData.year_founded ? String(enrichedData.year_founded) : ""]);
  rows.push(["Firm Types", (enrichedData.firm_types || []).join(", ")]);

  if (enrichedData.addresses?.length > 0) {
    const addr = enrichedData.addresses[0];
    const parts = [addr.address_line1, addr.address_line2, addr.city, addr.state, addr.postal_code, addr.country].filter(Boolean);
    rows.push(["Address", parts.join(", ")]);
    if (enrichedData.addresses.length > 1) {
      rows.push(["Additional Locations", String(enrichedData.addresses.length - 1) + " more"]);
    }
  }

  if (enrichedData.phones?.length > 0) {
    const p = enrichedData.phones[0];
    const phoneStr =
      p.area_code && p.number_mid && p.number_last
        ? `+${p.country_code || "1"} (${p.area_code}) ${p.number_mid}-${p.number_last}`
        : p.country_code || "";
    rows.push(["Phone", phoneStr]);
  }

  if (enrichedData.people?.length > 0) {
    rows.push(["Key Personnel", enrichedData.people.map(p => `${p.first_name || ""} ${p.last_name || ""}`.trim() + (p.title ? ` (${p.title})` : "")).join("; ")]);
  }

  if (updatedFields && updatedFields.length > 0) {
    rows.push(["✅ Updated", updatedFields.join(", ")]);
  }

  return { title: "Firm Data from Web", headers, rows };
}

export async function createFirmFromEnrichment(enrichedData) {
  const firmData = {
    name: enrichedData.name,
    description: enrichedData.description || "",
    website: enrichedData.website || "",
    email: enrichedData.email || "",
    linkedin_url: enrichedData.linkedin_url || "",
    logo_url: enrichedData.logo_url || "",
  };

  if (enrichedData.year_founded) firmData.year_founded = enrichedData.year_founded;
  if (enrichedData.firm_types?.length > 0) firmData.firm_types = enrichedData.firm_types;

  const addresses = (enrichedData.addresses || []).filter((a) => a.address_line1 || a.city);
  if (addresses.length > 0) firmData.addresses = addresses.map((a) => ({ ...a, id: crypto.randomUUID() }));

  const phones = (enrichedData.phones || []).filter((p) => p.area_code || p.number_last || p.country_code);
  if (phones.length > 0) firmData.phones = phones.map((p) => ({ ...p, id: crypto.randomUUID() }));

  const createdFirm = await base44.entities.Firm.create(firmData);

  // Create contacts from enrichment people data — but never create a duplicate of
  // a contact that already exists. Match against the full contact list; for any
  // match, link this firm to the existing contact instead of creating a new one.
  const people = (enrichedData.people || []).filter((p) => p.first_name || p.last_name);
  let existingContacts = [];
  try {
    existingContacts = await base44.entities.Contact.list(null, 500);
  } catch {}

  for (const person of people) {
    try {
      const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
      const designations = detectDesignations(fullName, person.biography);
      const probeData = {
        first_name: person.first_name || "",
        last_name: person.last_name || "",
        email: person.email || "",
        phones: person.phone ? [parsePhoneString(person.phone)] : [],
      };
      const dups = findContactDuplicates(probeData, existingContacts);
      if (dups.length > 0) {
        const best = dups[0].contact;
        const existingFirmIds = best.firm_ids || [];
        if (!existingFirmIds.includes(createdFirm.id)) {
          await base44.entities.Contact.update(best.id, { firm_ids: [...existingFirmIds, createdFirm.id] });
        }
        continue;
      }

      const contactData = {
        first_name: person.first_name || "",
        last_name: person.last_name || "",
        title: person.title || "",
        email: person.email || "",
        linkedin_url: person.linkedin_url || "",
        biography: person.biography || "",
        photo_url: person.photo_url || "",
        firm_ids: [createdFirm.id],
      };
      if (designations.length > 0) contactData.designations = designations;
      const parsedPhone = person.phone ? parsePhoneString(person.phone) : null;
      if (parsedPhone) contactData.phones = [parsedPhone];
      const created = await base44.entities.Contact.create(contactData);
      existingContacts.push(created);
    } catch {}
  }

  return createdFirm;
}