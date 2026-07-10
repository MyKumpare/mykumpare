import { base44 } from "@/api/base44Client";

const ENRICHMENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
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
        },
      },
    },
    confidence: { type: "string" },
    sources_found: { type: "string" },
  },
};

export function detectEnrichmentIntent(query) {
  const q = query.toLowerCase();

  const hasEnrichmentKeyword =
    /populate|enrich|fill\s+in|look\s+up\s+(?:online|web)|search\s+(?:the\s+)?web|fetch\s+(?:from|web)|get\s+(?:info|data|details)\s+(?:from|online)|from\s+(?:their\s+)?(?:website|web|public\s+website|public\s+site)/i.test(
      q
    );

  if (!hasEnrichmentKeyword) return { isEnrichment: false };

  const patterns = [
    /populate\s+(.+?)\s+(?:from|with|using)\s+/i,
    /enrich\s+(.+?)(?:\s+(?:from|with|using)\s+|\s*$)/i,
    /(?:look\s+up|search|fetch|get)\s+(.+?)\s+(?:from|on|via|online|web)/i,
    /fill\s+in\s+(.+?)(?:\s+(?:from|with|using)\s+|\s*$)/i,
    /update\s+(.+?)\s+(?:from|with|using|info|information)/i,
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
- Company description (2-3 sentences about what they do, their investment approach, etc.)
- Year the firm was founded
- Office addresses (street address, city, state, postal code, country) — include all locations found
- Phone numbers — for US numbers split into: country_code (e.g. "1"), area_code (3 digits), number_mid (3 digits), number_last (4 digits)
- LinkedIn URL
- General contact email address
- Website URL
- Firm type(s): classify as one or more of "Investment Manager", "Allocator", "Investment Consultant", "Manager of Managers", "Securities Brokerage", "Trade Organizations"
- Firm logo: the full URL of their logo image (must start with http)
- Key personnel/employees: for each key person found on the website (executives, founders, portfolio managers, partners), include first name, last name, job title, email, LinkedIn URL, phone, and a short biography

IMPORTANT:
- Only include information you actually find from reliable public sources
- Do not fabricate or guess information
- Leave fields empty/null if you cannot find them
- For non-US phone numbers, put the full number in country_code and leave other phone sub-fields empty
- For logo_url, only include a full URL starting with http — no relative paths
- For people, only include real individuals found on their website — do not fabricate names
- For person phone numbers, put the full number as a string in the "phone" field`;

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

  if (!data.name) data.name = firmName;
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

  return await base44.entities.Firm.create(firmData);
}