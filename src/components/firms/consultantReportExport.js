// PDF and Excel export for investment consultant reports on the allocator firm profile.
// Lists all associated investment consultants, their roles, and tenure dates.
// Includes "Powered by MyKumpare" branding on every page of the PDF.

import { drawReportHeader, drawMyKumpareBranding, preloadMyKumpareLogo } from "@/components/reports/reportBranding";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Export the consultant list for a given allocator firm as a PDF.
 * @param {object} opts - { firmName, consultants }
 */
export async function exportConsultantsPdf({ firmName, consultants }) {
  // Ensure the MyKumpare logo is rasterized before we draw
  await preloadMyKumpareLogo().catch(() => {});

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });

  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = drawReportHeader(doc, {
    title: "Investment Consultant Report",
    subtitle: `${firmName} — Generated ${new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}`,
    firmName,
    margin,
  });

  // Table header
  const colX = {
    consultant: margin,
    roles: margin + 180,
    inception: margin + 360,
    termination: margin + 440,
    contacts: margin + 520,
  };
  const colWidths = { consultant: 180, roles: 180, inception: 80, termination: 80, contacts: pageW - margin - 520 };

  const rowH = 16;
  let rowIdx = 0;

  const drawTableHeader = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y, pageW - margin * 2, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    doc.text("Consultant Firm", colX.consultant + 4, y + 11);
    doc.text("Role(s)", colX.roles + 4, y + 11);
    doc.text("Inception", colX.inception + 4, y + 11);
    doc.text("Termination", colX.termination + 4, y + 11);
    doc.text("Related Contacts", colX.contacts + 4, y + 11);
    y += rowH;
  };

  drawTableHeader();

  for (const c of consultants) {
    // Page break check
    if (y > pageH - 60) {
      drawMyKumpareBranding(doc, { margin });
      doc.addPage();
      y = drawReportHeader(doc, { title: null, subtitle: null, firmName, margin });
      drawTableHeader();
    }

    const roles = (c.roles || []).join(", ") || "—";
    const contactsText = (c.contacts || [])
      .map((ct) => {
        const role = ct.contact_role ? ` (${ct.contact_role})` : "";
        const dates = ct.inception_date || ct.termination_date
          ? ` ${formatDate(ct.inception_date)}–${formatDate(ct.termination_date)}`
          : "";
        return `${ct.contact_name || "—"}${role}${dates}`;
      })
      .join("\n") || "—";

    // Alternate row shading
    if (rowIdx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, pageW - margin * 2, rowH, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(55, 65, 81);

    // Consultant firm name (truncated to fit column)
    const consultantName = c.consultant_firm_name || "—";
    doc.text(doc.splitTextToSize(consultantName, colWidths.consultant - 8)[0], colX.consultant + 4, y + 11);

    // Roles (truncated)
    doc.text(doc.splitTextToSize(roles, colWidths.roles - 8)[0], colX.roles + 4, y + 11);

    // Dates
    doc.text(formatDate(c.inception_date), colX.inception + 4, y + 11);
    doc.text(formatDate(c.termination_date), colX.termination + 4, y + 11);

    // Contacts (may wrap to multiple lines)
    const contactLines = doc.splitTextToSize(contactsText, colWidths.contacts - 8);
    doc.text(contactLines, colX.contacts + 4, y + 11);

    // If contacts text wraps, advance y by the extra lines
    const extraLines = Math.max(0, contactLines.length - 1);
    y += rowH + extraLines * 11;
    rowIdx++;
  }

  // Footer branding on every page
  drawMyKumpareBranding(doc, { margin });

  doc.save(`Consultant_Report_${firmName.replace(/\s+/g, "_")}.pdf`);
}

/**
 * Export the consultant list for a given allocator firm as an Excel file.
 * @param {object} opts - { firmName, consultants }
 */
export async function exportConsultantsExcel({ firmName, consultants }) {
  const XLSX = await import("xlsx");

  // Build flat rows: one per consultant, with contacts joined into a single cell
  const rows = consultants.map((c) => {
    const contactsStr = (c.contacts || [])
      .map((ct) => {
        const role = ct.contact_role ? ` (${ct.contact_role})` : "";
        const dates = ct.inception_date || ct.termination_date
          ? ` ${formatDate(ct.inception_date)}–${formatDate(ct.termination_date)}`
          : "";
        return `${ct.contact_name || "—"}${role}${dates}`;
      })
      .join("; ") || "—";

    return {
      "Consultant Firm": c.consultant_firm_name || "—",
      "Role(s)": (c.roles || []).join(", ") || "—",
      "Inception Date": formatDate(c.inception_date),
      "Termination Date": formatDate(c.termination_date),
      "Related Contacts": contactsStr,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{
    "Consultant Firm": "—", "Role(s)": "—", "Inception Date": "—",
    "Termination Date": "—", "Related Contacts": "—",
  }]);
  ws["!cols"] = [
    { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 60 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consultants");
  XLSX.writeFile(wb, `Consultant_Report_${firmName.replace(/\s+/g, "_")}.xlsx`);
}