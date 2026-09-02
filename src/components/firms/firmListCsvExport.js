// Shared CSV export helpers for firm/contact lists.
// Each function builds a CSV string from the provided list and triggers a browser download.

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const getFirmTypes = (f) =>
  f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];

/**
 * Export a list of firms to CSV.
 * @param {Array} firms - firm records to export
 * @param {string} filename - download file name
 */
export function exportFirmsToCsv(firms, filename = "firms.csv") {
  const headers = [
    "Firm Name",
    "Type(s)",
    "Website",
    "Email",
    "Location",
    "Primary Xponance Contact",
    "Secondary Xponance Contact",
  ];
  const rows = firms.map((f) => [
    f.name || "",
    getFirmTypes(f).join("; "),
    f.website || "",
    f.email || "",
    f.location || "",
    f.primary_xponance_contact_name || "",
    f.secondary_xponance_contact_name || "",
  ]);
  downloadCsv(filename, [headers, ...rows]);
}

const getContactName = (c) =>
  [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");

/**
 * Export a list of contacts (with their firm associations) to CSV.
 * @param {Array} contacts - contact records to export
 * @param {Array} firms - all firms (for resolving firm names from firm_ids)
 * @param {string} filename - download file name
 */
export function exportContactsToCsv(contacts, firms, filename = "contacts.csv") {
  const firmMap = Object.fromEntries(firms.map((f) => [f.id, f]));
  const headers = [
    "Contact Name",
    "Title",
    "Firm(s)",
    "Email",
    "Primary Xponance Contact",
    "Secondary Xponance Contact",
  ];
  const rows = contacts.map((c) => [
    getContactName(c),
    c.title || "",
    (c.firm_ids || [])
      .map((fid) => firmMap[fid]?.name)
      .filter(Boolean)
      .join("; "),
    c.email || "",
    c.primary_xponance_contact_name || "",
    c.secondary_xponance_contact_name || "",
  ]);
  downloadCsv(filename, [headers, ...rows]);
}