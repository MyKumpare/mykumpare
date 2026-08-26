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

export function generateVCard(contact, firms = []) {
  const {
    salutation, first_name, middle_name, last_name, suffix,
    title, email, linkedin_url, notes, phones = [], addresses = [],
    firm_ids = [],
  } = contact;

  const firmNames = firm_ids
    .map((id) => firms.find((f) => f.id === id)?.name)
    .filter(Boolean);

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCard(last_name)};${escapeVCard(first_name)};${escapeVCard(middle_name)};${escapeVCard(suffix)};${escapeVCard(salutation)}`,
    `FN:${escapeVCard([salutation, first_name, middle_name, last_name].filter(Boolean).join(" "))}`,
  ];

  if (title) lines.push(`TITLE:${escapeVCard(title)}`);
  if (firmNames.length > 0) lines.push(`ORG:${escapeVCard(firmNames.join("; "))}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(email)}`);

  phones.forEach((p) => {
    const num = formatPhone(p);
    if (!num) return;
    const type = (p.phone_type || "WORK").toUpperCase();
    lines.push(`TEL;TYPE=${type},VOICE:${escapeVCard(num)}`);
  });

  addresses.forEach((a) => {
    if (!a.address_line1 && !a.city && !a.state) return;
    const type = a.is_primary ? "WORK,HOME" : "WORK";
    lines.push(`ADR;TYPE=${type}:${buildAddress(a)}`);
    const label = [a.address_line1, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ");
    if (label) lines.push(`LABEL;TYPE=${type}:${escapeVCard(label)}`);
  });

  if (linkedin_url) lines.push(`URL:${escapeVCard(linkedin_url)}`);
  if (notes) lines.push(`NOTE:${escapeVCard(notes)}`);

  lines.push("END:VCARD");
  return lines.join("\r\n");
}

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