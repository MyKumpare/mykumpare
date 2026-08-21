import { jsPDF } from "jspdf";

// ─────────────────────────────────────────────────────────────────────────
// Reusable News PDF Template
// Single source of truth for the look & feel of all news-related PDF exports.
// Change a value here and every news PDF (summary, selection, alerts) updates.
// ─────────────────────────────────────────────────────────────────────────

export const NEWS_PDF_THEME = {
  // Page geometry
  orientation: "portrait",
  unit: "pt",
  format: "letter",
  margin: 48,

  // Typography
  fontFamily: "helvetica",
  titleSize: 20,
  subtitleSize: 10,
  sectionSize: 13,
  bodySize: 10,
  smallSize: 9,
  tinySize: 8,
  statLabelSize: 9,
  statValueSize: 16,

  // Spacing
  titleGap: 24,
  subtitleGap: 14,
  sectionGap: 18,
  bodyLineHeight: 14,
  itemLineHeight: 12,
  statStripHeight: 44,
  statStripGapAfter: 18,

  // Colors
  ink: [17, 24, 39],        // headings
  body: [51, 51, 51],       // body text
  muted: [107, 114, 128],   // meta / labels
  subtle: [75, 85, 99],     // summaries
  footer: [156, 163, 175],  // footer text
  stripBg: [248, 250, 252], // stats strip background
  link: [2, 132, 199],      // article links
  pinned: [190, 24, 93],   // pinned badge
  tagInk: [67, 56, 202],    // tagged contacts/firms
};

export const ALERT_COLORS = {
  High: [185, 28, 28],
  Medium: [180, 83, 9],
  Low: [2, 132, 199],
};

export const SENTIMENT_COLORS = {
  Positive: [22, 163, 74],
  Negative: [185, 28, 28],
  Neutral: [107, 114, 128],
};

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Creates a jsPDF document wired to the shared news theme and returns a set of
 * layout helpers. All news PDF generators should use this so formatting stays
 * consistent and editable from NEWS_PDF_THEME above.
 *
 * @param {object} [overrides] - partial theme overrides merged onto NEWS_PDF_THEME
 * @returns {{ doc, theme, pageW, pageH, margin, contentW, y, setY, addPage, ensureSpace, writeParagraph, drawStatsStrip, drawFooter, save }}
 */
export function createNewsPdfDoc(overrides = {}) {
  const theme = { ...NEWS_PDF_THEME, ...overrides };
  const doc = new jsPDF({ orientation: theme.orientation, unit: theme.unit, format: theme.format });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = theme.margin;
  const contentW = pageW - margin * 2;
  let y = margin;

  const setY = (next) => { y = next; };
  const addPage = () => { doc.addPage(); y = margin; };

  const ensureSpace = (needed) => {
    if (y + needed > pageH - margin) addPage();
  };

  const writeParagraph = (text, opts = {}) => {
    if (!text) return;
    const {
      size = theme.bodySize,
      color = theme.body,
      bold = false,
      lineHeight = theme.bodyLineHeight,
      gapAfter = 6,
    } = opts;
    doc.setFontSize(size);
    doc.setFont(theme.fontFamily, bold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, contentW);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += gapAfter;
  };

  // Draws the standard 5-cell stats strip. `cells` = [{ label, value, color }]
  const drawStatsStrip = (cells) => {
    doc.setFillColor(theme.stripBg[0], theme.stripBg[1], theme.stripBg[2]);
    doc.roundedRect(margin, y, contentW, theme.statStripHeight, 6, 6, "F");
    doc.setFontSize(theme.statLabelSize);
    doc.setFont(theme.fontFamily, "bold");
    const cellW = contentW / cells.length;
    cells.forEach((cell, i) => {
      const cx = margin + cellW * i + cellW / 2;
      doc.setTextColor(theme.muted[0], theme.muted[1], theme.muted[2]);
      doc.text(cell.label, cx, y + 16, { align: "center" });
      doc.setFontSize(theme.statValueSize);
      const c = cell.color || theme.ink;
      doc.setTextColor(c[0], c[1], c[2]);
      doc.text(String(cell.value), cx, y + 34, { align: "center" });
      doc.setFontSize(theme.statLabelSize);
    });
    y += theme.statStripHeight + theme.statStripGapAfter;
  };

  // Draws the standard title block: big title + subtitle lines
  const drawTitleBlock = (title, subtitleLines = []) => {
    doc.setFontSize(theme.titleSize);
    doc.setFont(theme.fontFamily, "bold");
    doc.setTextColor(theme.ink[0], theme.ink[1], theme.ink[2]);
    doc.text(title, margin, y);
    y += theme.titleGap;

    doc.setFontSize(theme.subtitleSize);
    doc.setFont(theme.fontFamily, "normal");
    doc.setTextColor(theme.muted[0], theme.muted[1], theme.muted[2]);
    for (const line of subtitleLines) {
      if (!line) continue;
      doc.text(line, margin, y);
      y += theme.subtitleGap;
    }
    y += 4;
  };

  // Draws a section heading
  const drawSection = (label) => {
    ensureSpace(theme.sectionGap + 4);
    doc.setFontSize(theme.sectionSize);
    doc.setFont(theme.fontFamily, "bold");
    doc.setTextColor(theme.ink[0], theme.ink[1], theme.ink[2]);
    doc.text(label, margin, y);
    y += theme.sectionGap;
  };

  // Draws the standard footer (left context line + right page numbers) on every page
  const drawFooter = (contextLine) => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(theme.tinySize);
      doc.setFont(theme.fontFamily, "normal");
      doc.setTextColor(theme.footer[0], theme.footer[1], theme.footer[2]);
      if (contextLine) doc.text(contextLine, margin, pageH - 24);
      doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: "right" });
    }
  };

  const save = (filename) => doc.save(filename);

  return {
    doc, theme, pageW, pageH, margin, contentW,
    get y() { return y; }, setY, addPage,
    ensureSpace, writeParagraph, drawStatsStrip, drawTitleBlock, drawSection, drawFooter, save,
  };
}