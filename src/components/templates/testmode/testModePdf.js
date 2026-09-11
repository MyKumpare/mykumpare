/**
 * PDF export for the Scoring Matrix Test Mode sandbox.
 *
 * Exports the in-memory test scores (nothing persisted) as a formatted PDF
 * report that mirrors the production scorecard layout: header, weighted
 * totals summary (including bonus/penalty aggregate), the full scoring table
 * across all active phases, a bonus/penalty detail section, and the overall
 * rating (pass/fail + rating label) when configured.
 */
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { drawMyKumpareBranding, drawReportHeader, preloadMyKumpareLogo } from "@/components/reports/reportBranding";
import { computeWeightedScoreMulti, effectiveAdjustedPrimary, effectiveFinalScore } from "@/components/templates/scoringWeightLogic";
import { computeBonusPenaltyTotal, formatScoreValue, getOverallRating } from "@/components/templates/testmode/testModeUtils";

const INK_RGB = [31, 41, 55];
const MUTED_RGB = [120, 128, 140];
const BORDER_RGB = [226, 232, 240];
const BLOCK_BG_RGB = [243, 244, 246];
const BONUS_RGB = [22, 101, 52];   // green-800
const PENALTY_RGB = [153, 27, 27]; // red-800
const TEST_CYAN = [6, 182, 212];

/**
 * @param {object} opts
 * @param {object} opts.score       - The mock score record from buildMockScore
 * @param {object} opts.template    - The Template record (for bonus/penalty guidance)
 * @param {object} opts.templateCriteria - Map of criterion id → template criterion
 * @param {object} opts.showFlags   - { showTeam, showAdjustedPrimary, showIC, showFinal }
 * @param {object} opts.overallRating - Result of getOverallRating()
 * @param {number} opts.weightedMax - Max possible weighted score
 */
export async function exportTestModeScoringPdf({ score, template, templateCriteria, showFlags, overallRating, weightedMax }) {
  await preloadMyKumpareLogo();

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const blocks = score.scoring_blocks || [];
  const { showTeam, showAdjustedPrimary, showIC, showFinal } = showFlags;
  const unit = score.rating_config?.unit;

  // ── Header ──
  let y = drawReportHeader(doc, {
    margin,
    title: "Scoring Matrix — Test Mode",
    subtitle: `${score.firm_name} — ${score.product_name} | Template: ${score.template_name}${score.is_closed ? " (Closed)" : ""}`,
    firmName: score.firm_name
  });

  // ── Test mode banner ──
  doc.setFillColor(207, 250, 254);
  doc.roundedRect(margin, y, pageW - 2 * margin, 22, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(TEST_CYAN[0], TEST_CYAN[1], TEST_CYAN[2]);
  doc.text("TEST MODE — Sandbox scores, nothing was saved. No manager product was affected.", margin + 8, y + 14);
  y += 30;

  // ── Metadata strip ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text(`Status: ${score.status}    Generated: ${format(new Date(), "MM/dd/yyyy HH:mm")}`, margin, y);
  y += 18;

  // ── Weighted totals summary ──
  const computeTotals = (scoreField) => {
    let getValue;
    if (scoreField === "adjusted_primary_score") {
      getValue = (crit) => {
        const s = effectiveAdjustedPrimary(crit);
        if (s == null) return null;
        return crit.bonus_penalty_active && crit.bonus_penalty_value ? s + crit.bonus_penalty_value : s;
      };
    } else if (scoreField === "final_score") {
      getValue = (crit) => {
        const s = effectiveFinalScore(crit);
        if (s == null) return null;
        return crit.bonus_penalty_active && crit.bonus_penalty_value ? s + crit.bonus_penalty_value : s;
      };
    } else {
      getValue = (crit) => {
        let s = crit[scoreField];
        if (s == null) return null;
        return crit.bonus_penalty_active && crit.bonus_penalty_value ? s + crit.bonus_penalty_value : s;
      };
    }
    const val = computeWeightedScoreMulti(blocks, scoreField, { mode: "perCriterion", getValue });
    return val != null ? Number(val).toFixed(2) : "—";
  };

  const summaryItems = [
    { label: "Primary", value: computeTotals("primary_score"), color: [59, 130, 246] }
  ];
  if (showTeam) summaryItems.push({ label: "Team Rec.", value: computeTotals("team_score"), color: [245, 158, 11] });
  if (showAdjustedPrimary) summaryItems.push({ label: "Adj. Primary", value: computeTotals("adjusted_primary_score"), color: [139, 92, 246] });
  if (showIC) summaryItems.push({ label: "IC Rec.", value: computeTotals("ic_score"), color: [236, 72, 153] });
  if (showFinal) summaryItems.push({ label: "Final", value: computeTotals("final_score"), color: [16, 185, 129] });

  // Bonus/penalty aggregate
  const bpTotal = computeBonusPenaltyTotal(blocks);
  let adjustmentCount = 0;
  blocks.forEach((b) => (b.criteria || []).forEach((c) => {
    if (c.bonus_penalty_active && c.bonus_penalty_value) adjustmentCount++;
  }));
  summaryItems.push({
    label: "Bonus/Penalty",
    value: adjustmentCount > 0 ? `${bpTotal > 0 ? "+" : ""}${bpTotal.toFixed(1)} (${adjustmentCount})` : "—",
    color: bpTotal > 0 ? BONUS_RGB : bpTotal < 0 ? PENALTY_RGB : MUTED_RGB
  });

  // Total max score (the maximum achievable weighted score)
  summaryItems.push({
    label: "Total Max Score",
    value: weightedMax > 0 ? formatScoreValue(weightedMax, unit) : "—",
    color: [79, 70, 229]
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
    doc.setFontSize(13);
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(String(stat.value), x + 8, y + 34);
  });
  y += 54;

  // ── Overall rating (pass/fail + rating label) ──
  if (overallRating?.hasConfig) {
    const ratingItems = [];
    if (overallRating.passFail) {
      ratingItems.push({
        label: "Pass/Fail",
        value: overallRating.passFail,
        color: overallRating.passFail === "Pass" ? BONUS_RGB : PENALTY_RGB
      });
    }
    if (overallRating.ratingLabel) {
      ratingItems.push({
        label: "Rating",
        value: overallRating.ratingLabel,
        color: overallRating.ratingColor ? hexToRgb(overallRating.ratingColor) : INK_RGB
      });
    }
    if (overallRating.weightedScore != null) {
      ratingItems.push({
        label: "Weighted Score",
        value: Number(overallRating.weightedScore).toFixed(2),
        color: INK_RGB
      });
    }
    const rStatW = (pageW - 2 * margin - (ratingItems.length - 1) * 6) / ratingItems.length;
    ratingItems.forEach((stat, i) => {
      const x = margin + i * (rStatW + 6);
      doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
      doc.setFillColor(250, 250, 252);
      doc.roundedRect(x, y, rStatW, 32, 4, 4, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
      doc.text(stat.label, x + 8, y + 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
      doc.text(String(stat.value), x + 8, y + 26);
    });
    y += 40;
  }

  // ── Scoring table ──
  const colCriterion = 150;
  const colScore = 34;
  const colBonus = 50;
  const scoreCols = [];
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
    doc.text("Bonus/Pen.", x + colBonus / 2 - 16, y + 14); x += colBonus;
    doc.text("Notes", x + 4, y + 14);
    y += 22;
  };

  drawTableHeader();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  const drawScoreCell = (scoreVal, cx) => {
    if (scoreVal == null) {
      doc.setTextColor(203, 213, 225);
      doc.text("—", cx + colScore / 2 - 3, y + 14);
      return;
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

  const resolveScore = (crit, key) => {
    if (key === "adjusted_primary_score") return effectiveAdjustedPrimary(crit);
    if (key === "final_score") return effectiveFinalScore(crit);
    return crit[key];
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
    let blockLabel = `${block.name} (${block.weight}%)`;
    if (block.multiplier_enabled && block.multiplier !== 1) blockLabel += ` ×${block.multiplier}`;
    doc.text(blockLabel, margin + 6, y + 12);
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

      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, pageW - 2 * margin, 20, "F");

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
      drawScoreCell(crit.primary_score, cx); cx += colScore;
      scoreCols.forEach((c) => {
        drawScoreCell(resolveScore(crit, c.key), cx);
        cx += colScore;
      });
      drawBonusCell(crit, cx); cx += colBonus;
      drawNotes(crit);

      y += 20;
      doc.setDrawColor(243, 244, 246);
      doc.line(margin, y, pageW - margin, y);
    });
  });

  // ── Bonus/Penalty detail section (all enabled criteria with dropdown options) ──
  const bpEntries = [];
  blocks.forEach((b) => (b.criteria || []).forEach((c) => {
    const tc = templateCriteria[c.id] || c;
    if (!tc.bonus_penalty_enabled) return;
    const direction = tc.bonus_penalty_direction || c.bonus_penalty_direction || "penalty";
    const range = tc.bonus_penalty_range || c.bonus_penalty_range || null;
    const levels = tc.bonus_penalty_levels || c.bonus_penalty_levels || [];
    const guidance = tc.bonus_penalty_guidance || c.bonus_penalty_guidance || "";
    const isActive = !!(c.bonus_penalty_active && c.bonus_penalty_value);
    bpEntries.push({
      criterion: c.name || `#${c.number}`,
      block: b.name,
      direction,
      range,
      levels,
      guidance,
      step: tc.bonus_penalty_step || c.bonus_penalty_step,
      isActive,
      value: c.bonus_penalty_value,
      notes: c.bonus_penalty_notes || c.primary_notes || ""
    });
  }));

  if (bpEntries.length > 0) {
    if (y > pageH - 140) {
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

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    bpEntries.forEach((entry) => {
      if (y > pageH - 80) {
        drawMyKumpareBranding(doc);
        doc.addPage();
        y = margin + 10;
      }

      const dirColor = entry.direction === "bonus" ? BONUS_RGB : PENALTY_RGB;
      const dirLabel = entry.direction === "bonus" ? "BONUS" : "PENALTY";

      // Row 1: criterion + block + direction badge + applied value
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const critLines = doc.splitTextToSize(entry.criterion, 200);
      doc.text(critLines[0], margin + 4, y + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
      doc.text(entry.block, margin + 210, y + 10);

      // Direction badge
      doc.setFillColor(dirColor[0], dirColor[1], dirColor[2]);
      doc.roundedRect(margin + 300, y + 2, 52, 13, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(dirLabel, margin + 306, y + 11);

      // Applied value or "not applied"
      if (entry.isActive) {
        doc.setFillColor(dirColor[0], dirColor[1], dirColor[2]);
        doc.roundedRect(margin + 360, y + 2, 50, 13, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${entry.value > 0 ? "+" : ""}${entry.value}`, margin + 368, y + 11);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(203, 213, 225);
        doc.text("not applied", margin + 366, y + 11);
      }
      y += 16;

      // Row 2: range + dropdown options
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
      let rangeLabel = "Range: —";
      if (entry.range && (entry.range.min != null || entry.range.max != null)) {
        const min = entry.direction === "penalty" ? (entry.range.min ?? 0) : (entry.range.min ?? 0);
        const max = entry.direction === "bonus" ? (entry.range.max ?? 0) : (entry.range.max ?? 0);
        rangeLabel = `Range: ${min} to ${max}`;
      }
      if (entry.step) rangeLabel += `  (step ${entry.step})`;
      doc.text(rangeLabel, margin + 4, y + 10);

      // Dropdown options (levels)
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("Options:", margin + 160, y + 10);
      doc.setFont("helvetica", "normal");
      const optsText = entry.levels.length > 0
        ? entry.levels.map((lv) => `${lv.level > 0 ? "+" : ""}${lv.level}${lv.text ? ` (${lv.text})` : ""}`).join("  |  ")
        : "— (no levels generated)";
      const optsLines = doc.splitTextToSize(optsText, pageW - margin - 215);
      doc.setTextColor(107, 114, 128);
      doc.text(optsLines[0] || "—", margin + 200, y + 10);
      y += 12;
      optsLines.slice(1, 3).forEach((line) => {
        if (y > pageH - 60) { drawMyKumpareBranding(doc); doc.addPage(); y = margin + 10; }
        doc.text(line, margin + 200, y + 10);
        y += 9;
      });

      // Row 3: guidance
      if (entry.guidance) {
        if (y > pageH - 60) { drawMyKumpareBranding(doc); doc.addPage(); y = margin + 10; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
        doc.text("Guidance:", margin + 4, y + 10);
        doc.setFont("helvetica", "normal");
        const guideLines = doc.splitTextToSize(entry.guidance, pageW - margin - 70);
        doc.setTextColor(107, 114, 128);
        doc.text(guideLines[0] || "", margin + 60, y + 10);
        y += 9;
        guideLines.slice(1, 2).forEach((line) => {
          if (y > pageH - 60) { drawMyKumpareBranding(doc); doc.addPage(); y = margin + 10; }
          doc.text(line, margin + 60, y + 10);
          y += 9;
        });
      }

      // Row 4: justification (if applied)
      if (entry.isActive && entry.notes) {
        if (y > pageH - 60) { drawMyKumpareBranding(doc); doc.addPage(); y = margin + 10; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
        doc.text("Justification:", margin + 4, y + 10);
        doc.setFont("helvetica", "normal");
        const noteLines = doc.splitTextToSize(entry.notes, pageW - margin - 80);
        doc.setTextColor(107, 114, 128);
        doc.text(noteLines[0] || "", margin + 70, y + 10);
        y += 9;
      }

      y += 6;
      doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
    });
  }

  // ── Footer branding ──
  drawMyKumpareBranding(doc);

  const dateStr = format(new Date(), "yyyy-MM-dd");
  const fileName = `TestMode_Scorecard_${(score.firm_name || "Firm").replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.pdf`;
  doc.save(fileName);
}

/** Convert a hex color string (#rrggbb) to an [r, g, b] array. */
function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return INK_RGB;
  const h = hex.replace("#", "");
  if (h.length !== 6) return INK_RGB;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16)
  ];
}