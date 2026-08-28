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

const INK_RGB = [31, 41, 55];
const MUTED_RGB = [120, 128, 140];
const BORDER_RGB = [226, 232, 240];
const BLOCK_BG_RGB = [243, 244, 246];
const BONUS_RGB = [22, 101, 52];   // green-800
const PENALTY_RGB = [153, 27, 27]; // red-800

function clampScore(s) {
  if (s == null) return null;
  return Math.max(1, Math.min(5, s));
}

/**
 * Exports an individual firm scorecard as a clean, formatted PDF report.
 * Includes the full scoring matrix with bonus/penalty adjustments, notes,
 * weighted totals, and a dedicated bonus/penalty summary section.
 *
 * @param {object} opts
 * @param {object} opts.score - The ScoringMatrixScore record
 * @param {array}  opts.blocks - scoring_blocks array
 * @param {object} opts.template - The Template record (for bonus/penalty guidance)
 * @param {object} opts.showFlags - { showSecondary, showTeam, showAdjustedPrimary, showIC, showFinal }
 */
export async function exportScoringMatrixScorecardPdf({ score, blocks, template, showFlags }) {
  await preloadMyKumpareLogo();

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const { showSecondary, showTeam, showAdjustedPrimary, showIC, showFinal } = showFlags;

  // Template criteria lookup (for bonus/penalty guidance/range)
  const templateCriteria = {};
  (template?.scoring_blocks || []).forEach((block) => {
    (block.criteria || []).forEach((c) => { templateCriteria[c.id] = c; });
  });

  // ── Header ──
  let y = drawReportHeader(doc, {
    margin,
    title: "Firm Scorecard",
    subtitle: `${score.firm_name} — ${score.product_name} | Template: ${score.template_name} | Version v${score.version_number || 1}${score.is_closed ? " (Closed)" : ""}`,
    firmName: score.firm_name
  });

  // ── Metadata strip ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  const periodText = `Scoring Period: ${score.scoring_start_date || "—"} → ${score.scoring_end_date || "In Progress"}    Status: ${score.status}${score.primary_analyst_name ? `    Primary Analyst: ${score.primary_analyst_name}` : ""}${score.secondary_analyst_name && showSecondary ? `    Secondary: ${score.secondary_analyst_name} (${score.secondary_scoring_status})` : ""}`;
  doc.text(periodText, margin, y);
  y += 18;

  // ── Weighted totals summary ──
  const computeTotals = (scoreField) => {
    let total = 0, totalWeight = 0;
    blocks.forEach((block) => {
      const blockWeight = (block.weight || 0) / 100;
      (block.criteria || []).forEach((crit) => {
        let s = crit[scoreField];
        if (s != null) {
          if (scoreField === "final_score" && crit.bonus_penalty_active && crit.bonus_penalty_value) {
            s = clampScore(s + crit.bonus_penalty_value);
          }
          total += s * blockWeight;
          totalWeight += blockWeight;
        }
      });
    });
    return totalWeight > 0 ? (total / totalWeight).toFixed(2) : "—";
  };

  const summaryItems = [
    { label: "Primary", value: computeTotals("primary_score"), color: [59, 130, 246] }
  ];
  if (showSecondary) summaryItems.push({ label: "Secondary", value: computeTotals("secondary_score"), color: [99, 102, 241] });
  if (showTeam) summaryItems.push({ label: "Team Rec.", value: computeTotals("team_score"), color: [245, 158, 11] });
  if (showAdjustedPrimary) summaryItems.push({ label: "Adj. Primary", value: computeTotals("adjusted_primary_score"), color: [139, 92, 246] });
  if (showIC) summaryItems.push({ label: "IC Rec.", value: computeTotals("ic_score"), color: [236, 72, 153] });
  if (showFinal) summaryItems.push({ label: "Final", value: computeTotals("final_score"), color: [16, 185, 129] });

  // Bonus/penalty aggregate
  let totalAdjustment = 0, adjustmentCount = 0;
  blocks.forEach((b) => (b.criteria || []).forEach((c) => {
    if (c.bonus_penalty_active && c.bonus_penalty_value) {
      totalAdjustment += c.bonus_penalty_value;
      adjustmentCount++;
    }
  }));
  summaryItems.push({
    label: "Bonus/Penalty",
    value: adjustmentCount > 0 ? `${totalAdjustment > 0 ? "+" : ""}${totalAdjustment.toFixed(1)} (${adjustmentCount})` : "—",
    color: totalAdjustment > 0 ? BONUS_RGB : totalAdjustment < 0 ? PENALTY_RGB : MUTED_RGB
  });

  const statW = (pageW - 2 * margin - (summaryItems.length - 1) * 6) / summaryItems.length;
  summaryItems.forEach((stat, i) => {
    const x = margin + i * (statW + 6);
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, statW, 42, 4, 4, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(stat.label, x + 8, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(String(stat.value), x + 8, y + 34);
  });
  y += 54;

  // ── Scoring table ──
  // Column widths (portrait letter ~ 612pt wide, content ~ 532pt)
  const colCriterion = 150;
  const colScore = 34;
  const colBonus = 50;
  const colNotes = pageW - 2 * margin - colCriterion - colBonus;
  // dynamic score columns
  const scoreCols = [];
  if (showSecondary) scoreCols.push({ key: "secondary_score", label: "Sec" });
  if (showTeam) scoreCols.push({ key: "team_score", label: "Team" });
  if (showAdjustedPrimary) scoreCols.push({ key: "adjusted_primary_score", label: "Adj" });
  if (showIC) scoreCols.push({ key: "ic_score", label: "IC" });
  if (showFinal) scoreCols.push({ key: "final_score", label: "Final" });

  const notesColStart = margin + colCriterion + (1 + scoreCols.length) * colScore + colBonus;

  const drawTableHeader = () => {
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, y, pageW - 2 * margin, 22, "F");
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.line(margin, y + 22, pageW - margin, y + 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99);
    let x = margin + 4;
    doc.text("Criterion", x, y + 14);
    x += colCriterion;
    doc.text("Prim", x + colScore / 2 - 6, y + 14); x += colScore;
    scoreCols.forEach((c) => { doc.text(c.label, x + colScore / 2 - 6, y + 14); x += colScore; });
    if (showFinal) {
      doc.text("Bonus/Pen.", x + colBonus / 2 - 16, y + 14); x += colBonus;
    } else {
      x += colBonus;
    }
    doc.text("Notes", x + 4, y + 14);
    y += 22;
  };

  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const drawScoreCell = (scoreVal, cx, isFinal) => {
    if (scoreVal == null) {
      doc.setTextColor(203, 213, 225);
      doc.text("—", cx + colScore / 2 - 3, y + 14);
      return;
    }
    if (isFinal) {
      doc.setFillColor(239, 246, 255);
      doc.rect(cx + 1, y + 2, colScore - 2, 18, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(String(scoreVal), cx + colScore / 2 - 3, y + 14);
    doc.setFont("helvetica", "normal");
  };

  const drawBonusCell = (crit, cx) => {
    if (!crit.bonus_penalty_active || !crit.bonus_penalty_value) {
      doc.setTextColor(203, 213, 225);
      doc.text("—", cx + colBonus / 2 - 3, y + 14);
      return;
    }
    const v = crit.bonus_penalty_value;
    const color = v > 0 ? BONUS_RGB : v < 0 ? PENALTY_RGB : MUTED_RGB;
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(cx + 4, y + 3, colBonus - 8, 16, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${v > 0 ? "+" : ""}${v}`, cx + colBonus / 2 - 8, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
  };

  const drawNotes = (crit) => {
    const notes = crit.final_notes || crit.adjusted_primary_notes || crit.ic_notes || crit.team_notes || crit.primary_notes || "";
    if (!notes) {
      doc.setTextColor(203, 213, 225);
      doc.text("—", notesColStart + 4, y + 14);
      return;
    }
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(7);
    const maxW = pageW - margin - notesColStart - 4;
    const lines = doc.splitTextToSize(notes, maxW);
    const maxLines = 2;
    lines.slice(0, maxLines).forEach((line, i) => {
      doc.text(line, notesColStart + 4, y + 12 + i * 9);
    });
    if (lines.length > maxLines) {
      doc.setTextColor(156, 163, 175);
      doc.text("…", notesColStart + 4 + doc.getTextWidth(lines[maxLines - 1]) + 2, y + 12 + (maxLines - 1) * 9);
    }
    doc.setFontSize(8);
  };

  blocks.forEach((block) => {
    if (y > pageH - 80) {
      drawMyKumpareBranding(doc);
      doc.addPage();
      y = margin + 10;
      drawTableHeader();
    }

    // Block header
    doc.setFillColor(BLOCK_BG_RGB[0], BLOCK_BG_RGB[1], BLOCK_BG_RGB[2]);
    doc.rect(margin, y, pageW - 2 * margin, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text(`${block.name} (${block.weight}%)`, margin + 6, y + 12);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    (block.criteria || []).forEach((crit) => {
      if (y > pageH - 60) {
        drawMyKumpareBranding(doc);
        doc.addPage();
        y = margin + 10;
        drawTableHeader();
      }

      // Row background
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, pageW - 2 * margin, 20, "F");

      // Criterion name
      doc.setFont("helvetica", "normal");
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.setFontSize(7.5);
      const critLines = doc.splitTextToSize(crit.name || "", colCriterion - 8);
      doc.text(critLines[0] || "", margin + 4, y + 12);
      if (crit.category) {
        doc.setFontSize(6);
        doc.setTextColor(156, 163, 175);
        doc.text(crit.category, margin + 4, y + 18);
        doc.setFontSize(8);
      }

      let cx = margin + colCriterion;
      drawScoreCell(crit.primary_score, cx, false); cx += colScore;
      scoreCols.forEach((c) => {
        drawScoreCell(crit[c.key], cx, c.key === "final_score");
        cx += colScore;
      });
      drawBonusCell(crit, cx); cx += colBonus;
      drawNotes(crit);

      y += 20;
      doc.setDrawColor(243, 244, 246);
      doc.line(margin, y, pageW - margin, y);
    });
  });

  // ── Bonus/Penalty detail section ──
  const activeAdjustments = [];
  blocks.forEach((b) => (b.criteria || []).forEach((c) => {
    if (c.bonus_penalty_active && c.bonus_penalty_value) {
      activeAdjustments.push({
        criterion: c.name || `#${c.number}`,
        block: b.name,
        value: c.bonus_penalty_value,
        notes: c.bonus_penalty_notes || "",
        guidance: templateCriteria[c.id]?.bonus_penalty_guidance || "",
        range: templateCriteria[c.id]?.bonus_penalty_range
      });
    }
  }));

  if (activeAdjustments.length > 0) {
    if (y > pageH - 120) {
      drawMyKumpareBranding(doc);
      doc.addPage();
      y = margin + 10;
    } else {
      y += 16;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text("Bonus & Penalty Adjustments", margin, y);
    y += 6;
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(75, 85, 99);
    doc.text("Criterion", margin + 4, y + 10);
    doc.text("Block", margin + 170, y + 10);
    doc.text("Adjustment", margin + 300, y + 10);
    doc.text("Justification", margin + 370, y + 10);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    activeAdjustments.forEach((adj) => {
      if (y > pageH - 60) {
        drawMyKumpareBranding(doc);
        doc.addPage();
        y = margin + 10;
      }
      const color = adj.value > 0 ? BONUS_RGB : PENALTY_RGB;
      // Criterion
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      const critLines = doc.splitTextToSize(adj.criterion, 160);
      doc.text(critLines[0], margin + 4, y + 10);
      // Block
      doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
      doc.text(adj.block, margin + 170, y + 10);
      // Adjustment pill
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(margin + 300, y + 2, 50, 14, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(`${adj.value > 0 ? "+" : ""}${adj.value}`, margin + 310, y + 12);
      doc.setFont("helvetica", "normal");
      // Notes
      doc.setTextColor(107, 114, 128);
      const noteLines = doc.splitTextToSize(adj.notes || "—", pageW - margin - 370);
      doc.text(noteLines[0] || "—", margin + 370, y + 10);
      y += Math.max(18, 10 + (critLines.length > 1 || noteLines.length > 1 ? 8 : 0));
      doc.setDrawColor(243, 244, 246);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
    });
  }

  // ── Footer branding ──
  drawMyKumpareBranding(doc);

  // ── Save ──
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const fileName = `Scorecard_${(score.firm_name || "Firm").replace(/[^a-zA-Z0-9]/g, "_")}_${(score.product_name || "Product").replace(/[^a-zA-Z0-9]/g, "_")}_v${score.version_number || 1}_${dateStr}.pdf`;
  doc.save(fileName);
}