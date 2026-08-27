import { jsPDF } from "jspdf";
import { drawMyKumpareBranding, drawReportHeader, preloadMyKumpareLogo } from "@/components/reports/reportBranding";
import { format } from "date-fns";

const SCORE_COLORS_HEX = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e"
};

/**
 * Exports a ScoringMatrixComparisonTable as a PDF.
 *
 * @param {object} opts
 * @param {object} opts.score - The ScoringMatrixScore record
 * @param {array}  opts.blocks - scoring_blocks array
 * @param {object} opts.showFlags - { showSecondary, showTeam, showAdjustedPrimary, showIC, showFinal }
 */
export async function exportScoringMatrixComparisonPdf({ score, blocks, showFlags }) {
  // Ensure logo is loaded for branding
  await preloadMyKumpareLogo();

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const { showSecondary, showTeam, showAdjustedPrimary, showIC, showFinal } = showFlags;

  // ── Header ──
  let y = drawReportHeader(doc, {
    margin,
    title: "Scoring Matrix Comparison",
    subtitle: `${score.firm_name} — ${score.product_name} | Template: ${score.template_name} | Version v${score.version_number || 1}${score.is_closed ? " (Closed)" : ""}`,
    firmName: score.firm_name
  });

  // ── Scoring period ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120, 128, 140);
  const periodText = `Scoring Period: ${score.scoring_start_date || "—"} → ${score.scoring_end_date || "In Progress"}  |  Status: ${score.status}${score.primary_analyst_name ? `  |  Analyst: ${score.primary_analyst_name}` : ""}`;
  doc.text(periodText, margin, y);
  y += 16;

  // ── Summary stats ──
  const allCriteria = [];
  blocks.forEach((block) => {
    (block.criteria || []).forEach((crit) => {
      allCriteria.push({ ...crit, blockName: block.name, blockWeight: block.weight });
    });
  });

  let totalCriteria = allCriteria.length;
  let withDeviations = 0;
  let maxDeviation = 0;
  allCriteria.forEach((crit) => {
    const finalScore = crit.final_score;
    const scores = [crit.primary_score, crit.team_score, crit.ic_score, crit.adjusted_primary_score].filter((s) => s != null && finalScore != null);
    const maxDiff = Math.max(...scores.map((s) => Math.abs(s - finalScore)), 0);
    if (maxDiff >= 2) withDeviations++;
    if (maxDiff > maxDeviation) maxDeviation = maxDiff;
  });

  // Stats cards
  const statW = (pageW - 2 * margin - 2 * 8) / 3;
  const stats = [
    { label: "Total Criteria", value: totalCriteria, color: [59, 130, 246] },
    { label: "Significant Deviations (≥2)", value: withDeviations, color: [245, 158, 11] },
    { label: "Max Deviation", value: `${maxDeviation} pt${maxDeviation !== 1 ? "s" : ""}`, color: [139, 92, 246] }
  ];
  stats.forEach((stat, i) => {
    const x = margin + i * (statW + 8);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, statW, 44, 4, 4, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 128, 140);
    doc.text(stat.label, x + 10, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(String(stat.value), x + 10, y + 36);
  });
  y += 56;

  // ── Comparison table ──
  // Column setup
  const colWidths = { criterion: 200 };
  const dynamicCols = [];
  if (showSecondary) dynamicCols.push("secondary");
  if (showTeam) dynamicCols.push("team");
  if (showAdjustedPrimary) dynamicCols.push("adjusted");
  if (showIC) dynamicCols.push("ic");
  if (showFinal) dynamicCols.push("final");
  dynamicCols.push("status");

  const availableWidth = pageW - 2 * margin - colWidths.criterion;
  const colW = availableWidth / dynamicCols.length;
  dynamicCols.forEach((col) => { colWidths[col] = colW; });

  // Table header
  const headerH = 24;
  doc.setFillColor(249, 250, 251);
  doc.rect(margin, y, pageW - 2 * margin, headerH, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + headerH, pageW - margin, y + headerH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);

  let x = margin + 4;
  doc.text("Criterion", x, y + 16);
  x += colWidths.criterion;
  if (showSecondary) { doc.text("Secondary", x + colW/2 - 12, y + 16); x += colW; }
  if (showTeam) { doc.text("Team", x + colW/2 - 8, y + 16); x += colW; }
  if (showAdjustedPrimary) { doc.text("Adj. Primary", x + colW/2 - 16, y + 16); x += colW; }
  if (showIC) { doc.text("IC", x + colW/2 - 4, y + 16); x += colW; }
  if (showFinal) { doc.text("Final", x + colW/2 - 8, y + 16); x += colW; }
  doc.text("Status", x + 4, y + 16);

  y += headerH;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  blocks.forEach((block) => {
    // Block header row
    if (y > pageH - 80) {
      drawMyKumpareBranding(doc);
      doc.addPage();
      y = margin + 10;
    }

    doc.setFillColor(243, 244, 246);
    doc.rect(margin, y, pageW - 2 * margin, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(55, 65, 81);
    doc.text(`${block.name} (${block.weight}%)`, margin + 6, y + 14);
    y += 20;

    (block.criteria || []).forEach((crit) => {
      if (y > pageH - 60) {
        drawMyKumpareBranding(doc);
        doc.addPage();
        y = margin + 10;
      }

      const finalScore = crit.final_score;
      const allScores = [crit.primary_score, crit.team_score, crit.ic_score, crit.adjusted_primary_score].filter((s) => s != null);
      const hasSignificantDeviation = finalScore != null && allScores.some((s) => Math.abs(s - finalScore) >= 2);
      const hasAnyDeviation = finalScore != null && allScores.some((s) => s !== finalScore);

      // Row background
      if (hasSignificantDeviation) {
        doc.setFillColor(255, 251, 235);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(margin, y, pageW - 2 * margin, 22, "F");

      // Criterion name
      doc.setFont("helvetica", "normal");
      doc.setTextColor(31, 41, 55);
      doc.text(crit.name || "", margin + 6, y + 14);
      if (crit.category) {
        doc.setFontSize(6.5);
        doc.setTextColor(156, 163, 175);
        doc.text(crit.category, margin + 6, y + 20);
        doc.setFontSize(8);
      }

      // Score cells
      const drawScore = (score, cx, baseScore) => {
        if (score == null) {
          doc.setTextColor(203, 213, 225);
          doc.text("—", cx + colW/2 - 3, y + 14);
          return;
        }
        // Deviation shading
        if (baseScore != null && score !== baseScore) {
          const diff = score - baseScore;
          const intensity = Math.min(Math.abs(diff) / 4, 1);
          const alpha = 0.12 + intensity * 0.35;
          if (diff > 0) {
            doc.setFillColor(34, 197, 94, Math.round(alpha * 255));
          } else {
            doc.setFillColor(239, 68, 68, Math.round(alpha * 255));
          }
          doc.rect(cx + 2, y + 3, colW - 4, 16, "F");
        }
        doc.setTextColor(31, 41, 55);
        doc.setFont("helvetica", "bold");
        doc.text(String(score), cx + colW/2 - 3, y + 14);
        doc.setFont("helvetica", "normal");
      };

      let cx = margin + colWidths.criterion;
      // Primary
      drawScore(crit.primary_score, cx, finalScore); cx += colW;
      if (showSecondary) { drawScore(crit.secondary_score, cx, finalScore); cx += colW; }
      if (showTeam) { drawScore(crit.team_score, cx, finalScore); cx += colW; }
      if (showAdjustedPrimary) { drawScore(crit.adjusted_primary_score, cx, finalScore); cx += colW; }
      if (showIC) { drawScore(crit.ic_score, cx, finalScore); cx += colW; }
      if (showFinal) {
        doc.setFillColor(239, 246, 255);
        doc.rect(cx + 2, y + 3, colW - 4, 16, "F");
        drawScore(crit.final_score, cx, null); cx += colW;
      }

      // Status
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      if (hasSignificantDeviation) {
        doc.setTextColor(180, 83, 9);
        doc.text("⚠ Review", cx + 4, y + 14);
      } else if (hasAnyDeviation) {
        doc.setTextColor(37, 99, 235);
        doc.text("~ Minor", cx + 4, y + 14);
      } else {
        doc.setTextColor(22, 163, 74);
        doc.text("✓ Aligned", cx + 4, y + 14);
      }
      doc.setFontSize(8);

      y += 22;
      doc.setDrawColor(239, 241, 245);
      doc.line(margin, y, pageW - margin, y);
    });
  });

  // ── Footer with branding ──
  drawMyKumpareBranding(doc);

  // ── Save ──
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const fileName = `Scoring_Matrix_${(score.product_name || "Product").replace(/[^a-zA-Z0-9]/g, "_")}_v${score.version_number || 1}_${dateStr}.pdf`;
  doc.save(fileName);
}