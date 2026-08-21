import {
  ALERT_COLORS, SENTIMENT_COLORS, formatDate, formatTimestamp, createNewsPdfDoc,
} from "./newsPdfTemplate";

// Exports the current (filtered/sorted) News Alerts view to a PDF.
// Captures the active filter context, a stats strip, and every visible item
// with its alert level, sentiment, date, firm, headline, and summary.
// All visual formatting is controlled by the shared news PDF template.

const SORT_LABELS = {
  date_desc: "Date (newest)",
  date_asc: "Date (oldest)",
  alert_desc: "Alert: High → Low",
  alert_asc: "Alert: Low → High",
  status_pos: "Status: Positive → Negative",
  status_neg: "Status: Negative → Positive",
};

export function generateNewsAlertsPdf({ items, filters = {}, totalCount, firmLabel, contactLabel }) {
  const pdf = createNewsPdfDoc();
  const { margin, ensureSpace, writeParagraph, drawStatsStrip, drawSection, drawFooter, save, setY } = pdf;

  // Stats from the current view
  const stats = { total: items.length, high: 0, medium: 0, low: 0, positive: 0, negative: 0, neutral: 0 };
  for (const it of items) {
    if (it.alert_status === "High") stats.high++;
    else if (it.alert_status === "Medium") stats.medium++;
    else stats.low++;
    if (it.news_status === "Positive") stats.positive++;
    else if (it.news_status === "Negative") stats.negative++;
    else stats.neutral++;
  }

  // ── Title block ──
  pdf.drawTitleBlock("News Alerts", [
    `Generated ${formatTimestamp(new Date().toISOString())}`,
    `${items.length} of ${totalCount} alerts shown`,
  ]);

  // ── Active filters ──
  const filterParts = [];
  if (filters.search) filterParts.push(`Search: "${filters.search}"`);
  if (firmLabel && firmLabel !== "All firms") filterParts.push(`Firm: ${firmLabel}`);
  if (contactLabel && contactLabel !== "All contacts") filterParts.push(`Contact: ${contactLabel}`);
  filterParts.push(`Sort: ${SORT_LABELS[filters.sortBy] || filters.sortBy || "Date (newest)"}`);
  writeParagraph(filterParts.join("  ·  "), { size: pdf.theme.smallSize, color: pdf.theme.muted, gapAfter: 14 });

  // ── Stats strip ──
  drawStatsStrip([
    { label: "SHOWN", value: stats.total, color: pdf.theme.ink },
    { label: "HIGH IMPACT", value: stats.high, color: ALERT_COLORS.High },
    { label: "MEDIUM", value: stats.medium, color: ALERT_COLORS.Medium },
    { label: "NEGATIVE", value: stats.negative, color: SENTIMENT_COLORS.Negative },
    { label: "POSITIVE", value: stats.positive, color: SENTIMENT_COLORS.Positive },
  ]);

  // ── Items ──
  drawSection(`Alerts (${items.length})`);

  for (const item of items) {
    ensureSpace(40);
    const alertColor = ALERT_COLORS[item.alert_status] || ALERT_COLORS.Low;
    pdf.doc.setFillColor(alertColor[0], alertColor[1], alertColor[2]);
    pdf.doc.circle(margin + 3, pdf.y - 3, 2.5, "F");
    pdf.doc.setFontSize(pdf.theme.tinySize);
    pdf.doc.setFont(pdf.theme.fontFamily, "bold");
    pdf.doc.setTextColor(alertColor[0], alertColor[1], alertColor[2]);
    pdf.doc.text(item.alert_status || "Low", margin + 12, pdf.y);

    const sentimentColor = SENTIMENT_COLORS[item.news_status] || SENTIMENT_COLORS.Neutral;
    pdf.doc.setFont(pdf.theme.fontFamily, "bold");
    pdf.doc.setTextColor(sentimentColor[0], sentimentColor[1], sentimentColor[2]);
    pdf.doc.text(item.news_status || "Neutral", margin + 60, pdf.y);

    pdf.doc.setFont(pdf.theme.fontFamily, "normal");
    pdf.doc.setTextColor(pdf.theme.muted[0], pdf.theme.muted[1], pdf.theme.muted[2]);
    pdf.doc.text(`· ${formatDate(item.news_date)}`, margin + 130, pdf.y);
    if (item.firm_name) {
      pdf.doc.text(`· ${item.firm_name}`, margin + 200, pdf.y);
    }
    setY(pdf.y + 12);

    writeParagraph(item.headline, { size: pdf.theme.bodySize, color: pdf.theme.ink, bold: true, lineHeight: 12, gapAfter: 4 });
    if (item.summary) {
      writeParagraph(item.summary, { size: pdf.theme.smallSize, color: pdf.theme.subtle, lineHeight: 12, gapAfter: 4 });
    }
    if (item.is_pinned) {
      pdf.doc.setFontSize(pdf.theme.tinySize);
      pdf.doc.setFont(pdf.theme.fontFamily, "bold");
      pdf.doc.setTextColor(pdf.theme.pinned[0], pdf.theme.pinned[1], pdf.theme.pinned[2]);
      ensureSpace(12);
      pdf.doc.text("PINNED", margin, pdf.y);
      setY(pdf.y + 12);
    }
    setY(pdf.y + 6);
  }

  // ── Footer ──
  drawFooter(`News Alerts · ${formatTimestamp(new Date().toISOString())}`);

  const stamp = new Date().toISOString().split("T")[0];
  save(`news-alerts_${stamp}.pdf`);
}