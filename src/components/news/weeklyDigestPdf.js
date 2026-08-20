import { jsPDF } from "jspdf";

// ── Weekly News Digest PDF generator ──
// Accepts the structured digest returned by the generateWeeklyNewsDigest
// backend function and produces a professional, downloadable PDF.

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
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

export function generateWeeklyDigestPdf(digest) {
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

  const writeBullets = (items, { size = 10, color = [51, 51, 51], lineHeight = 14, gapAfter = 4 } = {}) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    for (const item of items) {
      const lines = doc.splitTextToSize(`• ${item}`, contentW - 12);
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(lineHeight);
        doc.text(lines[i], margin + (i === 0 ? 0 : 12), y);
        y += lineHeight;
      }
      y += gapAfter;
    }
  };

  // ── Title block ──
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Weekly News Digest", margin, y);
  y += 26;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(`${formatDate(digest.week_start)} — ${formatDate(digest.week_end)}`, margin, y);
  y += 14;
  doc.text(`Generated ${formatTimestamp(digest.generated_at)}`, margin, y);
  y += 20;

  // ── Stats strip ──
  const s = digest.stats || {};
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 44, 6, 6, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const statCells = [
    { label: "TOTAL ITEMS", value: s.total || 0, color: [17, 24, 39] },
    { label: "HIGH IMPACT", value: s.high || 0, color: ALERT_COLORS.High },
    { label: "NEGATIVE", value: s.negative || 0, color: SENTIMENT_COLORS.Negative },
    { label: "POSITIVE", value: s.positive || 0, color: SENTIMENT_COLORS.Positive },
    { label: "FIRMS", value: digest.firm_count || 0, color: [17, 24, 39] },
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

  // ── Executive summary ──
  ensureSpace(30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Executive Summary", margin, y);
  y += 16;
  writeParagraph(digest.summary || "No summary available.", { size: 10, lineHeight: 14, gapAfter: 12 });

  // ── Key themes ──
  if (digest.key_themes && digest.key_themes.length) {
    ensureSpace(24);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text("Key Themes", margin, y);
    y += 16;
    writeBullets(digest.key_themes, { gapAfter: 3 });
    y += 6;
  }

  // ── High-impact alerts ──
  if (digest.high_alert_items && digest.high_alert_items.length) {
    ensureSpace(30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(185, 28, 28);
    doc.text("High-Impact Alerts", margin, y);
    y += 16;
    for (const item of digest.high_alert_items) {
      const meta = `${formatDate(item.news_date)} · ${item.firm_name}`;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(185, 28, 28);
      ensureSpace(14);
      doc.text(meta, margin, y);
      y += 12;
      writeParagraph(item.headline, { size: 10, color: [17, 24, 39], bold: true, lineHeight: 13, gapAfter: 8 });
    }
  }

  // ── Per-firm breakdown ──
  doc.addPage();
  y = margin;
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Tracked News by Firm", margin, y);
  y += 22;

  for (const firm of digest.firms || []) {
    ensureSpace(40);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(firm.firm_name, margin, y);
    y += 14;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`${firm.items.length} item${firm.items.length !== 1 ? "s" : ""}`, margin, y);
    y += 14;

    for (const item of firm.items) {
      const alertColor = ALERT_COLORS[item.alert_status] || ALERT_COLORS.Low;
      // Alert dot + date
      ensureSpace(14);
      doc.setFillColor(alertColor[0], alertColor[1], alertColor[2]);
      doc.circle(margin + 3, y - 3, 2.5, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(alertColor[0], alertColor[1], alertColor[2]);
      doc.text(item.alert_status, margin + 12, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(`· ${formatDate(item.news_date)}`, margin + 48, y);
      y += 11;

      // Headline
      writeParagraph(item.headline, { size: 10, color: [17, 24, 39], bold: true, lineHeight: 12, gapAfter: 4 });

      // Summary
      if (item.summary) {
        writeParagraph(item.summary, { size: 9, color: [75, 85, 99], lineHeight: 12, gapAfter: 4 });
      }

      // Article link
      if (item.article_url) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(2, 132, 199);
        const urlLines = doc.splitTextToSize(`Source: ${item.article_url}`, contentW);
        ensureSpace(12);
        doc.textWithLink(urlLines[0], margin, y, { url: item.article_url });
        y += 12;
      }
      y += 6;
    }
    y += 8;
  }

  // ── Footer with page numbers ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`Weekly News Digest · ${formatDate(digest.week_start)} — ${formatDate(digest.week_end)}`, margin, pageH - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
  }

  const filename = `weekly-news-digest_${digest.week_start}_to_${digest.week_end}.pdf`;
  doc.save(filename);
}