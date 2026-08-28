import * as XLSX from "xlsx";

/**
 * Escapes a value for CSV output (RFC 4180 compliant).
 */
function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const EXPORT_HEADERS = [
  "Firm Name",
  "Firm Type(s)",
  "Website",
  "Email",
  "LinkedIn URL",
  "Year Founded",
  "Geographic Region",
  "Location",
  "Funding Status",
  "Description",
  "Headquarters Address",
  "Phone",
  "Date Added",
];

function buildRow(firm) {
  const types = Array.isArray(firm.firm_types) && firm.firm_types.length
    ? firm.firm_types.join("; ")
    : firm.firm_type || "";
  const hq = (firm.addresses || []).find((a) => a.is_headquarters) || (firm.addresses || [])[0];
  const hqStr = hq
    ? [hq.address_line1, hq.address_line2, hq.city, hq.state, hq.postal_code, hq.country]
        .filter(Boolean)
        .join(", ")
    : "";
  const phone = (firm.phones || []).find((p) => p.is_default) || (firm.phones || [])[0];
  const phoneStr = phone
    ? [phone.country_code ? `+${phone.country_code}` : "", phone.area_code, phone.number_mid, phone.number_last]
        .filter(Boolean)
        .join("-")
    : "";
  const dateAdded = firm.created_date ? new Date(firm.created_date).toLocaleDateString() : "";
  return [
    firm.name || "",
    types,
    firm.website || "",
    firm.email || "",
    firm.linkedin_url || "",
    firm.year_founded || "",
    firm.geographic_region || "",
    firm.location || "",
    firm.funding_status || "",
    firm.description || "",
    hqStr,
    phoneStr,
    dateAdded,
  ];
}

/**
 * Exports an array of firm records to a CSV file and triggers a download.
 * @param {Array} firms - Firm records to export
 * @param {string} [filename] - Optional filename override
 */
export function exportFirmsToCSV(firms, filename) {
  if (!firms || firms.length === 0) return;
  const rows = firms.map(buildRow);
  const csv = [EXPORT_HEADERS.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = filename || `firms_export_${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports an array of firm records to an Excel (.xlsx) file and triggers a download.
 * @param {Array} firms - Firm records to export
 * @param {string} [filename] - Optional filename override
 */
export function exportFirmsToExcel(firms, filename) {
  if (!firms || firms.length === 0) return;
  const data = [EXPORT_HEADERS, ...firms.map(buildRow)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  // Set reasonable column widths
  ws["!cols"] = EXPORT_HEADERS.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Firms");
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, filename || `firms_export_${dateStr}.xlsx`);
}