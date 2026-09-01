// Generates a vCard 3.0 (.vcf) file from contact data and triggers a download.

function escapeVCard(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatPhone(p) {
  const parts = [p.country_code ? `+${p.country_code}` : "", p.area_code, p.number_mid, p.number_last]
    .filter(Boolean);
  return parts.join("-");
}

function buildAddress(a) {
  // vCard ADR: post-office-box;extended-address;street;locality;region;postal-code;country
  return [
    escapeVCard(""), // PO box
    escapeVCard(a.address_line2), // extended
    escapeVCard(a.address_line1), // street
    escapeVCard(a.city), // locality
    escapeVCard(a.state), // region
    escapeVCard(a.postal_code), // postal code
    escapeVCard(a.country), // country
  ].join(";");
}

export function generateVCard(contact, firms = [], fieldOrder = null) {
  const {
    salutation, first_name, middle_name, last_name, suffix,
    title, email, linkedin_url, notes, phones = [], addresses = [],
    firm_ids = [],
  } = contact;

  const firmNames = firm_ids
    .map((id) => firms.find((f) => f.id === id)?.name)
    .filter(Boolean);

  const headerLines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCard(last_name)};${escapeVCard(first_name)};${escapeVCard(middle_name)};${escapeVCard(suffix)};${escapeVCard(salutation)}`,
    `FN:${escapeVCard([salutation, first_name, middle_name, last_name].filter(Boolean).join(" "))}`,
  ];

  // Build property blocks keyed by field id
  const propertyBlocks = {};
  if (title) {
    propertyBlocks.title = [`TITLE:${escapeVCard(title)}`];
  }
  if (firmNames.length > 0) {
    propertyBlocks.company = [`ORG:${escapeVCard(firmNames.join("; "))}`];
  }
  if (email) {
    propertyBlocks.email = [`EMAIL;TYPE=INTERNET:${escapeVCard(email)}`];
  }
  if (phones.length > 0) {
    propertyBlocks.phone = phones.map((p) => {
      const num = formatPhone(p);
      if (!num) return null;
      const type = (p.phone_type || "WORK").toUpperCase();
      return `TEL;TYPE=${type},VOICE:${escapeVCard(num)}`;
    }).filter(Boolean);
  }
  if (addresses.length > 0) {
    propertyBlocks.address = addresses.map((a) => {
      if (!a.address_line1 && !a.city && !a.state) return null;
      const type = a.is_primary ? "WORK,HOME" : "WORK";
      const adrLines = [`ADR;TYPE=${type}:${buildAddress(a)}`];
      const label = [a.address_line1, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ");
      if (label) adrLines.push(`LABEL;TYPE=${type}:${escapeVCard(label)}`);
      return adrLines;
    }).filter(Boolean).flat();
  }
  if (linkedin_url) {
    propertyBlocks.website = [`URL:${escapeVCard(linkedin_url)}`];
  }
  if (notes) {
    propertyBlocks.notes = [`NOTE:${escapeVCard(notes)}`];
  }

  // Default order if none provided
  const defaultOrder = ["title", "company", "email", "phone", "address", "website", "notes"];
  const order = fieldOrder || defaultOrder;

  const bodyLines = [];
  order.forEach((fieldId) => {
    if (propertyBlocks[fieldId]) {
      bodyLines.push(...propertyBlocks[fieldId]);
    }
  });
  // Append any property blocks not in the order array (safety)
  defaultOrder.forEach((fieldId) => {
    if (!order.includes(fieldId) && propertyBlocks[fieldId]) {
      bodyLines.push(...propertyBlocks[fieldId]);
    }
  });

  const lines = [...headerLines, ...bodyLines, "END:VCARD"];
  return lines.join("\r\n");
}

export const VCARD_FIELD_LABELS = {
  title: "Title",
  company: "Company",
  email: "Email",
  phone: "Phone",
  address: "Address",
  website: "Website",
  notes: "Notes",
};

export function downloadVCard(contact, firms = []) {
  const vcard = generateVCard(contact, firms);
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = [contact.first_name, contact.last_name].filter(Boolean).join("_") || "contact";
  a.download = `${safeName}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}