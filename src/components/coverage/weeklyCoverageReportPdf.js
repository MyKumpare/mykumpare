import { jsPDF } from "jspdf";

// ── Weekly Analyst Coverage Report PDF generator ──
// Accepts the coverage data produced by useCoverageData() and produces a
// professional, downloadable PDF highlighting per-analyst assignments,
// firms lacking primary coverage, and coverage gaps.

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTimestamp(d) {
  if (!d) return "";
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const LIFECYCLE_COLORS = {
  Pipeline: [59, 130, 246],
  "Under Due Diligence": [245, 158, 11],
  Approved: [22, 163, 74],
  Funded: [147, 51, 234],
  Rejected: [220, 38, 38],
};

/**
 * @param {object} params
 * @param {Array} params.analysts - Per-analyst summaries from useCoverageData()
 * @param {Array} params.uncoveredFirms - Firms with no assigned coverage
 * @param {Array} params.firms - All active firms
 * @param {Array} params.ddRecords - Enriched DD records
 * @param {Array} params.contacts - Active contacts
 */
export function generateWeeklyCoverageReportPdf({ analysts, uncoveredFirms, firms, ddRecords, contacts }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin - 20) {
      doc.addPage();
      y = margin;
    }
  };

  const writeParagraph = (text, { size = 10, color = [51, 51, 51], bold = false, lineHeight = 14, gapAfter = 6 } = {}) => {
    if (!text) return;
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += gapAfter;
  };

  const sectionHeader = (text, color = [17, 24, 39]) => {
    ensureSpace(30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, margin, y);
    y += 16;
  };

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);

  // ── Title block ──
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Weekly Analyst Coverage Report", margin, y);
  y += 24;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(`${formatDate(weekStart.toISOString().slice(0, 10))} — ${formatDate(now.toISOString().slice(0, 10))}`, margin, y);
  y += 12;
  doc.text(`Generated ${formatTimestamp(now)}`, margin, y);
  y += 18;

  // ── Summary stats strip ──
  const coveredFirmIds = new Set(ddRecords.map((dd) => dd.firm_id));
  const totalAnalysts = analysts.length;
  const uncoveredCount = uncoveredFirms.length;
  const coveredCount = firms.length - uncoveredCount;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 52, 6, 6, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const statCells = [
    { label: "TOTAL FIRMS", value: firms.length, color: [17, 24, 39] },
    { label: "COVERED", value: coveredCount, color: [22, 163, 74] },
    { label: "UNCOVERED", value: uncoveredCount, color: [220, 38, 38] },
    { label: "ANALYSTS", value: totalAnalysts, color: [99, 102, 241] },
  ];
  const cellW = contentW / statCells.length;
  statCells.forEach((cell, i) => {
    const cx = margin + cellW * i + cellW / 2;
    doc.setTextColor(107, 114, 128);
    doc.text(cell.label, cx, y + 18, { align: "center" });
    doc.setFontSize(18);
    doc.setTextColor(cell.color[0], cell.color[1], cell.color[2]);
    doc.text(String(cell.value), cx, y + 40, { align: "center" });
    doc.setFontSize(9);
  });
  y += 52 + 18;

  // ── Per-analyst summary ──
  sectionHeader("Analyst Coverage Summary");
  y += 4;

  const sortedAnalysts = [...analysts].sort((a, b) => a.name.localeCompare(b.name));
  for (const a of sortedAnalysts) {
    ensureSpace(40);
    const totalAssignments = a.assignments.length;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(a.name, margin, y);
    y += 13;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(
      `${a.primaryFirms.size} primary firm${a.primaryFirms.size !== 1 ? "s" : ""}  ·  ${a.secondaryFirms.size} secondary  ·  ${totalAssignments} total assignment${totalAssignments !== 1 ? "s" : ""}`,
      margin + 4,
      y
    );
    y += 12;

    // List the firms this analyst covers (up to 12)
    const firmNames = [...a.assignments].slice(0, 12).map(({ dd, role }) => {
      const roleTag = role === "primary" ? "P" : "S";
      return `${dd.firm_name || "—"} [${roleTag}]`;
    });
    if (firmNames.length > 0) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(75, 85, 99);
      const lines = doc.splitTextToSize(firmNames.join("  ·  "), contentW - 8);
      for (const line of lines) {
        ensureSpace(11);
        doc.text(line, margin + 4, y);
        y += 11;
      }
      if (a.assignments.length > 12) {
        ensureSpace(11);
        doc.setTextColor(156, 163, 175);
        doc.text(`+${a.assignments.length - 12} more`, margin + 4, y);
        y += 11;
      }
    }
    y += 6;
  }

  // ── Firms lacking primary coverage ──
  doc.addPage();
  y = margin;
  sectionHeader("Firms Lacking Primary Coverage", [220, 38, 38]);
  writeParagraph(
    "These firms have no primary analyst assigned. A primary analyst should be designated to ensure coverage accountability.",
    { size: 9, color: [107, 114, 128], lineHeight: 12, gapAfter: 10 }
  );

  // Firms with DD records but no primary analyst
  const noPrimaryFirms = ddRecords
    .filter((dd) => !dd.primaryAnalyst)
    .map((dd) => ({ firm_name: dd.firm_name, product_name: dd.product_name, secondary: dd.secondaryAnalyst?.name }))
    .sort((a, b) => (a.firm_name || "").localeCompare(b.firm_name || ""));

  if (noPrimaryFirms.length === 0) {
    writeParagraph("All due diligence records have a primary analyst assigned.", { size: 10, color: [22, 163, 74], gapAfter: 8 });
  } else {
    for (const item of noPrimaryFirms) {
      ensureSpace(24);
      doc.setFillColor(220, 38, 38);
      doc.circle(margin + 3, y - 3, 2.5, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(item.firm_name || "—", margin + 12, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      const detail = item.product_name ? `${item.product_name}` : "";
      const sec = item.secondary ? `  ·  Secondary: ${item.secondary}` : "";
      if (detail || sec) {
        doc.text(`${detail}${sec}`, margin + 12 + doc.getTextWidth(item.firm_name || "—") + 8, y);
      }
      y += 13;
    }
  }

  // ── Firms with no coverage at all ──
  y += 12;
  sectionHeader("Firms With No Assigned Coverage", [180, 83, 9]);
  writeParagraph(
    "These firms have no due diligence records and no analyst coverage at all.",
    { size: 9, color: [107, 114, 128], lineHeight: 12, gapAfter: 10 }
  );

  if (uncoveredFirms.length === 0) {
    writeParagraph("Every firm has at least one assigned analyst.", { size: 10, color: [22, 163, 74], gapAfter: 8 });
  } else {
    const sortedUncovered = [...uncoveredFirms].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const cols = 2;
    const colW = contentW / cols;
    const rowH = 14;
    for (let i = 0; i < sortedUncovered.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      if (col === 0 && row > 0) {
        // Check space at start of each new row pair
      }
      ensureSpace(rowH);
      const cx = margin + col * colW;
      const cy = y + row * rowH;
      if (cy > pageH - margin - 20) {
        doc.addPage();
        y = margin;
        continue;
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 83, 9);
      doc.text(`• ${sortedUncovered[i].name}`, cx, cy);
    }
    y += Math.ceil(sortedUncovered.length / cols) * rowH + 10;
  }

  // ── Coverage gap analysis ──
  y += 8;
  sectionHeader("Coverage Gap Analysis", [99, 102, 241]);
  const gapPct = firms.length > 0 ? Math.round((uncoveredCount / firms.length) * 100) : 0;
  writeParagraph(
    `${uncoveredCount} of ${firms.length} firms (${gapPct}%) have no analyst coverage. ${coveredCount} firms (${100 - gapPct}%) are actively covered by ${totalAnalysts} analyst${totalAnalysts !== 1 ? "s" : ""}.`,
    { size: 10, lineHeight: 14, gapAfter: 8 }
  );

  // Analysts with no assignments (gap in analyst utilization)
  const analystContactIds = new Set(analysts.map((a) => a.id));
  const allOwnerContacts = contacts.filter((c) => {
    // Contacts that belong to the owner firm (Xponance) — potential analysts
    // who don't currently have any coverage assignments.
    return !analystContactIds.has(c.id);
  });

  // ── Footer with page numbers ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text("Weekly Analyst Coverage Report", margin, pageH - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
  }

  const filename = `weekly-coverage-report_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}