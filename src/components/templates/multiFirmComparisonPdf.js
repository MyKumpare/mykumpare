import { jsPDF } from "jspdf";
import { drawMyKumpareBranding, drawReportHeader, preloadMyKumpareLogo } from "@/components/reports/reportBranding";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { computeWeightedScoreMulti } from "@/components/templates/scoringWeightLogic";

const SCORE_COLORS_HEX = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e"
};

/** Block-weighted average of per-criterion final_score values, honoring
 *  optional block/criterion multiplier factors (normalized to 100% total). */
function computeWeightedFinal(score) {
  const val = computeWeightedScoreMulti(score.scoring_blocks || [], "final_score", {
    applyBonusPenalty: true,
    mode: "blockAvg"
  });
  return val == null ? null : Math.round(val * 100) / 100;
}

/**
 * Generates a unified PDF comparing multiple firms' scoring matrix scores and
 * qualitative review notes. Fetches the full ScoringMatrixScore records for the
 * given score IDs, ranks them by weighted final score, builds a summary table,
 * a per-criterion comparison matrix (when all firms share the same template),
 * and a per-firm review-notes section.
 *
 * @param {object} opts
 * @param {array}  opts.scores - array of full ScoringMatrixScore records
 */
export async function exportMultiFirmComparisonPdf({ scores }) {
  await preloadMyKumpareLogo();

  if (!scores || scores.length === 0) return;

  // Rank firms by weighted final score (desc).
  const ranked = scores
    .map((s) => ({ score: s, weighted: computeWeightedFinal(s) ?? 0 }))
    .sort((a, b) => b.weighted - a.weighted);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // ── Header ──
  let y = drawReportHeader(doc, {
    margin,
    title: "Multi-Firm Scoring Comparison",
    subtitle: `${ranked.length} firm${ranked.length !== 1 ? "s" : ""} compared · Generated ${format(new Date(), "MMM d, yyyy")}`
  });

  // ── Summary ranking table ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text("Ranked Summary", margin, y);
  y += 8;

  const sumCols = [
    { key: "rank", label: "#", w: 28 },
    { key: "firm", label: "Firm", w: 160 },
    { key: "product", label: "Product", w: 150 },
    { key: "template", label: "Template", w: 130 },
    { key: "version", label: "Ver", w: 36 },
    { key: "weighted", label: "Weighted Final", w: 70 },
    { key: "status", label: "Status", w: 70 }
  ];
  const sumTableW = sumCols.reduce((s, c) => s + c.w, 0);
  const headerH = 22;

  const drawSummaryHeader = (yy) => {
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yy, sumTableW, headerH, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, yy + headerH, margin + sumTableW, yy + headerH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    let xx = margin + 4;
    sumCols.forEach((c) => {
      doc.text(c.label, xx, yy + 14);
      xx += c.w;
    });
    return yy + headerH;
  };

  y = drawSummaryHeader(y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ranked.forEach((entry, i) => {
    if (y > pageH - 60) {
      drawMyKumpareBranding(doc);
      doc.addPage();
      y = margin + 10;
      y = drawSummaryHeader(y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }
    const s = entry.score;
    // Alternating row background
    if (i % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, sumTableW, 20, "F");
    }
    let xx = margin + 4;
    doc.setTextColor(120, 128, 140);
    doc.text(String(i + 1), xx, y + 13); xx += sumCols[0].w;
    doc.setTextColor(31, 41, 55);
    doc.setFont("helvetica", "bold");
    doc.text(String(s.firm_name || "—").slice(0, 26), xx, y + 13); xx += sumCols[1].w;
    doc.setFont("helvetica", "normal");
    doc.text(String(s.product_name || "—").slice(0, 24), xx, y + 13); xx += sumCols[2].w;
    doc.text(String(s.template_name || "—").slice(0, 22), xx, y + 13); xx += sumCols[3].w;
    doc.text(`v${s.version_number || 1}`, xx, y + 13); xx += sumCols[4].w;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246);
    doc.text(entry.weighted.toFixed(2), xx, y + 13); xx += sumCols[5].w;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 41, 55);
    doc.text(String(s.status || "—"), xx, y + 13);
    y += 20;
    doc.setDrawColor(239, 241, 245);
    doc.line(margin, y, margin + sumTableW, y);
  });
  y += 16;

  // ── Per-criterion comparison matrix (only if all firms share the same template) ──
  const templateIds = [...new Set(ranked.map((r) => r.score.template_id).filter(Boolean))];
  const sameTemplate = templateIds.length === 1 && ranked.length > 1;

  if (sameTemplate) {
    if (y > pageH - 100) {
      drawMyKumpareBranding(doc);
      doc.addPage();
      y = margin + 10;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text("Per-Criterion Final Score Comparison", margin, y);
    y += 8;

    // Build the unified criteria list from the first score's blocks.
    const refBlocks = ranked[0].score.scoring_blocks || [];
    const firmCount = ranked.length;
    const firmColW = 46;
    const critColW = 180;
    const matrixW = critColW + firmCount * firmColW;

    const drawMatrixHeader = (yy) => {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, yy, matrixW, headerH, "F");
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, yy + headerH, margin + matrixW, yy + headerH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text("Criterion", margin + 4, yy + 14);
      let xx = margin + critColW;
      ranked.forEach((entry) => {
        doc.text(String(entry.score.firm_name || "—").slice(0, 10), xx + 4, yy + 14);
        xx += firmColW;
      });
      return yy + headerH;
    };

    y = drawMatrixHeader(y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    refBlocks.forEach((block) => {
      if (y > pageH - 60) {
        drawMyKumpareBranding(doc);
        doc.addPage();
        y = margin + 10;
        y = drawMatrixHeader(y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }
      // Block header row
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y, matrixW, 18, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(55, 65, 81);
      doc.text(`${block.name} (${block.weight}%)`, margin + 4, y + 12);
      y += 18;

      (block.criteria || []).forEach((crit) => {
        if (y > pageH - 50) {
          drawMyKumpareBranding(doc);
          doc.addPage();
          y = margin + 10;
          y = drawMatrixHeader(y);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
        }
        // Collect final scores per firm for this criterion (match by criterion id).
        const firmScores = ranked.map((entry) => {
          const blk = (entry.score.scoring_blocks || []).find((b) => b.id === block.id);
          const c = (blk?.criteria || []).find((cc) => cc.id === crit.id);
          return c?.final_score;
        });
        const validScores = firmScores.filter((s) => s != null);
        const maxScore = validScores.length ? Math.max(...validScores) : null;

        doc.setFillColor(255, 255, 255);
        doc.rect(margin, y, matrixW, 18, "F");
        doc.setFont("helvetica", "normal");
        doc.setTextColor(31, 41, 55);
        doc.text(String(crit.name || "").slice(0, 32), margin + 4, y + 12);
        let xx = margin + critColW;
        firmScores.forEach((sc) => {
          if (sc == null) {
            doc.setTextColor(203, 213, 225);
            doc.text("—", xx + 4, y + 12);
          } else {
            // Highlight the highest score in green bold.
            if (maxScore != null && sc === maxScore) {
              doc.setFont("helvetica", "bold");
              doc.setTextColor(22, 163, 74);
            } else {
              doc.setFont("helvetica", "normal");
              doc.setTextColor(31, 41, 55);
            }
            doc.text(String(sc), xx + 4, y + 12);
            doc.setFont("helvetica", "normal");
          }
          xx += firmColW;
        });
        y += 18;
        doc.setDrawColor(239, 241, 245);
        doc.line(margin, y, margin + matrixW, y);
      });
    });
    y += 14;
  }

  // ── Per-firm review notes ──
  ranked.forEach((entry, i) => {
    if (y > pageH - 90) {
      drawMyKumpareBranding(doc);
      doc.addPage();
      y = margin + 10;
    }
    const s = entry.score;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text(`${i + 1}. ${s.firm_name || "—"}`, margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 128, 140);
    doc.text(
      `${s.product_name || "—"} · ${s.template_name || "—"} · v${s.version_number || 1} · Weighted Final: ${entry.weighted.toFixed(2)} · Status: ${s.status || "—"}`,
      margin, y + 8
    );
    y += 16;

    // Scoring period + analyst
    doc.setTextColor(120, 128, 140);
    const period = `Scoring Period: ${s.scoring_start_date || "—"} → ${s.scoring_end_date || "In Progress"}${s.primary_analyst_name ? `  |  Analyst: ${s.primary_analyst_name}` : ""}`;
    doc.text(period, margin, y);
    y += 14;

    // Review notes
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    doc.text("Review Notes:", margin, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
    const notes = (s.review_notes || "").trim();
    if (notes) {
      const notesLines = doc.splitTextToSize(notes, pageW - 2 * margin);
      notesLines.forEach((line) => {
        if (y > pageH - 50) {
          drawMyKumpareBranding(doc);
          doc.addPage();
          y = margin + 10;
        }
        doc.text(line, margin, y);
        y += 12;
      });
    } else {
      doc.setTextColor(156, 163, 175);
      doc.text("(No qualitative notes recorded)", margin, y);
    }
    y += 18;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  });

  // ── Footer branding on all pages ──
  drawMyKumpareBranding(doc);

  const dateStr = format(new Date(), "yyyy-MM-dd");
  const fileName = `Multi_Firm_Comparison_${dateStr}.pdf`;
  doc.save(fileName);
}

/**
 * Convenience wrapper: fetches full ScoringMatrixScore records for the given
 * score IDs, then generates the PDF.
 *
 * @param {array} scoreIds - array of ScoringMatrixScore IDs
 */
export async function exportMultiFirmComparisonByIds(scoreIds) {
  if (!scoreIds || scoreIds.length === 0) return;
  const scores = await Promise.all(
    scoreIds.map((id) => base44.entities.ScoringMatrixScore.get(id))
  );
  await exportMultiFirmComparisonPdf({ scores });
}