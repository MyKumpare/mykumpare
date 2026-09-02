import { jsPDF } from "jspdf";
import { format } from "date-fns";

const stripHtml = (html) => {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso + "T00:00:00"), "MMM d, yyyy");
  } catch {
    return iso;
  }
};

// Build a clean, printable PDF summary of a contact's meeting log timeline.
export function exportContactMeetingLogPdf({ contactName, timeline }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text, fontSize, style = "normal", color = [60, 60, 60]) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text || "", contentW);
    lines.forEach((line) => {
      ensureSpace(fontSize + 4);
      doc.text(line, margin, y);
      y += fontSize + 4;
    });
  };

  // Title
  writeWrapped(contactName || "Contact", 16, "bold", [30, 30, 30]);
  writeWrapped("Meeting Log Summary", 11, "normal", [120, 120, 120]);
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  if (!timeline || timeline.length === 0) {
    writeWrapped("No meetings or onsite visits recorded.", 11, "normal", [150, 150, 150]);
  }

  timeline.forEach((item, idx) => {
    ensureSpace(60);
    // Divider between entries
    if (idx > 0) {
      doc.setDrawColor(235, 235, 235);
      doc.line(margin, y, pageW - margin, y);
      y += 12;
    }

    if (item.type === "meeting") {
      const m = item.activity;
      const dateStr = fmtDate(m.activity_date);
      writeWrapped(`Meeting — ${dateStr}`, 12, "bold", [40, 40, 40]);
      if (m.subject) writeWrapped(`Subject: ${m.subject}`, 10, "normal", [90, 90, 90]);
      if (item.firmName) writeWrapped(`Firm: ${item.firmName}`, 10, "normal", [90, 90, 90]);
      if (m.notes) {
        const notes = stripHtml(m.notes);
        if (notes) writeWrapped(`Notes: ${notes}`, 10, "normal", [110, 110, 110]);
      }
    } else {
      const v = item.visit;
      const dateStr = fmtDate(v.actual_visit_date || v.target_visit_date);
      const roleLabel = item.role === "analyst" ? "Visiting Analyst" : "Host Firm";
      writeWrapped(`Onsite Visit — ${dateStr}`, 12, "bold", [40, 40, 40]);
      writeWrapped(`Type: ${v.onsite_type || "In-person"}  ·  Status: ${v.status || "Scheduled"}  ·  Role: ${roleLabel}`, 10, "normal", [90, 90, 90]);
      if (v.firm_name) writeWrapped(`Firm: ${v.firm_name}`, 10, "normal", [90, 90, 90]);
      if (v.visiting_analyst_name) writeWrapped(`Visiting Analyst: ${v.visiting_analyst_name}`, 10, "normal", [90, 90, 90]);
      if (v.notes) {
        const notes = stripHtml(v.notes);
        if (notes) writeWrapped(`Notes: ${notes}`, 10, "normal", [110, 110, 110]);
      }
    }
    y += 6;
  });

  // Footer page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 16, { align: "right" });
  }

  const safeName = (contactName || "contact").replace(/[^a-z0-9]+/gi, "_");
  doc.save(`Meeting_Log_${safeName}.pdf`);
}