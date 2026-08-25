import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import { drawMyKumpareBranding } from "../reports/reportBranding";

function safe(v) {
  return v || "";
}

export function downloadConferenceTravelPdf(conferences, { filtersLabel } = {}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = margin;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("Conference Travel Schedule", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated ${format(new Date(), "MMM d, yyyy h:mm a")}`, margin, y);
  y += 12;

  if (filtersLabel) {
    doc.text(`Filters: ${filtersLabel}`, margin, y);
    y += 12;
  }

  doc.text(`${conferences.length} upcoming conference${conferences.length === 1 ? "" : "s"}`, margin, y);
  y += 14;

  // Column layout
  const cols = [
    { header: "Date", key: "date", w: 110 },
    { header: "Conference", key: "title", w: 200 },
    { header: "Firm", key: "firm", w: 130 },
    { header: "Location", key: "location", w: 140 },
    { header: "Participation", key: "participation", w: 90 },
    { header: "RSVP", key: "rsvp", w: 75 },
    { header: "Registration", key: "registration", w: 85 },
    { header: "Fees", key: "fees", w: 70 },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  let x = margin;

  // Header row
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 10, tableW, 16, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  cols.forEach(c => {
    doc.text(c.header, x + 4, y);
    x += c.w;
  });
  y += 16;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const fmtDateRange = (start, end) => {
    if (!start && !end) return "—";
    const fmt = (d) => {
      if (!d) return "";
      try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
    };
    if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
    return fmt(start || end);
  };

  conferences.forEach((c, i) => {
    if (y > pageH - margin - 20) {
      doc.addPage();
      y = margin;
    }
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 10, tableW, 14, "F");
    }
    x = margin;
    const row = {
      date: fmtDateRange(c.conference_date, c.end_date),
      title: safe(c.title),
      firm: safe(c.firm_name),
      location: safe(c.location),
      participation: safe(c.participation_type),
      rsvp: safe(c.rsvp_status) || "Not Responded",
      registration: safe(c.registration_status) || "Not Registered",
      fees: safe(c.fees),
    };
    cols.forEach(col => {
      const text = String(row[col.key] || "");
      const lines = doc.splitTextToSize(text, col.w - 8);
      doc.text(lines.slice(0, 2), x + 4, y);
      x += col.w;
    });
    y += 14;
  });

  // Footer page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${p} of ${pageCount}`, pageW - margin - 60, pageH - 16);
  }

  drawMyKumpareBranding(doc, { margin });
  doc.save(`conference-travel-schedule-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}