import { jsPDF } from "jspdf";

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const ENTITY_LABEL = { our_firm: "your firm", investment_manager: "investment manager", sub_manager: "sub-manager", other: "other" };

// Generates a clean, printable PDF report of the filtered board meeting list
// with summary flags (status, needs-review, portfolio mentions). Each meeting
// object should carry a precomputed `_status` ("upcoming" | "completed").
export function generateBoardMeetingCalendarPdf(meetings, { filters } = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin) { doc.addPage(); y = margin; }
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text("Board Meeting Calendar Report", margin, y);
  y += 20;

  // Generated date + filters
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const genDate = new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
  doc.text(`Generated: ${genDate}`, margin, y);
  y += 12;
  if (filters) {
    const filterParts = [
      filters.firm !== "all" ? `Firm: ${filters.firmName || filters.firm}` : null,
      `Status: ${filters.status}`,
      filters.search ? `Search: "${filters.search}"` : null,
      filters.dateFrom || filters.dateTo ? `Date range: ${filters.dateFrom || "…"} – ${filters.dateTo || "…"}` : null,
    ].filter(Boolean);
    if (filterParts.length) {
      const fLines = doc.splitTextToSize(`Filters: ${filterParts.join("  •  ")}`, contentW);
      doc.text(fLines, margin, y);
      y += fLines.length * 11 + 4;
    }
  }
  y += 4;

  // Summary stats
  const total = meetings.length;
  const upcoming = meetings.filter(m => m._status === "upcoming").length;
  const completed = meetings.filter(m => m._status === "completed").length;
  const flagged = meetings.filter(m => m.needs_review && !m.reviewed).length;
  const withMentions = meetings.filter(m => m.mentions?.length).length;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Summary", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Total: ${total}   |   Upcoming: ${upcoming}   |   Completed: ${completed}   |   Flagged for review: ${flagged}   |   With portfolio mentions: ${withMentions}`, margin, y);
  y += 16;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  // Table header
  const colX = { date: margin, title: margin + 80, firm: margin + 250, status: margin + 380, flags: margin + 460 };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Date", colX.date, y);
  doc.text("Title", colX.title, y);
  doc.text("Firm", colX.firm, y);
  doc.text("Status", colX.status, y);
  doc.text("Flags / Mentions", colX.flags, y);
  y += 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  for (const m of meetings) {
    ensureSpace(16);
    doc.setTextColor(51, 65, 85);
    doc.text(fmtDate(m.meeting_date), colX.date, y);
    const titleLines = doc.splitTextToSize(m.title || "Untitled", 160);
    doc.text(titleLines[0], colX.title, y);
    const firmLines = doc.splitTextToSize(m.firm_name || "—", 120);
    doc.text(firmLines[0], colX.firm, y);
    if (m._status === "upcoming") { doc.setTextColor(37, 99, 235); } else { doc.setTextColor(100, 116, 139); }
    doc.text(m._status === "upcoming" ? "Upcoming" : "Completed", colX.status, y);
    const flags = [];
    if (m.needs_review && !m.reviewed) flags.push("REVIEW");
    if (m.mentions?.length) flags.push(`${m.mentions.length} mention${m.mentions.length === 1 ? "" : "s"}`);
    if (m.needs_review && !m.reviewed) { doc.setTextColor(180, 83, 9); } else { doc.setTextColor(51, 65, 85); }
    doc.text(flags.join("  •  ") || "—", colX.flags, y);
    y += Math.max(12, Math.max(titleLines.length, firmLines.length) * 10) + 2;
  }
  y += 8;

  // Flagged meetings detail section
  const flaggedMeetings = meetings.filter(m => m.needs_review && !m.reviewed);
  if (flaggedMeetings.length) {
    ensureSpace(20);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9);
    doc.text("Meetings Flagged for Review", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const m of flaggedMeetings) {
      ensureSpace(20);
      doc.setTextColor(51, 65, 85);
      doc.text(`${fmtDate(m.meeting_date)} — ${m.title || "Untitled"} (${m.firm_name || "—"})`, margin, y);
      y += 11;
      if (m.mentions?.length) {
        for (const mt of m.mentions) {
          ensureSpace(12);
          const line = `    • ${mt.entity_name} (${ENTITY_LABEL[mt.entity_type] || "other"})${mt.context ? ` — ${mt.context}` : ""}`;
          const lines = doc.splitTextToSize(line, contentW - 12);
          doc.setTextColor(120, 53, 15);
          doc.text(lines, margin, y);
          y += lines.length * 10 + 1;
        }
      }
      y += 4;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Board Meeting Calendar Report", margin, pageH - 16);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 16, { align: "right" });
  }

  doc.save(`board-meeting-calendar-${new Date().toISOString().slice(0, 10)}.pdf`);
}