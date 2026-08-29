// Generates a branded single-record summary PDF from a saved template.
// Only the template's selected fields are rendered, grouped by their config
// sections. Reuses the shared MyKumpare branding helpers.

import { jsPDF } from "jspdf";
import {
  drawReportHeader,
  drawMyKumpareBranding,
  preloadMyKumpareLogo,
  rasterizeImage,
} from "@/components/reports/reportBranding";
import { SUMMARY_ENTITY_TYPES, allFieldsFor, formatFieldValue, recordDisplayName } from "./summaryReportTemplateConfig";

const INK_RGB = [31, 41, 55];
const MUTED_RGB = [120, 128, 140];
const BORDER_RGB = [226, 232, 240];

function hexToRgb(hex) {
  const h = (hex || "#0d9488").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function fileTimestamp() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build and download a branded summary PDF for a single record.
 *
 * @param {object} template - Saved SummaryReportTemplate (selected_fields, page options, etc.)
 * @param {object} record   - The entity record to summarize
 * @param {object} [ctx]    - Related data for derived fields ({ products, contacts, team, constituents, firmName })
 */
export async function generateSummaryPdf(template, record, ctx = {}) {
  if (!template || !record) return;
  await preloadMyKumpareLogo().catch(() => {});

  const entityType = template.entity_type;
  const cfg = SUMMARY_ENTITY_TYPES[entityType];
  if (!cfg) return;

  const orientation = template.page_orientation === "landscape" ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableW = pageW - margin * 2;
  const accent = hexToRgb(template.accent_color);

  // ── Optional cover page ──
  if (template.include_cover_page) {
    drawCoverPage(doc, { margin, pageW, pageH, record, template, cfg, accent });
    doc.addPage();
  }

  // ── Header + title ──
  let y = drawReportHeader(doc, {
    margin,
    title: template.name || `${cfg.label} Summary`,
    subtitle: `${recordDisplayName(entityType, record)}  •  Generated ${todayStr()}`,
  });

  // Optional logo / photo at top-right of first content page
  if (template.include_logo) {
    const logoUrl = record.logo_url || record.photo_url;
    if (logoUrl) {
      const dataUrl = await rasterizeImage(logoUrl, 96).catch(() => null);
      if (dataUrl) {
        try {
          const sz = 36;
          doc.addImage(dataUrl, "PNG", pageW - margin - sz, y - 30, sz, sz);
        } catch { /* ignore */ }
      }
    }
  }

  const ensureSpace = (need) => {
    if (y + need > pageH - 60) {
      doc.addPage();
      y = drawReportHeader(doc, { margin });
    }
  };

  // ── Summary metric chips ──
  const selectedKeys = template.selected_fields || [];
  const allFields = allFieldsFor(entityType);
  const metricFields = selectedKeys
    .map((k) => allFields.find((f) => f.key === k))
    .filter((f) => f && (f.type === "metric_number" || f.type === "metric_currency"));

  if (template.include_summary_metrics && metricFields.length > 0) {
    const chipW = usableW / Math.min(metricFields.length, 4);
    const chipH = 40;
    ensureSpace(chipH + 12);
    metricFields.slice(0, 4).forEach((f, i) => {
      const x = margin + i * chipW;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x + 2, y, chipW - 6, chipH, 6, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.text(String(formatFieldValue(f, record, ctx) ?? "—"), x + 10, y + 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
      doc.text(f.label, x + 10, y + 32);
    });
    y += chipH + 16;
  }

  // ── Sections ──
  // Group selected fields by their section, preserving config section order.
  const selectedSet = new Set(selectedKeys);
  for (const section of cfg.sections) {
    const sectionFields = section.fields.filter((f) => selectedSet.has(f.key));
    if (sectionFields.length === 0) continue;

    // Section header
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text(section.label, margin, y);
    y += 6;
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + 24, y);
    y += 12;

    // Field rows: two-column (label | value)
    const labelW = 150;
    const valueX = margin + labelW + 8;
    const valueW = usableW - labelW - 8;

    for (const field of sectionFields) {
      const value = String(formatFieldValue(field, record, ctx) ?? "—");
      const isLong = field.type === "longtext" || value.length > 60;
      const lines = doc.splitTextToSize(value, valueW);
      const rowH = Math.max(16, lines.length * 11 + 4);

      ensureSpace(rowH);

      // Label
      doc.setFont("helvetica", "semibold");
      doc.setFontSize(9);
      doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
      doc.text(field.label, margin, y + 9);

      // Value
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.text(lines, valueX, y + 9);

      // Divider
      y += rowH;
      doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + usableW, y);
      y += 6;
    }
    y += 6;
  }

  // ── Branding footer ──
  if (template.include_branding) {
    drawMyKumpareBranding(doc, { margin });
  }

  const safeName = (recordDisplayName(entityType, record) || "summary").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  doc.save(`${template.name || "summary"}_${safeName}_${fileTimestamp()}.pdf`);
}

function drawCoverPage(doc, { margin, pageW, pageH, record, template, cfg, accent }) {
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageW, pageH, "F");

  // Accent band
  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.rect(0, pageH - 120, pageW, 6, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  doc.text(template.name || `${cfg.label} Summary`, margin, pageH / 2 - 10);

  // Record name
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text(recordDisplayName(template.entity_type, record), margin, pageH / 2 + 16);

  // Entity type + date
  doc.setFontSize(10);
  doc.text(`${cfg.label} Summary Report  •  ${todayStr()}`, margin, pageH / 2 + 34);
}