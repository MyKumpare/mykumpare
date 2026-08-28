import { jsPDF } from "jspdf";
import { drawMyKumpareBranding, drawReportHeader, preloadMyKumpareLogo } from "@/components/reports/reportBranding";
import { format } from "date-fns";
import { computeWeightedScoreMulti } from "@/components/templates/scoringWeightLogic";

const INK_RGB = [31, 41, 55];
const MUTED_RGB = [120, 128, 140];
const BORDER_RGB = [226, 232, 240];
const BLOCK_BG_RGB = [243, 244, 246];

const SCORE_COLORS_HEX = {
  1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#84cc16", 5: "#22c55e",
};

/**
 * Exports a firm's full scoring history and the final radar chart as a PDF.
 *
 * @param {object} opts
 * @param {object} opts.firm        - Firm record
 * @param {array}  opts.scores     - ScoringMatrixScore records (sorted desc by start date)
 * @param {string} [opts.radarImgDataUrl] - PNG data URL of the radar chart (latest finalized score)
 */
export async function exportFirmScoringHistoryPdf({ firm, scores, radarImgDataUrl }) {
  await preloadMyKumpareLogo();

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  // ── Header ──
  let y = drawReportHeader(doc, {
    margin,
    title: "Firm Scoring History",
    subtitle: `${firm?.name || "—"} | ${scores.length} evaluation${scores.length !== 1 ? "s" : ""} | Generated ${format(new Date(), "MMM d, yyyy")}`,
    firmName: firm?.name,
  });

  // ── Summary stats ──
  const closedCount = scores.filter((s) => s.is_closed).length;
  const templates = new Set(scores.map((s) => s.template_name).filter(Boolean));
  const dates = scores.map((s) => s.scoring_start_date).filter(Boolean).sort();
  const dateRange = dates.length
    ? `${format(new Date(dates[0]), "MMM d, yyyy")} → ${format(new Date(dates[dates.length - 1]), "MMM d, yyyy")}`
    : "—";

  const summaryItems = [
    { label: "Total Evaluations", value: String(scores.length) },
    { label: "Finalized", value: String(closedCount) },
    { label: "Templates Used", value: String(templates.size) },
    { label: "Date Range", value: dateRange },
  ];
  const statW = (pageW - 2 * margin - (summaryItems.length - 1) * 6) / summaryItems.length;
  summaryItems.forEach((stat, i) => {
    const x = margin + i * (statW + 6);
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, statW, 38, 4, 4, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(stat.label, x + 8, y + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(String(stat.value), x + 8, y + 30);
  });
  y += 50;

  // ── Radar chart image (left) + latest scorecard detail (right) ──
  const latestFinal =
    scores.find((s) => s.is_closed && s.final_score_finalized) ||
    scores.find((s) => s.is_closed) ||
    scores[0];

  if (latestFinal) {
    const leftW = radarImgDataUrl ? Math.min(340, pageW / 2 - margin) : 0;
    let rightX = margin;
    let rightW = pageW - 2 * margin;

    if (radarImgDataUrl) {
      // Radar chart image
      try {
        const imgW = leftW;
        const imgH = 230;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
        doc.text(`Final Radar Chart — ${latestFinal.product_name || "—"} (v${latestFinal.version_number || 1})`, margin, y + 4);
        doc.addImage(radarImgDataUrl, "PNG", margin, y + 10, imgW, imgH);
        rightX = margin + leftW + 16;
        rightW = pageW - margin - rightX;
      } catch (e) {
        // image failed — fall back to full-width detail
      }
    }

    // Latest scorecard detail table (criterion, block, primary, final, notes)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text("Latest Scorecard Detail", rightX, y + 4);
    let ty = y + 14;

    const colCrit = rightW * 0.34;
    const colBlock = rightW * 0.18;
    const colPrim = rightW * 0.10;
    const colFinal = rightW * 0.10;
    const colNotes = rightW * 0.28;

    const drawDetailHeader = () => {
      doc.setFillColor(249, 250, 251);
      doc.rect(rightX, ty, rightW, 18, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(75, 85, 99);
      doc.text("Criterion", rightX + 4, ty + 12);
      doc.text("Block", rightX + colCrit, ty + 12);
      doc.text("Prim", rightX + colCrit + colBlock, ty + 12);
      doc.text("Final", rightX + colCrit + colBlock + colPrim, ty + 12);
      doc.text("Notes", rightX + colCrit + colBlock + colPrim + colFinal, ty + 12);
      ty += 18;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
    };
    drawDetailHeader();

    (latestFinal.scoring_blocks || []).forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        if (ty > pageH - 70) {
          drawMyKumpareBranding(doc);
          doc.addPage();
          ty = margin + 10;
          drawDetailHeader();
        }
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
        const critLines = doc.splitTextToSize(crit.name || "", colCrit - 8);
        doc.text(critLines[0] || "", rightX + 4, ty + 10);
        doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
        doc.text(doc.splitTextToSize(block.name || "", colBlock - 6)[0] || "", rightX + colCrit, ty + 10);
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
        doc.text(crit.primary_score != null ? String(crit.primary_score) : "—", rightX + colCrit + colBlock + 2, ty + 10);
        doc.text(crit.final_score != null ? String(crit.final_score) : "—", rightX + colCrit + colBlock + colPrim + 2, ty + 10);
        doc.setTextColor(107, 114, 128);
        const notes = crit.final_notes || crit.primary_notes || "";
        const noteLines = doc.splitTextToSize(notes, colNotes - 6);
        doc.text(noteLines[0] || "—", rightX + colCrit + colBlock + colPrim + colFinal, ty + 10);
        ty += 16;
        doc.setDrawColor(243, 244, 246);
        doc.line(rightX, ty, rightX + rightW, ty);
      });
    });

    y = Math.max(ty, y + 250) + 16;
  }

  // ── Full history table (new page) ──
  drawMyKumpareBranding(doc);
  doc.addPage();
  y = drawReportHeader(doc, {
    margin,
    title: "Full Scoring History",
    subtitle: `${firm?.name || "—"} | ${scores.length} evaluation${scores.length !== 1 ? "s" : ""}`,
    firmName: firm?.name,
  });

  const cols = [
    { label: "Version", w: 50 },
    { label: "Product", w: 150 },
    { label: "Template", w: 130 },
    { label: "Status", w: 70 },
    { label: "Start", w: 65 },
    { label: "End", w: 65 },
    { label: "Final", w: 45 },
    { label: "Rating", w: 50 },
    { label: "P/F", w: 40 },
    { label: "Analyst", w: 110 },
  ];
  const totalColW = cols.reduce((s, c) => s + c.w, 0);
  let hx = margin;

  const drawHistoryHeader = () => {
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, y, totalColW, 20, "F");
    doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.line(margin, y + 20, margin + totalColW, y + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(75, 85, 99);
    hx = margin;
    cols.forEach((c) => {
      doc.text(c.label, hx + 4, y + 13);
      hx += c.w;
    });
    y += 20;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
  };
  drawHistoryHeader();

  scores.forEach((s) => {
    if (y > pageH - 60) {
      drawMyKumpareBranding(doc);
      doc.addPage();
      y = margin + 10;
      drawHistoryHeader();
    }
    const wf = computeWeightedScoreMulti(s.scoring_blocks || [], "final_score", {
      applyBonusPenalty: true, mode: "perCriterion",
    });
    const wfStr = wf != null ? wf.toFixed(2) : "—";

    hx = margin;
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(`v${s.version_number || 1}`, hx + 4, y + 12); hx += cols[0].w;
    doc.text(doc.splitTextToSize(s.product_name || "—", cols[1].w - 6)[0] || "", hx + 4, y + 12); hx += cols[1].w;
    doc.text(doc.splitTextToSize(s.template_name || "—", cols[2].w - 6)[0] || "", hx + 4, y + 12); hx += cols[2].w;
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(s.status || "—", hx + 4, y + 12); hx += cols[3].w;
    doc.text(s.scoring_start_date || "—", hx + 4, y + 12); hx += cols[4].w;
    doc.text(s.scoring_end_date || "—", hx + 4, y + 12); hx += cols[5].w;
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(wfStr, hx + 4, y + 12); hx += cols[6].w;
    doc.text(s.overall_rating || "—", hx + 4, y + 12); hx += cols[7].w;
    doc.text(s.overall_pass_fail || "—", hx + 4, y + 12); hx += cols[8].w;
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(doc.splitTextToSize(s.primary_analyst_name || "—", cols[9].w - 6)[0] || "", hx + 4, y + 12);
    y += 16;
    doc.setDrawColor(243, 244, 246);
    doc.line(margin, y, margin + totalColW, y);
  });

  // ── Footer branding ──
  drawMyKumpareBranding(doc);

  const dateStr = format(new Date(), "yyyy-MM-dd");
  const fileName = `Scoring_History_${(firm?.name || "Firm").replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.pdf`;
  doc.save(fileName);
}