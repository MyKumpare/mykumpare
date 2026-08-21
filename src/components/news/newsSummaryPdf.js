import {
  ALERT_COLORS, SENTIMENT_COLORS, formatDate, formatTimestamp, createNewsPdfDoc,
} from "./newsPdfTemplate";

// ── News Summary PDF generator (per firm or contact, date-ranged) ──
// Accepts a structured summary object and produces a downloadable PDF.
// All visual formatting is controlled by the shared news PDF template.

export function generateNewsSummaryPdf(report) {
  const pdf = createNewsPdfDoc();
  const { margin, ensureSpace, writeParagraph, drawTitleBlock, drawStatsStrip, drawSection, drawFooter, save, setY, addPage } = pdf;

  // ── Title block ──
  drawTitleBlock(`News Summary — ${report.targetLabel}`, [
    `${report.targetType === "contact" ? "Contact" : "Firm"} report`,
    `${formatDate(report.startDate)} — ${formatDate(report.endDate)}`,
    `Generated ${formatTimestamp(report.generatedAt)}`,
  ]);

  // ── Stats strip ──
  const s = report.stats || {};
  drawStatsStrip([
    { label: "TOTAL ITEMS", value: s.total || 0, color: pdf.theme.ink },
    { label: "HIGH IMPACT", value: s.high || 0, color: ALERT_COLORS.High },
    { label: "MEDIUM", value: s.medium || 0, color: ALERT_COLORS.Medium },
    { label: "NEGATIVE", value: s.negative || 0, color: SENTIMENT_COLORS.Negative },
    { label: "POSITIVE", value: s.positive || 0, color: SENTIMENT_COLORS.Positive },
  ]);

  // ── Overall levels ──
  ensureSpace(40);
  drawSection("Overall Levels");

  const overallAlertColor = ALERT_COLORS[report.overallAlert] || pdf.theme.muted;
  pdf.doc.setFillColor(overallAlertColor[0], overallAlertColor[1], overallAlertColor[2]);
  pdf.doc.circle(margin + 3, pdf.y - 3, 3, "F");
  pdf.doc.setFontSize(pdf.theme.bodySize);
  pdf.doc.setFont(pdf.theme.fontFamily, "bold");
  pdf.doc.setTextColor(overallAlertColor[0], overallAlertColor[1], overallAlertColor[2]);
  pdf.doc.text(`Overall Alert Level: ${report.overallAlert || "—"}`, margin + 14, pdf.y);
  setY(pdf.y + 16);

  const overallStatusColor = SENTIMENT_COLORS[report.overallStatus] || pdf.theme.muted;
  pdf.doc.setFillColor(overallStatusColor[0], overallStatusColor[1], overallStatusColor[2]);
  pdf.doc.circle(margin + 3, pdf.y - 3, 3, "F");
  pdf.doc.setFontSize(pdf.theme.bodySize);
  pdf.doc.setFont(pdf.theme.fontFamily, "bold");
  pdf.doc.setTextColor(overallStatusColor[0], overallStatusColor[1], overallStatusColor[2]);
  pdf.doc.text(`Overall News Status: ${report.overallStatus || "—"}`, margin + 14, pdf.y);
  setY(pdf.y + 22);

  // ── Narrative summary ──
  drawSection("Summary");
  writeParagraph(report.summary || "No summary available.", { size: pdf.theme.bodySize, lineHeight: 14, gapAfter: 12 });

  // ── Items in range ──
  if (report.items && report.items.length) {
    addPage();
    drawSection(`News Items (${report.items.length})`);

    for (const item of report.items) {
      ensureSpace(40);
      const alertColor = ALERT_COLORS[item.alert_status] || ALERT_COLORS.Low;
      pdf.doc.setFillColor(alertColor[0], alertColor[1], alertColor[2]);
      pdf.doc.circle(margin + 3, pdf.y - 3, 2.5, "F");
      pdf.doc.setFontSize(pdf.theme.tinySize);
      pdf.doc.setFont(pdf.theme.fontFamily, "bold");
      pdf.doc.setTextColor(alertColor[0], alertColor[1], alertColor[2]);
      pdf.doc.text(item.alert_status || "Low", margin + 12, pdf.y);
      pdf.doc.setFont(pdf.theme.fontFamily, "normal");
      pdf.doc.setTextColor(pdf.theme.muted[0], pdf.theme.muted[1], pdf.theme.muted[2]);
      pdf.doc.text(`· ${formatDate(item.news_date)}`, margin + 48, pdf.y);
      setY(pdf.y + 12);

      writeParagraph(item.headline, { size: pdf.theme.bodySize, color: pdf.theme.ink, bold: true, lineHeight: 12, gapAfter: 4 });
      if (item.summary) {
        writeParagraph(item.summary, { size: pdf.theme.smallSize, color: pdf.theme.subtle, lineHeight: 12, gapAfter: 4 });
      }
      if (item.article_url) {
        pdf.doc.setFontSize(pdf.theme.tinySize);
        pdf.doc.setFont(pdf.theme.fontFamily, "normal");
        pdf.doc.setTextColor(pdf.theme.link[0], pdf.theme.link[1], pdf.theme.link[2]);
        ensureSpace(12);
        pdf.doc.textWithLink("View article", margin, pdf.y, { url: item.article_url });
        setY(pdf.y + 12);
      }
      setY(pdf.y + 6);
    }
  }

  // ── Footer ──
  drawFooter(`News Summary · ${report.targetLabel} · ${formatDate(report.startDate)} — ${formatDate(report.endDate)}`);

  const safeName = (report.targetLabel || "report").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  save(`news-summary_${safeName}_${report.startDate}_to_${report.endDate}.pdf`);
}