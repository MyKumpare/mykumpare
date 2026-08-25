import { jsPDF } from "jspdf";
import { drawMyKumpareBranding } from "../reports/reportBranding";

const FORMAT_LABEL = { "in-person": "In-Person", virtual: "Virtual", hybrid: "Hybrid", unknown: "—" };
const SESSION_LABEL = { public_meeting: "Public Meeting", closed_session: "Closed Session", unknown: "—" };

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Generates a clean, printable PDF summary of a single board meeting.
// When `opts.summary` is provided (from the AI executive summary dialog),
// the PDF includes the executive summary sections (discussions, decisions,
// tabled items, future agenda) and the list of impacted/mentioned firms.
export function generateBoardMeetingPdf(meeting, opts = {}) {
  const { summary, detectedFirmNames = [], matchedFirms = [] } = opts;
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
  const titleLines = doc.splitTextToSize(meeting.title || "Untitled Board Meeting", contentW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 22 + 4;

  // Firm + status line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  const statusLabel = meeting.status === "upcoming" ? "Upcoming" : "Completed";
  doc.text(`${meeting.firm_name || "—"}  •  ${statusLabel}`, margin, y);
  y += 18;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // Details
  const details = [
    ["Date", `${fmtDate(meeting.meeting_date)}${meeting.end_date ? ` – ${fmtDate(meeting.end_date)}` : ""}`],
    ["Location", meeting.location || "—"],
    ["Format", FORMAT_LABEL[meeting.meeting_format] || "—"],
    ["Session", SESSION_LABEL[meeting.session_type] || "—"],
  ];
  doc.setFontSize(10);
  for (const [label, value] of details) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(label + ":", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const valLines = doc.splitTextToSize(value, contentW - 90);
    doc.text(valLines, margin + 90, y);
    y += Math.max(14, valLines.length * 13) + 2;
  }
  y += 6;

  // Topics
  if (meeting.meeting_topics?.length) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Topics", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const topicsStr = meeting.meeting_topics.join("  •  ");
    const tLines = doc.splitTextToSize(topicsStr, contentW);
    doc.text(tLines, margin, y);
    y += tLines.length * 13 + 10;
  }

  // ── Executive Summary (AI-generated) ──
  if (summary) {
    // Discussions
    if (summary.discussions) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text("Executive Summary — Discussions", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const dLines = doc.splitTextToSize(summary.discussions, contentW);
      dLines.forEach((line) => {
        ensureSpace(13);
        doc.text(line, margin, y);
        y += 13;
      });
      y += 10;
    }

    // Decisions
    if (summary.decisions?.length) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text("Decisions Made", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const d of summary.decisions) {
        const lines = doc.splitTextToSize(`•  ${d}`, contentW - 12);
        ensureSpace(lines.length * 13 + 2);
        doc.setTextColor(51, 65, 85);
        doc.text(lines, margin + 12, y);
        y += lines.length * 13 + 2;
      }
      y += 10;
    }

    // Tabled Items
    if (summary.tabled_items?.length) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text("Items Tabled", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const t of summary.tabled_items) {
        const lines = doc.splitTextToSize(`•  ${t}`, contentW - 12);
        ensureSpace(lines.length * 13 + 2);
        doc.setTextColor(51, 65, 85);
        doc.text(lines, margin + 12, y);
        y += lines.length * 13 + 2;
      }
      y += 10;
    }

    // Future Agenda
    if (summary.future_agenda?.length) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(30, 41, 59);
      doc.text("Future Agenda", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const f of summary.future_agenda) {
        const lines = doc.splitTextToSize(`•  ${f}`, contentW - 12);
        ensureSpace(lines.length * 13 + 2);
        doc.setTextColor(51, 65, 85);
        doc.text(lines, margin + 12, y);
        y += lines.length * 13 + 2;
      }
      y += 10;
    }
  }

  // ── Impacted / Mentioned Firms ──
  // Show the AI-detected firms from the minutes, noting which are in the system.
  const allMentionNames = new Set([
    ...(detectedFirmNames || []),
    ...(meeting.mentions || []).map((m) => m.entity_name),
  ]);
  if (allMentionNames.size > 0) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(67, 56, 202);
    doc.text("Impacted / Mentioned Firms", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Firms in the system (auto-tagged or manually tagged)
    const systemMentions = (meeting.mentions || []).filter((m) => m.entity_id);
    if (systemMentions.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Firms in your system:", margin, y);
      y += 13;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const mt of systemMentions) {
        const line = `•  ${mt.entity_name}${mt.context ? ` — ${mt.context}` : ""}`;
        const lines = doc.splitTextToSize(line, contentW - 12);
        ensureSpace(lines.length * 13 + 2);
        doc.setTextColor(51, 65, 85);
        doc.text(lines, margin + 12, y);
        y += lines.length * 13 + 2;
      }
    }

    // Other detected firms not in the system
    const systemNames = new Set(
      systemMentions.map((m) => (m.entity_name || "").toLowerCase())
    );
    const otherNames = [...allMentionNames].filter(
      (n) => !systemNames.has(n.toLowerCase())
    );
    if (otherNames.length > 0) {
      if (systemMentions.length > 0) y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Other firms mentioned:", margin, y);
      y += 13;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const name of otherNames) {
        const lines = doc.splitTextToSize(`•  ${name}`, contentW - 12);
        ensureSpace(lines.length * 13 + 2);
        doc.setTextColor(51, 65, 85);
        doc.text(lines, margin + 12, y);
        y += lines.length * 13 + 2;
      }
    }
    y += 10;
  }

  // Required actions
  ensureSpace(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("Required Actions", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const actions = [];
  if (meeting.needs_review && !meeting.reviewed) {
    actions.push("• This meeting has been flagged for review — portfolio entity mentions require follow-up.");
  }
  if (meeting.reviewed) {
    actions.push("• This meeting has been reviewed.");
  }
  if (!meeting.needs_review) {
    actions.push("• No specific follow-up actions flagged.");
  }
  if (!meeting.minutes_content && !meeting.minutes_url) {
    actions.push("• Minutes not yet available — check back or request from the firm.");
  }
  for (const a of actions) {
    const lines = doc.splitTextToSize(a, contentW);
    ensureSpace(lines.length * 13 + 2);
    doc.setTextColor(51, 65, 85);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 2;
  }
  y += 8;

  // Review notes
  if (meeting.review_notes) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Review Notes", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const rnLines = doc.splitTextToSize(meeting.review_notes, contentW);
    rnLines.forEach((line) => {
      ensureSpace(13);
      doc.setTextColor(51, 65, 85);
      doc.text(line, margin, y);
      y += 13;
    });
    y += 8;
  }

  // Minutes content (full text, for reference)
  if (meeting.minutes_content) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Full Minutes", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const mLines = doc.splitTextToSize(meeting.minutes_content, contentW);
    mLines.forEach((line) => {
      ensureSpace(11);
      doc.setTextColor(71, 85, 105);
      doc.text(line, margin, y);
      y += 11;
    });
  }

  // Links
  const links = [];
  if (meeting.source_url) links.push(["Source", meeting.source_url]);
  if (meeting.agenda_url) links.push(["Agenda", meeting.agenda_url]);
  if (meeting.minutes_url) links.push(["Minutes", meeting.minutes_url]);
  if (links.length) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Links", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const [label, url] of links) {
      const lines = doc.splitTextToSize(`${label}: ${url}`, contentW);
      ensureSpace(lines.length * 12 + 2);
      doc.setTextColor(8, 145, 178);
      doc.textWithLink(lines, margin, y, { url });
      y += lines.length * 12 + 2;
    }
  }

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Board Meeting Summary — ${meeting.firm_name || ""}`, margin, pageH - 36);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 20, { align: "right" });
  }

  drawMyKumpareBranding(doc, { margin: 48 });
  const safeName = (meeting.title || "board-meeting").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`${safeName}.pdf`);
}