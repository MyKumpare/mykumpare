import { jsPDF } from "jspdf";

// Exports the current (filtered/sorted) News Alerts view to a PDF.
// Captures the active filter context, a stats strip, and every visible item
// with its alert level, sentiment, date, firm, headline, and summary.

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const ALERT_COLORS = { High: [185, 28, 28], Medium: [180, 83, 9], Low: [2, 132, 199] };
const SENTIMENT_COLORS = { Positive: [22, 163, 74], Negative: [185, 28, 28], Neutral: [107, 114, 128] };

const SORT_LABELS = {
  date_desc: "Date (newest)",
  date_asc: "Date (oldest)",
  alert_desc: "Alert: High → Low",
  alert_asc: "Alert: Low → High",
  status_pos: "Status: Positive → Negative",
  status_neg: "Status: Negative → Positive",
};

export function generateNewsAlertsPdf({ items, filters = {}, totalCount, firmLabel, contactLabel }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeParagraph = (text, { size = 10, color = [51, 51, 51], bold = false, lineHeight = 14, gapAfter = 6 } = {}) => {
    if (!text) return;
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += gapAfter;
  };

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
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("News Alerts", margin, y);
  y += 24;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(`Generated ${formatTimestamp(new Date().toISOString())}`, margin, y);
  y += 14;
  doc.text(`${items.length} of ${totalCount} alerts shown`, margin, y);
  y += 18;

  // ── Active filters ──
  const filterParts = [];
  if (filters.search) filterParts.push(`Search: "${filters.search}"`);
  if (firmLabel && firmLabel !== "All firms") filterParts.push(`Firm: ${firmLabel}`);
  if (contactLabel && contactLabel !== "All contacts") filterParts.push(`Contact: ${contactLabel}`);
  filterParts.push(`Sort: ${SORT_LABELS[filters.sortBy] || filters.sortBy || "Date (newest)"}`);
  writeParagraph(filterParts.join("  ·  "), { size: 9, color: [107, 114, 128], gapAfter: 14 });

  // ── Stats strip ──
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 44, 6, 6, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const statCells = [
    { label: "SHOWN", value: stats.total, color: [17, 24, 39] },
    { label: "HIGH IMPACT", value: stats.high, color: ALERT_COLORS.High },
    { label: "MEDIUM", value: stats.medium, color: ALERT_COLORS.Medium },
    { label: "NEGATIVE", value: stats.negative, color: SENTIMENT_COLORS.Negative },
    { label: "POSITIVE", value: stats.positive, color: SENTIMENT_COLORS.Positive },
  ];
  const cellW = contentW / statCells.length;
  statCells.forEach((cell, i) => {
    const cx = margin + cellW * i + cellW / 2;
    doc.setTextColor(107, 114, 128);
    doc.text(cell.label, cx, y + 16, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(cell.color[0], cell.color[1], cell.color[2]);
    doc.text(String(cell.value), cx, y + 34, { align: "center" });
    doc.setFontSize(9);
  });
  y += 44 + 18;

  // ── Items ──
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(`Alerts (${items.length})`, margin, y);
  y += 18;

  for (const item of items) {
    ensureSpace(40);
    const alertColor = ALERT_COLORS[item.alert_status] || ALERT_COLORS.Low;
    doc.setFillColor(alertColor[0], alertColor[1], alertColor[2]);
    doc.circle(margin + 3, y - 3, 2.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(alertColor[0], alertColor[1], alertColor[2]);
    doc.text(item.alert_status || "Low", margin + 12, y);

    const sentimentColor = SENTIMENT_COLORS[item.news_status] || SENTIMENT_COLORS.Neutral;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(sentimentColor[0], sentimentColor[1], sentimentColor[2]);
    doc.text(item.news_status || "Neutral", margin + 60, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`· ${formatDate(item.news_date)}`, margin + 130, y);
    if (item.firm_name) {
      doc.text(`· ${item.firm_name}`, margin + 200, y);
    }
    y += 12;

    writeParagraph(item.headline, { size: 10, color: [17, 24, 39], bold: true, lineHeight: 12, gapAfter: 4 });
    if (item.summary) {
      writeParagraph(item.summary, { size: 9, color: [75, 85, 99], lineHeight: 12, gapAfter: 4 });
    }
    if (item.is_pinned) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(190, 24, 93);
      ensureSpace(12);
      doc.text("PINNED", margin, y);
      y += 12;
    }
    y += 6;
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`News Alerts · ${formatTimestamp(new Date().toISOString())}`, margin, pageH - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
  }

  const stamp = new Date().toISOString().split("T")[0];
  doc.save(`news-alerts_${stamp}.pdf`);
}