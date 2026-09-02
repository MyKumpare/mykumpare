import { jsPDF } from "jspdf";
import { drawMyKumpareBranding } from "../reports/reportBranding";

const STATUS_LABEL = {
  Scheduled: "Scheduled",
  "In-Progress": "In-Progress",
  Completed: "Completed",
  Cancelled: "Cancelled",
  "No-show": "No-show",
};

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Generates a clean, printable ONE-PAGE summary PDF for an onsite visit,
// pulling in the visit details and the AI-generated attachment summaries
// (overview, key takeaways, action items). Designed to fit on a single
// letter page using a compact layout.
export function generateOnsiteVisitOnePageSummaryPdf(visit) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin - 24) {
      // One-page summary: stop adding content once the page is full.
      return false;
    }
    return true;
  };

  // ── Header ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("Onsite Visit Summary", margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(`${visit.firm_name || "—"}`, margin, y);
  const meta = `${STATUS_LABEL[visit.status] || visit.status || "—"}  •  ${visit.onsite_type || "—"}`;
  doc.text(meta, pageW - margin, y, { align: "right" });
  y += 8;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  // ── Visit details (compact two-column grid) ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("VISIT DETAILS", margin, y);
  y += 12;

  const details = [
    ["Firm", visit.firm_name || "—"],
    ["Target Date", fmtDate(visit.target_visit_date)],
    ["Actual Date", fmtDate(visit.actual_visit_date)],
    ["Visiting Analyst", visit.visiting_analyst_name || "—"],
    ["Onsite Type", visit.onsite_type || "—"],
    ["Status", STATUS_LABEL[visit.status] || visit.status || "—"],
  ];

  doc.setFontSize(9);
  const colW = contentW / 2;
  for (let i = 0; i < details.length; i += 2) {
    if (!ensureSpace(16)) break;
    const left = details[i];
    const right = details[i + 1];
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(`${left[0]}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(String(left[1]), margin + 64, y);
    if (right) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text(`${right[0]}:`, margin + colW, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(String(right[1]), margin + colW + 64, y);
    }
    y += 14;
  }
  y += 6;

  // ── AI Summary section (from attachment summaries) ──
  const summaries = (visit.attachments || []).filter((a) => a?.summary?.overview || a?.summary?.key_takeaways?.length || a?.summary?.action_items?.length);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("AI DOCUMENT SUMMARY", margin, y);
  y += 12;

  if (!summaries.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("No AI summaries have been generated for this visit's attachments.", margin, y);
    y += 12;
  } else {
    for (const att of summaries) {
      if (!ensureSpace(20)) break;
      const s = att.summary;
      // Attachment name
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(49, 46, 129);
      const nameLines = doc.splitTextToSize(att.name || "Untitled document", contentW);
      doc.text(nameLines, margin, y);
      y += nameLines.length * 11 + 2;

      // Overview
      if (s.overview) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(s.overview, contentW);
        for (const line of lines) {
          if (!ensureSpace(11)) break;
          doc.text(line, margin, y);
          y += 11;
        }
        y += 3;
      }

      // Key takeaways
      if (s.key_takeaways?.length) {
        if (ensureSpace(12)) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          doc.text("Key Takeaways", margin, y);
          y += 11;
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        for (const t of s.key_takeaways) {
          const wrapped = doc.splitTextToSize(`•  ${t}`, contentW - 10);
          for (const line of wrapped) {
            if (!ensureSpace(10)) break;
            doc.text(line, margin + 4, y);
            y += 10;
          }
          if (!ensureSpace(2)) break;
        }
        y += 3;
      }

      // Action items
      if (s.action_items?.length) {
        if (ensureSpace(12)) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          doc.text("Action Items / Follow-ups", margin, y);
          y += 11;
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        for (const t of s.action_items) {
          const wrapped = doc.splitTextToSize(`•  ${t}`, contentW - 10);
          for (const line of wrapped) {
            if (!ensureSpace(10)) break;
            doc.text(line, margin + 4, y);
            y += 10;
          }
          if (!ensureSpace(2)) break;
        }
        y += 3;
      }

      y += 4;
      if (!ensureSpace(10)) break;
    }
  }

  // ── Footer ──
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageH - margin - 18, pageW - margin, pageH - margin - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Onsite Visit One-Page Summary — ${visit.firm_name || ""}`, margin, pageH - margin - 4);
  doc.text(new Date().toLocaleDateString("en-US"), pageW - margin, pageH - margin - 4, { align: "right" });

  drawMyKumpareBranding(doc, { margin: 40 });
  const safeName = (visit.firm_name || "onsite-visit").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const datePart = visit.target_visit_date || visit.actual_visit_date || "";
  doc.save(`onsite-visit-summary-${safeName}${datePart ? `-${datePart}` : ""}.pdf`);
}