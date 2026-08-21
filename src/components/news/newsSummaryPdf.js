import { jsPDF } from "jspdf";

// ── News Summary PDF generator (per firm or contact, date-ranged) ──
// Accepts a structured summary object and produces a downloadable PDF.

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

const ALERT_COLORS = {
  High: [185, 28, 28],
  Medium: [180, 83, 9],
  Low: [2, 132, 199],
};
const SENTIMENT_COLORS = {
  Positive: [22, 163, 74],
  Negative: [185, 28, 28],
  Neutral: [107, 114, 128],
};

export function generateNewsSummaryPdf(report) {
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

  // ── Title block ──
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(`News Summary — ${report.targetLabel}`, margin, y);
  y += 24;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(`${report.targetType === "contact" ? "Contact" : "Firm"} report`, margin, y);
  y += 14;
  doc.text(`${formatDate(report.startDate)} — ${formatDate(report.endDate)}`, margin, y);
  y += 14;
  doc.text(`Generated ${formatTimestamp(report.generatedAt)}`, margin, y);
  y += 20;

  // ── Stats strip ──
  const s = report.stats || {};
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 44, 6, 6, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const statCells = [
    { label: "TOTAL ITEMS", value: s.total || 0, color: [17, 24, 39] },
    { label: "HIGH IMPACT", value: s.high || 0, color: ALERT_COLORS.High },
    { label: "MEDIUM", value: s.medium || 0, color: ALERT_COLORS.Medium },
    { label: "NEGATIVE", value: s.negative || 0, color: SENTIMENT_COLORS.Negative },
    { label: "POSITIVE", value: s.positive || 0, color: SENTIMENT_COLORS.Positive },
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

  // ── Overall levels ──
  ensureSpace(40);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Overall Levels", margin, y);
  y += 18;

  const overallAlertColor = ALERT_COLORS[report.overallAlert] || [107, 114, 128];
  doc.setFillColor(overallAlertColor[0], overallAlertColor[1], overallAlertColor[2]);
  doc.circle(margin + 3, y - 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(overallAlertColor[0], overallAlertColor[1], overallAlertColor[2]);
  doc.text(`Overall Alert Level: ${report.overallAlert || "—"}`, margin + 14, y);
  y += 16;

  const overallStatusColor = SENTIMENT_COLORS[report.overallStatus] || [107, 114, 128];
  doc.setFillColor(overallStatusColor[0], overallStatusColor[1], overallStatusColor[2]);
  doc.circle(margin + 3, y - 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(overallStatusColor[0], overallStatusColor[1], overallStatusColor[2]);
  doc.text(`Overall News Status: ${report.overallStatus || "—"}`, margin + 14, y);
  y += 22;

  // ── Narrative summary ──
  ensureSpace(30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Summary", margin, y);
  y += 16;
  writeParagraph(report.summary || "No summary available.", { size: 10, lineHeight: 14, gapAfter: 12 });

  // ── Items in range ──
  if (report.items && report.items.length) {
    doc.addPage();
    y = margin;
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(`News Items (${report.items.length})`, margin, y);
    y += 22;

    for (const item of report.items) {
      ensureSpace(40);
      const alertColor = ALERT_COLORS[item.alert_status] || ALERT_COLORS.Low;
      doc.setFillColor(alertColor[0], alertColor[1], alertColor[2]);
      doc.circle(margin + 3, y - 3, 2.5, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(alertColor[0], alertColor[1], alertColor[2]);
      doc.text(item.alert_status || "Low", margin + 12, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(`· ${formatDate(item.news_date)}`, margin + 48, y);
      y += 12;

      writeParagraph(item.headline, { size: 10, color: [17, 24, 39], bold: true, lineHeight: 12, gapAfter: 4 });
      if (item.summary) {
        writeParagraph(item.summary, { size: 9, color: [75, 85, 99], lineHeight: 12, gapAfter: 4 });
      }
      if (item.article_url) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(2, 132, 199);
        ensureSpace(12);
        doc.textWithLink("View article", margin, y, { url: item.article_url });
        y += 12;
      }
      y += 6;
    }
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`News Summary · ${report.targetLabel} · ${formatDate(report.startDate)} — ${formatDate(report.endDate)}`, margin, pageH - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
  }

  const safeName = (report.targetLabel || "report").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`news-summary_${safeName}_${report.startDate}_to_${report.endDate}.pdf`);
}