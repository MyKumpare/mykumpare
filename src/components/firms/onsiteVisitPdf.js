import { jsPDF } from "jspdf";
import { drawMyKumpareBranding } from "../reports/reportBranding";

const STATUS_LABEL = {
  Scheduled: "Scheduled",
  Completed: "Completed",
  Cancelled: "Cancelled",
  "No-show": "No-show",
};

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Converts rich-text HTML (Quill output) into plain-text lines suitable for
// jsPDF, preserving paragraph breaks and list bullets.
function htmlToLines(html) {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  const blocks = [];
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.replace(/\s+/g, " ").trim();
      if (text) blocks.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (["p", "div", "br", "li", "h1", "h2", "h3", "h4", "blockquote"].includes(tag)) {
      const inner = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (inner) blocks.push(tag === "li" ? `• ${inner}` : inner);
      return;
    }
    const inner = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (inner) blocks.push(inner);
  };
  doc.body.childNodes.forEach((child) => walk(child));
  return blocks;
}

// Generates a clean, printable PDF summary of a single onsite visit, including
// the visit details, agenda, notes, and follow-up item checklist.
export function generateOnsiteVisitPdf(visit) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  const titleLines = doc.splitTextToSize(
    `Onsite Visit Summary — ${visit.firm_name || "—"}`,
    contentW,
  );
  doc.text(titleLines, margin, y);
  y += titleLines.length * 22 + 4;

  // Status + type line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${STATUS_LABEL[visit.status] || visit.status || "—"}  •  ${visit.onsite_type || "—"}`,
    margin,
    y,
  );
  y += 18;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // Details
  const details = [
    ["Firm", visit.firm_name || "—"],
    ["Target Visit Date", fmtDate(visit.target_visit_date)],
    ["Actual Visit Date", fmtDate(visit.actual_visit_date)],
    ["Visiting Analyst", visit.visiting_analyst_name || "—"],
    ["Onsite Type", visit.onsite_type || "—"],
    ["Status", STATUS_LABEL[visit.status] || visit.status || "—"],
  ];
  doc.setFontSize(10);
  for (const [label, value] of details) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(label + ":", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const valLines = doc.splitTextToSize(value, contentW - 130);
    doc.text(valLines, margin + 130, y);
    y += Math.max(14, valLines.length * 13) + 2;
  }
  y += 6;

  // Agenda
  const agendaLines = htmlToLines(visit.agenda);
  if (agendaLines.length) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("Agenda", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    for (const para of agendaLines) {
      const lines = doc.splitTextToSize(para, contentW);
      for (const line of lines) {
        ensureSpace(13);
        doc.text(line, margin, y);
        y += 13;
      }
      y += 4;
    }
    y += 8;
  }

  // Notes
  const notesLines = htmlToLines(visit.notes);
  if (notesLines.length) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("Visit Notes", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    for (const para of notesLines) {
      const lines = doc.splitTextToSize(para, contentW);
      for (const line of lines) {
        ensureSpace(13);
        doc.text(line, margin, y);
        y += 13;
      }
      y += 4;
    }
    y += 8;
  }

  // Follow-up Items
  const items = visit.follow_up_items || [];
  if (items.length) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("Follow-up Items", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const item of items) {
      const collected = !!item.collected;
      const checkbox = collected ? "☑" : "☐";
      const prefix = `${checkbox}  `;
      const text = item.description || "(no description)";
      const lines = doc.splitTextToSize(text, contentW - 20);
      ensureSpace(lines.length * 13 + 4);
      if (collected) {
        doc.setTextColor(22, 163, 74);
      } else {
        doc.setTextColor(51, 65, 85);
      }
      doc.text(prefix + lines[0], margin, y);
      y += 13;
      for (let i = 1; i < lines.length; i++) {
        ensureSpace(13);
        doc.text(lines[i], margin + 20, y);
        y += 13;
      }
      y += 4;
    }
    y += 8;
  }

  // Attachments
  const attachments = visit.attachments || [];
  if (attachments.length) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text("Attachments", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const att of attachments) {
      const name = att.name || "Untitled";
      const lines = doc.splitTextToSize(`•  ${name}`, contentW - 12);
      ensureSpace(lines.length * 12 + 2);
      doc.setTextColor(51, 65, 85);
      doc.text(lines, margin + 12, y);
      if (att.file_url) {
        doc.setTextColor(8, 145, 178);
        doc.textWithLink("(open)", margin + 12 + doc.getTextWidth(lines[0]) + 4, y, { url: att.file_url });
      }
      y += lines.length * 12 + 2;
    }
    y += 8;
  }

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Onsite Visit Summary — ${visit.firm_name || ""}`, margin, pageH - 36);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 20, { align: "right" });
  }

  drawMyKumpareBranding(doc, { margin: 48 });
  const safeName = (visit.firm_name || "onsite-visit").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const datePart = visit.target_visit_date || visit.actual_visit_date || "";
  doc.save(`onsite-visit-${safeName}${datePart ? `-${datePart}` : ""}.pdf`);
}