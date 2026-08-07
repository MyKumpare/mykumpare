import React from "react";

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

/**
 * Formats a phone object into a readable string.
 */
function formatPhone(phone) {
  if (!phone) return "";
  const parts = [
    phone.country_code ? `+${phone.country_code}` : "",
    phone.area_code,
    phone.number_mid,
    phone.number_last,
  ].filter(Boolean);
  let str = parts.join("-");
  if (phone.phone_type) str += ` (${phone.phone_type})`;
  return str;
}

/**
 * Exports an array of contact objects to a CSV file and triggers a download.
 * @param {Array} contacts - Contact records to export
 * @param {Array} firms - Firm records (for resolving firm names)
 * @param {string} [filename] - Optional filename override
 */
export function exportContactsToCSV(contacts, firms = [], filename) {
  if (!contacts || contacts.length === 0) return;

  const firmMap = Object.fromEntries((firms || []).map((f) => [f.id, f]));

  const headers = [
    "Salutation",
    "First Name",
    "Middle Name",
    "Last Name",
    "Suffix",
    "Designations",
    "Title",
    "Email",
    "LinkedIn URL",
    "Employee Status",
    "Contact Status",
    "Contact Type",
    "Contact Roles",
    "Firm Names",
    "Biography",
    "Phones",
    "Notes",
  ];

  const rows = contacts.map((c) => {
    const firmNames = (c.firm_ids || [])
      .map((id) => firmMap[id]?.name || "")
      .filter(Boolean)
      .join("; ");
    const phones = (c.phones || []).map(formatPhone).join("; ");
    return [
      c.salutation || "",
      c.first_name || "",
      c.middle_name || "",
      c.last_name || "",
      c.suffix || "",
      (c.designations || []).join("; "),
      c.title || "",
      c.email || "",
      c.linkedin_url || "",
      c.employee_status || "",
      c.contact_status || "",
      c.contact_type || "",
      (c.contact_roles || []).join("; "),
      firmNames,
      c.biography || "",
      phones,
      c.notes || "",
    ].map(csvEscape).join(",");
  });

  const csv = [headers.map(csvEscape).join(","), ...rows].join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = filename || `contacts_export_${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}