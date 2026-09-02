import { jsPDF } from "jspdf";
import { drawReportHeader, drawMyKumpareBranding, preloadMyKumpareLogo } from "@/components/reports/reportBranding";
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

function ensureSpace(doc, y, needed, margin, pageH) {
  if (y + needed > pageH - 50) {
    doc.addPage();
    return margin + 10;
  }
  return y;
}

function drawSectionTitle(doc, text, y, margin, pageW) {
  y = ensureSpace(doc, y, 30, margin, pageW);
  doc.setFillColor(BLOCK_BG_RGB[0], BLOCK_BG_RGB[1], BLOCK_BG_RGB[2]);
  doc.rect(margin, y - 12, pageW - margin * 2, 20, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  doc.text(text, margin + 6, y + 2);
  return y + 18;
}

function drawBulletList(doc, items, y, margin, pageW, pageH, color = INK_RGB) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(color[0], color[1], color[2]);
  items.forEach((item) => {
    const lines = doc.splitTextToSize(`•  ${item}`, pageW - margin * 2 - 10);
    lines.forEach((line) => {
      y = ensureSpace(doc, y, 14, margin, pageH);
      doc.text(line, margin + 4, y);
      y += 13;
    });
    y += 2;
  });
  return y;
}

/**
 * Exports a clean, professional PDF summary of the scoring matrix audit
 * progress and score descriptors.
 *
 * @param {object} opts
 * @param {object} opts.score - ScoringMatrixScore record
 * @param {object|null} opts.auditData - AI audit results (if available)
 */
export async function exportScoringAuditSummaryPdf({ score, auditData }) {
  await preloadMyKumpareLogo();

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;

  let y = drawReportHeader(doc, {
    margin,
    title: "Scoring Audit Summary Report",
    subtitle: `${score?.firm_name || ""} — ${score?.product_name || ""} | Template: ${score?.template_name || ""} | Version v${score?.version_number || 1}${score?.is_closed ? " (Closed)" : ""}`,
    firmName: score?.firm_name
  });

  y += 6;

  // ── Report metadata ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text(`Generated: ${format(new Date(), "MMM d, yyyy h:mm a")}`, margin, y);
  y += 16;

  const blocks = score?.scoring_blocks || [];
  const allCriteria = blocks.flatMap((b) => (b.criteria || []).map((c) => ({ ...c, block_name: b.name })));
  const total = allCriteria.length;

  // ── Section 1: Scoring Progress Summary ──
  y = drawSectionTitle(doc, "Scoring Progress Summary", y, margin, pageW);

  const phases = [
    { label: "Primary", field: "primary_score" },
    { label: "Secondary", field: "secondary_score" },
    { label: "Team", field: "team_score" },
    { label: "IC", field: "ic_score" },
    { label: "Final", field: "final_score" }
  ];

  doc.setFontSize(9);
  phases.forEach((p) => {
    const scored = allCriteria.filter((c) => c[p.field] != null).length;
    const pct = total > 0 ? Math.round((scored / total) * 100) : 0;
    y = ensureSpace(doc, y, 16, margin, pageH);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(`${p.label} Scores:`, margin + 4, y);
    doc.setFont("helvetica", "bold");
    doc.text(`${scored}/${total} (${pct}%)`, margin + 120, y);
    // Progress bar
    const barX = margin + 200;
    const barW = pageW - margin - barX - 4;
    doc.setFillColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
    doc.rect(barX, y - 7, barW, 8, "F");
    if (pct > 0) {
      const fillColor = pct === 100 ? [34, 197, 94] : [96, 165, 250];
      doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
      doc.rect(barX, y - 7, (barW * pct) / 100, 8, "F");
    }
    y += 16;
  });

  const completedTasks = phases.reduce((acc, p) => acc + allCriteria.filter((c) => c[p.field] != null).length, 0);
  const totalTasks = phases.length * total;
  const overallPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  y = ensureSpace(doc, y, 20, margin, pageH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  doc.text(`Overall Completion: ${overallPct}% (${completedTasks}/${totalTasks} tasks)`, margin + 4, y);
  y += 20;

  // ── Section 2: Audit Sections Status ──
  if (auditData) {
    y = drawSectionTitle(doc, "Audit Sections Status", y, margin, pageW);
    const auditSections = [
      { label: "Executive Summary", done: !!auditData.executive_summary },
      { label: "Strengths", done: Array.isArray(auditData.strengths) && auditData.strengths.length > 0 },
      { label: "Weaknesses", done: Array.isArray(auditData.weaknesses) && auditData.weaknesses.length > 0 },
      { label: "Areas of Concern", done: Array.isArray(auditData.areas_of_concern) && auditData.areas_of_concern.length > 0 },
      { label: "Follow-Up Items", done: Array.isArray(auditData.follow_up_items) && auditData.follow_up_items.length > 0 },
      { label: "Re-Scoring Recommendations", done: Array.isArray(auditData.rescoring_recommendations) && auditData.rescoring_recommendations.length > 0 },
      { label: "Independent AI Scores", done: Array.isArray(auditData.independent_scores) && auditData.independent_scores.length > 0 },
      { label: "Overall Assessment", done: !!auditData.overall_assessment }
    ];
    doc.setFontSize(9);
    auditSections.forEach((s) => {
      y = ensureSpace(doc, y, 14, margin, pageH);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(s.done ? [22, 163, 74] : [180, 180, 180]);
      doc.text(s.done ? "✓" : "○", margin + 4, y);
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.text(s.label, margin + 20, y);
      y += 14;
    });
    y += 8;

    // ── Section 3: AI Overall Assessment ──
    if (auditData.overall_assessment) {
      y = drawSectionTitle(doc, "AI Overall Assessment", y, margin, pageW);
      const oa = auditData.overall_assessment;
      if (oa.ai_overall_score != null) {
        y = ensureSpace(doc, y, 16, margin, pageH);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
        doc.text(`AI Overall Score: ${oa.ai_overall_score.toFixed(1)} / 5`, margin + 4, y);
        if (oa.confidence_level) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
          doc.text(`(Confidence: ${oa.confidence_level})`, margin + 200, y);
        }
        y += 16;
      }
      if (oa.summary) {
        const lines = doc.splitTextToSize(oa.summary, pageW - margin * 2 - 8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
        lines.forEach((line) => {
          y = ensureSpace(doc, y, 13, margin, pageH);
          doc.text(line, margin + 4, y);
          y += 13;
        });
        y += 6;
      }
    }

    // ── Section 4: Executive Summary ──
    if (auditData.executive_summary) {
      y = drawSectionTitle(doc, "Executive Summary", y, margin, pageW);
      const lines = doc.splitTextToSize(auditData.executive_summary, pageW - margin * 2 - 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      lines.forEach((line) => {
        y = ensureSpace(doc, y, 13, margin, pageH);
        doc.text(line, margin + 4, y);
        y += 13;
      });
      y += 6;
    }

    // ── Section 5: Strengths ──
    if (auditData.strengths?.length) {
      y = drawSectionTitle(doc, "Strengths", y, margin, pageW);
      y = drawBulletList(doc, auditData.strengths, y, margin, pageW, pageH, [22, 101, 52]);
      y += 4;
    }

    // ── Section 6: Weaknesses ──
    if (auditData.weaknesses?.length) {
      y = drawSectionTitle(doc, "Weaknesses", y, margin, pageW);
      y = drawBulletList(doc, auditData.weaknesses, y, margin, pageW, pageH, [153, 27, 27]);
      y += 4;
    }

    // ── Section 7: Areas of Concern ──
    if (auditData.areas_of_concern?.length) {
      y = drawSectionTitle(doc, "Areas of Concern", y, margin, pageW);
      y = drawBulletList(doc, auditData.areas_of_concern, y, margin, pageW, pageH, [161, 98, 7]);
      y += 4;
    }

    // ── Section 8: Follow-Up Items ──
    if (auditData.follow_up_items?.length) {
      y = drawSectionTitle(doc, "Follow-Up Items", y, margin, pageW);
      y = drawBulletList(doc, auditData.follow_up_items, y, margin, pageW, pageH, [30, 64, 175]);
      y += 4;
    }
  }

  // ── Section: Score Descriptors Reference ──
  y = drawSectionTitle(doc, "Score Descriptors Reference", y, margin, pageW);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  y = ensureSpace(doc, y, 14, margin, pageH);
  doc.text("Level descriptors for each scoring criterion (1-5 scale):", margin + 4, y);
  y += 14;

  blocks.forEach((block) => {
    const criteria = block.criteria || [];
    if (!criteria.length) return;
    y = ensureSpace(doc, y, 20, margin, pageH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(block.name, margin + 4, y);
    y += 14;

    criteria.forEach((crit) => {
      y = ensureSpace(doc, y, 16, margin, pageH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.text(`${crit.number ? crit.number + ". " : ""}${crit.name}`, margin + 8, y);
      y += 12;

      const descriptors = crit.descriptors || [];
      descriptors.forEach((d) => {
        y = ensureSpace(doc, y, 14, margin, pageH);
        // Score badge
        const hex = SCORE_COLORS_HEX[d.level] || "#cccccc";
        doc.setFillColor(hex);
        doc.circle(margin + 14, y - 3, 5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(String(d.level), margin + 14, y - 1, { align: "center" });

        // Descriptor text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
        const descLines = doc.splitTextToSize(d.text || "", pageW - margin * 2 - 28);
        descLines.forEach((line, idx) => {
          if (idx > 0) y = ensureSpace(doc, y, 12, margin, pageH);
          doc.text(line, margin + 24, y);
          y += 11;
        });
        y += 2;
      });

      // Current scores summary
      const scores = [];
      if (crit.primary_score != null) scores.push(`P:${crit.primary_score}`);
      if (crit.team_score != null) scores.push(`T:${crit.team_score}`);
      if (crit.ic_score != null) scores.push(`IC:${crit.ic_score}`);
      if (crit.final_score != null) scores.push(`F:${crit.final_score}`);
      if (scores.length) {
        y = ensureSpace(doc, y, 12, margin, pageH);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
        doc.text(`Current scores: ${scores.join("  ·  ")}`, margin + 24, y);
        y += 12;
      }
      y += 4;
    });
    y += 4;
  });

  // ── Branding footer on all pages ──
  drawMyKumpareBranding(doc, { margin });

  const fileName = `Audit_Summary_${(score?.firm_name || "Firm").replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
}