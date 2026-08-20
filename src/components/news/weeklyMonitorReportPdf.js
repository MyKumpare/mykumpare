import { jsPDF } from "jspdf";

// ── Weekly Monitor Summary Report PDF generator ──
// Accepts the structured report returned by the generateWeeklyMonitorReport
// backend function (news + activity + completed tasks) and produces a
// professional, downloadable PDF.

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
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
const ACTIVITY_COLORS = {
  Call: [2, 132, 199],
  Email: [124, 58, 237],
  Meeting: [22, 163, 74],
  Note: [180, 83, 9],
  Other: [107, 114, 128],
};

export function generateWeeklyMonitorReportPdf(report) {
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

  const sectionHeader = (text, color = [17, 24, 39]) => {
    ensureSpace(30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, margin, y);
    y += 16;
  };

  // ── Title block ──
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text("Weekly Monitor Summary", margin, y);
  y += 26;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(`${formatDate(report.week_start)} — ${formatDate(report.week_end)}`, margin, y);
  y += 14;
  doc.text(`Generated ${formatTimestamp(report.generated_at)}`, margin, y);
  y += 20;

  // ── Stats strip ──
  const s = report.stats || {};
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW, 52, 6, 6, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const statCells = [
    { label: "NEWS ITEMS", value: report.total_news || 0, color: [17, 24, 39] },
    { label: "HIGH IMPACT", value: s.news_high || 0, color: ALERT_COLORS.High },
    { label: "ACTIVITIES", value: report.total_activities || 0, color: [124, 58, 237] },
    { label: "TASKS DONE", value: report.total_tasks || 0, color: [22, 163, 74] },
  ];
  const cellW = contentW / statCells.length;
  statCells.forEach((cell, i) => {
    const cx = margin + cellW * i + cellW / 2;
    doc.setTextColor(107, 114, 128);
    doc.text(cell.label, cx, y + 18, { align: "center" });
    doc.setFontSize(18);
    doc.setTextColor(cell.color[0], cell.color[1], cell.color[2]);
    doc.text(String(cell.value), cx, y + 40, { align: "center" });
    doc.setFontSize(9);
  });
  y += 52 + 18;

  // ── Executive summary ──
  sectionHeader("Executive Summary");
  writeParagraph(report.summary || "No summary available.", { size: 10, lineHeight: 14, gapAfter: 12 });

  // ── Key themes ──
  if (report.key_themes && report.key_themes.length) {
    sectionHeader("Key Themes");
    writeBullets(report.key_themes, { gapAfter: 3 });
    y += 6;
  }

  // ── High-impact alerts ──
  if (report.high_alert_items && report.high_alert_items.length) {
    sectionHeader("High-Impact News Alerts", ALERT_COLORS.High);
    for (const item of report.high_alert_items) {
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

  // ── Activity summary ──
  if (report.total_activities > 0) {
    doc.addPage();
    y = margin;
    sectionHeader("Activity Summary");

    // Activity by type breakdown
    const byType = s.activities_by_type || {};
    const activeTypes = Object.entries(byType).filter(([, v]) => v > 0);
    if (activeTypes.length) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      ensureSpace(16);
      doc.text("By Type:", margin, y);
      y += 14;
      for (const [type, count] of activeTypes) {
        const color = ACTIVITY_COLORS[type] || ACTIVITY_COLORS.Other;
        ensureSpace(14);
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(margin + 3, y - 3, 2.5, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(type, margin + 12, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        doc.text(`— ${count} item${count !== 1 ? "s" : ""}`, margin + 12 + doc.getTextWidth(type) + 6, y);
        y += 14;
      }
      y += 8;
    }

    // Activity log
    for (const a of (report.activities || [])) {
      ensureSpace(28);
      const color = ACTIVITY_COLORS[a.activity_type] || ACTIVITY_COLORS.Other;
      doc.setFillColor(color[0], color[1], color[2]);
      doc.circle(margin + 3, y - 3, 2.5, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(a.activity_type, margin + 12, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(`· ${formatDate(a.activity_date)}`, margin + 12 + doc.getTextWidth(a.activity_type) + 6, y);
      y += 11;

      const firmLabel = (a.firms || []).join(", ");
      const subjectLabel = (a.subjects || []).join(", ");
      const label = [subjectLabel, firmLabel].filter(Boolean).join(" — ");
      if (label) {
        writeParagraph(label, { size: 10, color: [17, 24, 39], bold: true, lineHeight: 12, gapAfter: 3 });
      }
      if (a.notes) {
        writeParagraph(a.notes, { size: 9, color: [75, 85, 99], lineHeight: 12, gapAfter: 6 });
      } else {
        y += 4;
      }
    }
  }

  // ── Completed tasks ──
  if (report.total_tasks > 0) {
    doc.addPage();
    y = margin;
    sectionHeader("Completed Follow-Up Tasks", [22, 163, 74]);

    for (const t of (report.tasks || [])) {
      ensureSpace(28);
      doc.setFillColor(22, 163, 74);
      doc.circle(margin + 3, y - 3, 2.5, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 163, 74);
      doc.text("Completed", margin + 12, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      const dateStr = t.completion_date ? `· ${formatDate(t.completion_date)}` : "";
      doc.text(dateStr, margin + 12 + doc.getTextWidth("Completed") + 6, y);
      y += 11;

      if (t.assigned_to || t.firm_name) {
        const assignee = [t.assigned_to, t.firm_name].filter(Boolean).join(" · ");
        writeParagraph(assignee, { size: 9, color: [107, 114, 128], lineHeight: 12, gapAfter: 3 });
      }
      if (t.description) {
        writeParagraph(t.description, { size: 10, color: [17, 24, 39], lineHeight: 12, gapAfter: 6 });
      } else {
        y += 4;
      }
    }
  }

  // ── Per-firm news breakdown ──
  if (report.firms && report.firms.length) {
    doc.addPage();
    y = margin;
    sectionHeader("Tracked News by Firm");
    y += 6;

    for (const firm of report.firms) {
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

        writeParagraph(item.headline, { size: 10, color: [17, 24, 39], bold: true, lineHeight: 12, gapAfter: 4 });
        if (item.summary) {
          writeParagraph(item.summary, { size: 9, color: [75, 85, 99], lineHeight: 12, gapAfter: 4 });
        }
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
  }

  // ── Footer with page numbers ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`Weekly Monitor Summary · ${formatDate(report.week_start)} — ${formatDate(report.week_end)}`, margin, pageH - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
  }

  const filename = `weekly-monitor-summary_${report.week_start}_to_${report.week_end}.pdf`;
  doc.save(filename);
}