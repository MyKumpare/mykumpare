import { base44 } from "@/api/base44Client";
import { detectDesignations } from "@/components/contacts/designationDetector";

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
  const prompt = `Search the web for information about the investment firm "${firmName}".
${websiteUrl ? `Their official website is ${websiteUrl}. Focus on extracting data from this website.` : "Find their official website and extract data from it."}

Extract the following information from their public website and any related public sources:
- Official firm name: the exact name as it appears publicly. If it differs from "${firmName}", set alternate_names to a list of similar official name variations you found on the web (e.g. "Acme Capital Partners", "Acme Capital Management LLC", "Acme Capital, LLC"). Include 2-5 variations if the exact name "${firmName}" does not match. Leave alternate_names empty if "${firmName}" matches exactly.
- Company description (2-3 sentences about what they do, their investment approach, etc.)
- Year the firm was founded
- Office addresses (street address, city, state, postal code, country) — include all locations found
- Phone numbers — for US numbers split into: country_code (e.g. "1"), area_code (3 digits), number_mid (3 digits), number_last (4 digits)
- LinkedIn URL
- General contact email address
- Website URL
- Firm type(s): classify as one or more of "Investment Manager", "Allocator", "Investment Consultant", "Manager of Managers", "Securities Brokerage", "Trade Organizations"
- Firm logo: the full URL of their logo image (must start with http)
- Key personnel/employees: for each key person found on the website (executives, founders, portfolio managers, partners), include first name, last name, job title, email, LinkedIn URL, phone, their full complete biography (copy the entire biography text exactly as it appears on their website bio page — do NOT summarize, truncate, or shorten it), and photo_url (the full URL of their headshot/profile photo from the firm website — must start with http)

IMPORTANT:
- Only include information you actually find from reliable public sources
- Do not fabricate or guess information
- Leave fields empty/null if you cannot find them
- For non-US phone numbers, put the full number in country_code and leave other phone sub-fields empty
- For logo_url, only include a full URL starting with http — no relative paths
- For alternate_names, only include real firm name variations found on public sources — do not fabricate. Only populate if "${firmName}" does not exactly match the publicly available official name.
- For people, only include real individuals found on their website — do not fabricate names
- For person phone numbers, put the full number as a string in the "phone" field
- For photo_url of people, extract the full absolute image URL (starting with http:// or https://) of their headshot/profile photo from their bio page on the firm website. Do NOT use relative paths — if the image src is relative, construct the full URL using the website's base URL. Leave empty only if absolutely no photo is found.
- For biography of people, you MUST copy the COMPLETE biography text from their website profile page. Do NOT summarize, shorten, or truncate — include every paragraph exactly as written on the website.`;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt,
    add_context_from_internet: true,
    model: "gemini_3_flash",
    response_json_schema: ENRICHMENT_SCHEMA,
  });

  let data;
  if (typeof response === "string") {
    try {
      data = JSON.parse(response);
    } catch {
      data = { name: firmName, description: response };
    }
  } else if (typeof response === "object" && response !== null) {
    data = response.data && typeof response.data === "object" ? response.data : response;
  } else {
    data = {};
  }

  normalizeAddresses(data);
  if (!data.name) data.name = firmName;

  // Rehost all image URLs (logo + people photos) to Base44 storage
  // so they persist and aren't subject to hotlink protection or relative URL issues
  try {
    const imageUrls = [];
    const urlMap = {};

    if (data.logo_url && /^https?:\/\/.+/.test(data.logo_url)) {
      imageUrls.push(data.logo_url);
    } else if (data.logo_url) {
      imageUrls.push(data.logo_url);
    }

    for (const person of data.people || []) {
      if (person.photo_url) {
        imageUrls.push(person.photo_url);
      }
    }

    if (imageUrls.length > 0) {
      const response = await base44.functions.invoke('rehostImages', {
        image_urls: imageUrls,
        website: websiteUrl || data.website || '',
      });
      const results = response.data?.results || [];
      for (const r of results) {
        if (r.rehosted) urlMap[r.original] = r.rehosted;
      }

      if (data.logo_url && urlMap[data.logo_url]) {
        data.logo_url = urlMap[data.logo_url];
      }
      for (const person of data.people || []) {
        if (person.photo_url && urlMap[person.photo_url]) {
          person.photo_url = urlMap[person.photo_url];
        }
      }
    }
  } catch {
    // If rehosting fails, keep original URLs
  }

  return data;
}

export function mergeEnrichmentData(existingFirm, enrichedData) {
  const updates = {};
  const updatedFields = [];

  if (!existingFirm.logo_url && enrichedData.logo_url) {
    updates.logo_url = enrichedData.logo_url;
    updatedFields.push("Logo");
  }
  if (!existingFirm.description && enrichedData.description) {
    updates.description = enrichedData.description;
    updatedFields.push("Description");
  }
  if (!existingFirm.website && enrichedData.website) {
    updates.website = enrichedData.website;
    updatedFields.push("Website");
  }
  if (!existingFirm.email && enrichedData.email) {
    updates.email = enrichedData.email;
    updatedFields.push("Email");
  }
  if (!existingFirm.linkedin_url && enrichedData.linkedin_url) {
    updates.linkedin_url = enrichedData.linkedin_url;
    updatedFields.push("LinkedIn");
  }
  if (!existingFirm.year_founded && enrichedData.year_founded) {
    updates.year_founded = enrichedData.year_founded;
    updatedFields.push("Year Founded");
  }

  const existingTypes = existingFirm.firm_types || [];
  if (existingTypes.length === 0 && enrichedData.firm_types?.length > 0) {
    updates.firm_types = enrichedData.firm_types;
    updatedFields.push("Firm Types");
  }

  const existingAddresses = existingFirm.addresses || [];
  const newAddresses = (enrichedData.addresses || []).filter((a) => a.address_line1 || a.city);
  if (existingAddresses.length === 0 && newAddresses.length > 0) {
    updates.addresses = newAddresses.map((a) => ({ ...a, id: crypto.randomUUID() }));
    updatedFields.push("Addresses");
  }

  const existingPhones = existingFirm.phones || [];
  const newPhones = (enrichedData.phones || []).filter((p) => p.area_code || p.number_last || p.country_code);
  if (existingPhones.length === 0 && newPhones.length > 0) {
    updates.phones = newPhones.map((p) => ({ ...p, id: crypto.randomUUID() }));
    updatedFields.push("Phones");
  }

  return { updates, updatedFields };
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

  // Create contacts from enrichment people data
  const people = (enrichedData.people || []).filter((p) => p.first_name || p.last_name);
  for (const person of people) {
    try {
      const fullName = `${person.first_name || ""} ${person.last_name || ""}`.trim();
      const designations = detectDesignations(fullName, person.biography);
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
      await base44.entities.Contact.create(contactData);
    } catch {}
  }

  return createdFirm;
}