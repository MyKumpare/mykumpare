// Weekly Interaction Report PDF generator.
// Produces a branded PDF summarizing recent interactions for top-tier
// contacts: who you engaged with most, and where the communication gaps are.
//
// Uses the shared MyKumpare branding (header band + footer) for consistency
// with all other reports in the app.

import { jsPDF } from "jspdf";
import { drawReportHeader, drawMyKumpareBranding, MYKUMPARE_NAVY_RGB } from "./reportBranding";

const INK_RGB = [31, 41, 55];
const MUTED_RGB = [120, 128, 140];
const BORDER_RGB = [226, 232, 240];
const GREEN_RGB = [16, 122, 87];
const RED_RGB = [185, 28, 28];
const AMBER_RGB = [161, 98, 7];

function fullName(c) {
  return [c?.salutation, c?.first_name, c?.middle_name, c?.last_name, c?.suffix]
    .filter(Boolean).join(" ").trim() || [c?.first_name, c?.last_name].filter(Boolean).join(" ") || "Unknown";
}

/**
 * @param {object} opts
 * @param {object} opts.report - the computed report object:
 *   { windowDays, startDate, endDate, totalInteractions, topTierTotal,
 *     mostEngaged: [{contact, firmName, count, lastDate, decisionRole}],
 *     gaps: [{contact, firmName, daysSince, lastDate, decisionRole}] }
 * @param {string} opts.firmName - the generating firm's name (for the header)
 * @param {string} [opts.firmLogoDataUrl]
 */
export async function generateWeeklyInteractionReportPdf({ report, firmName, firmLogoDataUrl }) {
  await import("./reportBranding").then((m) => m.preloadMyKumpareLogo());

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const colW = pageW - margin * 2;

  const subtitle = `Reporting period: ${report.startDate} – ${report.endDate}  ·  ${report.windowDays}-day window`;
  let y = drawReportHeader(doc, {
    margin,
    title: "Weekly Interaction Report",
    subtitle,
    firmName,
    firmLogoDataUrl,
  });

  // ── Summary KPIs ──
  const kpis = [
    { label: "Total Interactions", value: report.totalInteractions, color: INK_RGB },
    { label: "Top-Tier Contacts", value: report.topTierTotal, color: AMBER_RGB },
    { label: "Engaged", value: report.engagedCount, color: GREEN_RGB },
    { label: "Communication Gaps", value: report.gaps.length, color: RED_RGB },
  ];
  const kpiW = colW / kpis.length;
  kpis.forEach((k, i) => {
    const x = margin + i * kpiW;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x + 2, y, kpiW - 4, 44, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(k.color[0], k.color[1], k.color[2]);
    doc.text(String(k.value), x + 12, y + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(k.label.toUpperCase(), x + 12, y + 36);
  });
  y += 56;

  // ── Most Engaged section ──
  y = drawSectionTitle(doc, "Most Engaged This Week", margin, y);
  if (report.mostEngaged.length === 0) {
    y = drawEmptyRow(doc, "No interactions recorded in this period.", margin, y);
  } else {
    y = drawTableHeader(doc, ["Contact", "Firm", "Role", "Interactions", "Last"], margin, y, colW);
    report.mostEngaged.slice(0, 15).forEach((row) => {
      y = drawTableRow(doc, [
        fullName(row.contact),
        row.firmName || "—",
        row.decisionRole || "—",
        String(row.count),
        row.lastDate || "—",
      ], margin, y, colW, { highlight: row.count });
      y = checkPageBreak(doc, y, margin, firmName, firmLogoDataUrl);
    });
  }
  y += 10;

  // ── Communication Gaps section ──
  y = checkPageBreak(doc, y + 30, margin, firmName, firmLogoDataUrl);
  y = drawSectionTitle(doc, "Communication Gaps — Top-Tier Contacts Needing Outreach", margin, y, RED_RGB);
  if (report.gaps.length === 0) {
    y = drawEmptyRow(doc, "All top-tier contacts have been engaged recently. No gaps.", margin, y, GREEN_RGB);
  } else {
    y = drawTableHeader(doc, ["Contact", "Firm", "Role", "Days Since", "Last Interaction"], margin, y, colW);
    report.gaps.slice(0, 25).forEach((row) => {
      const daysLabel = row.daysSince != null ? `${row.daysSince}d` : "—";
      y = drawTableRow(doc, [
        fullName(row.contact),
        row.firmName || "—",
        row.decisionRole || "—",
        daysLabel,
        row.lastDate || "Never",
      ], margin, y, colW, { warn: true });
      y = checkPageBreak(doc, y, margin, firmName, firmLogoDataUrl);
    });
  }

  drawMyKumpareBranding(doc);
  doc.save(`weekly-interaction-report-${report.endDate}.pdf`);
}

function drawSectionTitle(doc, title, margin, y, color = INK_RGB) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(title, margin, y);
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 4, doc.internal.pageSize.getWidth() - margin, y + 4);
  return y + 16;
}

function drawTableHeader(doc, cols, margin, y, colW) {
  const weights = [2.2, 1.6, 1.2, 0.9, 1.1];
  const total = weights.reduce((a, b) => a + b, 0);
  let x = margin;
  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y, colW, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  weights.forEach((w, i) => {
    const cw = (w / total) * colW;
    doc.text(String(cols[i] || "").toUpperCase(), x + 6, y + 12);
    x += cw;
  });
  return y + 18;
}

function drawTableRow(doc, cols, margin, y, colW, opts = {}) {
  const weights = [2.2, 1.6, 1.2, 0.9, 1.1];
  const total = weights.reduce((a, b) => a + b, 0);
  let x = margin;
  if ((y / doc.internal.pageSize.getHeight()) % 1 < 0.001) { /* noop */ }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  weights.forEach((w, i) => {
    const cw = (w / total) * colW;
    const val = String(cols[i] || "");
    if (i === 3) {
      // interaction count or days — color it
      if (opts.highlight) { doc.setTextColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]); doc.setFont("helvetica", "bold"); }
      else if (opts.warn) { doc.setTextColor(RED_RGB[0], RED_RGB[1], RED_RGB[2]); doc.setFont("helvetica", "bold"); }
    } else {
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.setFont("helvetica", "normal");
    }
    doc.text(val.length > 38 ? val.slice(0, 36) + "…" : val, x + 6, y + 12);
    x += cw;
  });
  doc.setDrawColor(240, 242, 245);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 16, margin + colW, y + 16);
  return y + 16;
}

function drawEmptyRow(doc, text, margin, y, color = MUTED_RGB) {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(text, margin, y + 4);
  return y + 16;
}

function checkPageBreak(doc, y, margin, firmName, firmLogoDataUrl) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 70) {
    drawMyKumpareBranding(doc);
    doc.addPage();
    y = drawReportHeader(doc, { margin, firmName, firmLogoDataUrl });
  }
  return y;
}