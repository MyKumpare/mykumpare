import {
  ALERT_COLORS, SENTIMENT_COLORS, formatDate, formatTimestamp, createNewsPdfDoc,
} from "./newsPdfTemplate";

// Exports a user-selected set of news articles to a PDF, including each
// article's alert level, sentiment, date, firm, headline, summary, and the
// contacts/firms tagged on it — so the report can be shared as-is.
// All visual formatting is controlled by the shared news PDF template.

export function generateNewsSelectionPdf({ items, contacts = [], firms = [], sourceLabel }) {
  const pdf = createNewsPdfDoc();
  const { margin, ensureSpace, writeParagraph, drawStatsStrip, drawSection, drawFooter, save, setY } = pdf;

  const contactMap = {};
  contacts.forEach(c => { contactMap[c.id] = c; });
  const firmMap = {};
  firms.forEach(f => { firmMap[f.id] = f; });

  const tagNames = (item) => {
    const cNames = (item.tagged_contact_ids || []).map(id => {
      const c = contactMap[id];
      return c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : null;
    }).filter(Boolean);
    const fNames = (item.tagged_firm_ids || []).map(id => firmMap[id]?.name).filter(Boolean);
    return { cNames, fNames };
  };

  // Stats
  const stats = { total: items.length, high: 0, medium: 0, low: 0, positive: 0, negative: 0 };
  for (const it of items) {
    if (it.alert_status === "High") stats.high++;
    else if (it.alert_status === "Medium") stats.medium++;
    else stats.low++;
    if (it.news_status === "Positive") stats.positive++;
    else if (it.news_status === "Negative") stats.negative++;
  }

  // ── Title ──
  pdf.drawTitleBlock("Selected News Articles", [
    sourceLabel ? `Source: ${sourceLabel}` : null,
    `Generated ${formatTimestamp(new Date().toISOString())}`,
    `${items.length} article${items.length !== 1 ? "s" : ""} included`,
  ]);

  // ── Stats strip ──
  drawStatsStrip([
    { label: "SELECTED", value: stats.total, color: pdf.theme.ink },
    { label: "HIGH IMPACT", value: stats.high, color: ALERT_COLORS.High },
    { label: "MEDIUM", value: stats.medium, color: ALERT_COLORS.Medium },
    { label: "NEGATIVE", value: stats.negative, color: SENTIMENT_COLORS.Negative },
    { label: "POSITIVE", value: stats.positive, color: SENTIMENT_COLORS.Positive },
  ]);

  // ── Articles ──
  drawSection(`Articles (${items.length})`);

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
    pdf.doc.setTextColor(sentimentColor[0], sentimentColor[1], sentimentColor[2]);
    pdf.doc.text(item.news_status || "Neutral", margin + 60, pdf.y);

    pdf.doc.setFont(pdf.theme.fontFamily, "normal");
    pdf.doc.setTextColor(pdf.theme.muted[0], pdf.theme.muted[1], pdf.theme.muted[2]);
    pdf.doc.text(`· ${formatDate(item.news_date)}`, margin + 130, pdf.y);
    if (item.firm_name) pdf.doc.text(`· ${item.firm_name}`, margin + 200, pdf.y);
    if (item.is_pinned) {
      pdf.doc.setFont(pdf.theme.fontFamily, "bold");
      pdf.doc.setTextColor(pdf.theme.pinned[0], pdf.theme.pinned[1], pdf.theme.pinned[2]);
      pdf.doc.text("PINNED", margin + 320, pdf.y);
    }
    setY(pdf.y + 12);

    writeParagraph(item.headline, { size: pdf.theme.bodySize, color: pdf.theme.ink, bold: true, lineHeight: 12, gapAfter: 4 });
    if (item.summary) writeParagraph(item.summary, { size: pdf.theme.smallSize, color: pdf.theme.subtle, lineHeight: 12, gapAfter: 4 });

    // Tags
    const { cNames, fNames } = tagNames(item);
    if (cNames.length || fNames.length) {
      const parts = [];
      if (cNames.length) parts.push(`Contacts: ${cNames.join(", ")}`);
      if (fNames.length) parts.push(`Firms: ${fNames.join(", ")}`);
      writeParagraph(parts.join("   ·   "), { size: pdf.theme.tinySize, color: pdf.theme.tagInk, bold: true, lineHeight: 11, gapAfter: 4 });
    }
    if (item.article_url) {
      pdf.doc.setFontSize(pdf.theme.tinySize);
      pdf.doc.setFont(pdf.theme.fontFamily, "normal");
      pdf.doc.setTextColor(pdf.theme.link[0], pdf.theme.link[1], pdf.theme.link[2]);
      ensureSpace(12);
      pdf.doc.textWithLink("View article", margin, pdf.y, { url: item.article_url });
      setY(pdf.y + 12);
    }
    setY(pdf.y + 8);
  }

  // ── Footer ──
  drawFooter(`Selected News Articles${sourceLabel ? " · " + sourceLabel : ""} · ${formatTimestamp(new Date().toISOString())}`);

  const stamp = new Date().toISOString().split("T")[0];
  save(`news-selected_${stamp}.pdf`);
}