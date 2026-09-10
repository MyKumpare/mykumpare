/**
 * Scoring Matrix summary export utilities.
 * Builds a human-readable summary of a scoring matrix template (sections,
 * sub-sections, rating options, bonus/penalty, overall rating config) and
 * exposes Word (.doc, HTML-based) and Excel (.xlsx) download helpers plus an
 * HTML string usable for on-screen preview / printing.
 *
 * Template shape (matches AddTemplateDialog / ScoringMatrixTemplateEditor):
 *   blocks: [{ id, name, weight, multiplier_enabled, multiplier,
 *              criteria: [{ id, number, name, category, multiplier_enabled, multiplier,
 *                           descriptors: [{ level, text }],
 *                           bonus_penalty_enabled, bonus_penalty_range: {min,max},
 *                           bonus_penalty_guidance }] }]
 *   ratingConfig: { unit, pass_fail_enabled, pass_threshold,
 *                   rating_enabled, rating_options: [{ id, label, operator,
 *                     min_score, max_score, color }] }
 */

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const OPERATOR_LABELS = {
  between: "between",
  gte: "≥",
  gt: ">",
  lte: "≤",
  lt: "<",
  eq: "="
};

const UNIT_LABELS = {
  none: "No unit (raw score)",
  "%": "Percentage (%)",
  pts: "Points (pts)",
  x: "Multiplier (x)",
  $: "Currency ($)",
  bps: "Basis points (bps)"
};

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unitSuffix(unit) {
  return unit && unit !== "none" ? ` ${unit}` : "";
}

function ratingOptionRange(opt, unit) {
  const op = opt.operator || "between";
  const sym = OPERATOR_LABELS[op] || op;
  const u = unitSuffix(unit);
  if (op === "between") {
    return `${opt.min_score ?? 0}${u} to ${opt.max_score ?? 0}${u}`;
  }
  return `${sym} ${opt.min_score ?? 0}${u}`;
}

/**
 * Build a full HTML document string for the scoring matrix summary.
 * Used for on-screen preview, printing, and Word (.doc) download.
 */
export function buildSummaryHtml(templateName, blocks = [], ratingConfig = {}) {
  const cfg = ratingConfig || {};
  const unit = cfg.unit || "none";
  const totalWeight = blocks.reduce((s, b) => s + (b.weight || 0), 0);

  const sectionsHtml = blocks.map((block, bIdx) => {
    const criteria = block.criteria || [];
    const multInfo = block.multiplier_enabled
      ? `<span class="chip">× ${(block.multiplier ?? 1)}</span>`
      : "";
    const criteriaHtml = criteria.map((crit, cIdx) => {
      const descriptors = crit.descriptors || [];
      const descRows = descriptors.map((d) => `
        <tr>
          <td class="lvl lvl-${d.level}">${d.level}</td>
          <td>${escapeHtml(d.text || "—")}</td>
        </tr>`).join("");

      const critMult = crit.multiplier_enabled
        ? `<span class="chip">× ${(crit.multiplier ?? 1)}</span>`
        : "";

      const bpHtml = crit.bonus_penalty_enabled
        ? `<div class="bp">
            <strong>Bonus / Penalty:</strong>
            range ${(crit.bonus_penalty_range?.min ?? -1)} to ${(crit.bonus_penalty_range?.max ?? 1)}
            ${unit ? `<span class="muted">(${unit})</span>` : ""}
            ${crit.bonus_penalty_guidance ? `<div class="guidance">${escapeHtml(crit.bonus_penalty_guidance)}</div>` : ""}
          </div>`
        : "";

      return `
        <div class="criterion">
          <div class="crit-head">
            <span class="crit-num">#${crit.number || cIdx + 1}</span>
            <span class="crit-name">${escapeHtml(crit.name || "—")}</span>
            ${crit.category ? `<span class="muted">(${escapeHtml(crit.category)})</span>` : ""}
            ${critMult}
          </div>
          ${descRows ? `<table class="desc-table">${descRows}</table>` : ""}
          ${bpHtml}
        </div>`;
    }).join("");

    return `
      <div class="section">
        <div class="section-head">
          <span class="section-num">${bIdx + 1}</span>
          <span class="section-name">${escapeHtml(block.name || "—")}</span>
          <span class="weight">${block.weight || 0}%</span>
          ${multInfo}
        </div>
        ${criteriaHtml || `<div class="muted">No sub-sections</div>`}
      </div>`;
  }).join("");

  // Overall rating configuration
  const passFailHtml = cfg.pass_fail_enabled
    ? `<div class="config-row"><strong>Pass / Fail:</strong> enabled — Pass threshold ≥ ${cfg.pass_threshold ?? 3}${unitSuffix(unit)}</div>`
    : `<div class="config-row"><strong>Pass / Fail:</strong> <span class="muted">disabled</span></div>`;

  const ratingOptionsHtml = cfg.rating_enabled
    ? (cfg.rating_options || []).map((opt, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>
            <span class="color-dot" style="background:${opt.color || "#10b981"}"></span>
            ${escapeHtml(opt.label || "—")}
          </td>
          <td>${ratingOptionRange(opt, unit)}</td>
        </tr>`).join("")
    : `<tr><td colspan="3" class="muted">Rating options disabled</td></tr>`;

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Scoring Matrix Summary — ${escapeHtml(templateName || "Untitled")}</title>
<style>
  body { font-family: "Inter", Arial, sans-serif; color: #1e293b; margin: 32px; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; }
  .muted { color: #94a3b8; }
  .section { border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px; overflow: hidden; }
  .section-head { background: #f1f5f9; padding: 8px 12px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .section-num { background: #4f46e5; color: white; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
  .section-name { flex: 1; }
  .weight { color: #4f46e5; font-weight: 600; }
  .chip { background: #cffafe; color: #0e7490; border: 1px solid #67e8f9; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
  .criterion { padding: 8px 12px; border-top: 1px solid #f1f5f9; }
  .crit-head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  .crit-num { color: #94a3b8; font-weight: 700; }
  .crit-name { font-weight: 600; }
  .desc-table { width: 100%; border-collapse: collapse; margin-left: 24px; }
  .desc-table td { padding: 4px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  .lvl { width: 28px; text-align: center; font-weight: 700; border-radius: 50%; }
  .lvl-1 { background: #fee2e2; color: #b91c1c; }
  .lvl-2 { background: #ffedd5; color: #c2410c; }
  .lvl-3 { background: #fef9c3; color: #a16207; }
  .lvl-4 { background: #ecfccb; color: #4d7c0f; }
  .lvl-5 { background: #dcfce7; color: #166534; }
  .bp { background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 4px; padding: 6px 8px; margin-top: 6px; font-size: 12px; }
  .guidance { color: #475569; margin-top: 4px; font-style: italic; }
  .config-row { margin: 4px 0; }
  table.config { width: 100%; border-collapse: collapse; margin-top: 6px; }
  table.config th, table.config td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; font-size: 12px; }
  table.config th { background: #f1f5f9; }
  .color-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; vertical-align: middle; border: 1px solid #cbd5e1; }
  .footer { margin-top: 24px; color: #94a3b8; font-size: 11px; text-align: center; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>${escapeHtml(templateName || "Untitled Scoring Matrix")}</h1>
  <div class="meta">
    Scoring Matrix Summary · Generated ${new Date().toLocaleDateString()}
    · Unit: ${UNIT_LABELS[unit] || unit}
    · Total weight: ${totalWeight}%
  </div>

  <h2>Sections &amp; Sub-sections</h2>
  ${sectionsHtml || `<div class="muted">No sections defined.</div>`}

  <h2>Overall Rating Configuration</h2>
  ${passFailHtml}
  <div class="config-row"><strong>Rating Options:</strong></div>
  <table class="config">
    <thead><tr><th>#</th><th>Label</th><th>Range</th></tr></thead>
    <tbody>${ratingOptionsHtml}</tbody>
  </table>

  <div class="footer">Generated by MyKumpare</div>
</body>
</html>`;
}

/**
 * Download the summary as a Word-compatible .doc file (HTML-based, opens in MS Word).
 */
export function downloadScoringMatrixWord(templateName, blocks, ratingConfig) {
  const html = buildSummaryHtml(templateName, blocks, ratingConfig);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(templateName || "scoring-matrix").replace(/[^a-z0-9]+/gi, "-")}-summary.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download the summary as an Excel (.xlsx) workbook with multiple sheets:
 * Sections & Sub-sections, Descriptors, Bonus/Penalty, Rating Config.
 */
export function downloadScoringMatrixExcel(templateName, blocks = [], ratingConfig = {}) {
  const cfg = ratingConfig || {};
  const unit = cfg.unit || "none";
  const u = unitSuffix(unit);

  // Sheet 1: Sections & Sub-sections
  const sectionsRows = [
    ["Section #", "Section Name", "Weight (%)", "Multiplier", "Sub-section #", "Sub-section Name", "Category", "Multiplier"]
  ];
  blocks.forEach((block, bIdx) => {
    const criteria = block.criteria || [];
    if (criteria.length === 0) {
      sectionsRows.push([
        bIdx + 1, block.name || "", block.weight || 0,
        block.multiplier_enabled ? (block.multiplier ?? 1) : "", "", "", "", ""
      ]);
    }
    criteria.forEach((crit, cIdx) => {
      sectionsRows.push([
        bIdx + 1, block.name || "", block.weight || 0,
        block.multiplier_enabled ? (block.multiplier ?? 1) : "",
        crit.number || cIdx + 1, crit.name || "", crit.category || "",
        crit.multiplier_enabled ? (crit.multiplier ?? 1) : ""
      ]);
    });
  });

  // Sheet 2: Level descriptors
  const descriptorRows = [["Section", "Sub-section", "Level", "Descriptor"]];
  blocks.forEach((block) => {
    (block.criteria || []).forEach((crit) => {
      (crit.descriptors || []).forEach((d) => {
        descriptorRows.push([block.name || "", crit.name || "", d.level, d.text || ""]);
      });
    });
  });

  // Sheet 3: Bonus / Penalty
  const bpRows = [["Section", "Sub-section", "Enabled", "Min", "Max", "Guidance"]];
  blocks.forEach((block) => {
    (block.criteria || []).forEach((crit) => {
      if (crit.bonus_penalty_enabled) {
        bpRows.push([
          block.name || "", crit.name || "", "Yes",
          crit.bonus_penalty_range?.min ?? -1,
          crit.bonus_penalty_range?.max ?? 1,
          crit.bonus_penalty_guidance || ""
        ]);
      }
    });
  });
  if (bpRows.length === 1) bpRows.push(["", "", "No bonus/penalty adjustments configured", "", "", ""]);

  // Sheet 4: Overall rating config
  const ratingRows = [["Field", "Value"]];
  ratingRows.push(["Unit of measure", UNIT_LABELS[unit] || unit]);
  ratingRows.push(["Pass/Fail enabled", cfg.pass_fail_enabled ? "Yes" : "No"]);
  ratingRows.push([`Pass threshold${u}`, cfg.pass_fail_enabled ? (cfg.pass_threshold ?? 3) : ""]);
  ratingRows.push(["Rating options enabled", cfg.rating_enabled ? "Yes" : "No"]);
  ratingRows.push([]);
  ratingRows.push(["#", "Label", "Operator", "Min", "Max", "Color"]);
  if (cfg.rating_enabled) {
    (cfg.rating_options || []).forEach((opt, i) => {
      ratingRows.push([
        i + 1, opt.label || "", OPERATOR_LABELS[opt.operator || "between"] || opt.operator,
        opt.min_score ?? 0, opt.max_score ?? 0, opt.color || ""
      ]);
    });
  }

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(sectionsRows);
  const ws2 = XLSX.utils.aoa_to_sheet(descriptorRows);
  const ws3 = XLSX.utils.aoa_to_sheet(bpRows);
  const ws4 = XLSX.utils.aoa_to_sheet(ratingRows);
  ws1["!cols"] = [{ wch: 10 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 18 }, { wch: 10 }];
  ws2["!cols"] = [{ wch: 28 }, { wch: 30 }, { wch: 8 }, { wch: 60 }];
  ws3["!cols"] = [{ wch: 28 }, { wch: 30 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 60 }];
  ws4["!cols"] = [{ wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Sections");
  XLSX.utils.book_append_sheet(wb, ws2, "Descriptors");
  XLSX.utils.book_append_sheet(wb, ws3, "Bonus-Penalty");
  XLSX.utils.book_append_sheet(wb, ws4, "Rating Config");
  XLSX.writeFile(wb, `${(templateName || "scoring-matrix").replace(/[^a-z0-9]+/gi, "-")}-summary.xlsx`);
}

/**
 * Download the summary as a multi-page PDF. Renders the summary HTML into an
 * off-screen container, captures it with html2canvas, and slices the image
 * across PDF pages (A4 portrait).
 */
export async function downloadScoringMatrixPdf(templateName, blocks, ratingConfig) {
  const html = buildSummaryHtml(templateName, blocks, ratingConfig);

  // Off-screen container sized for A4-ish width
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.background = "#ffffff";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    // First page
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    // Subsequent pages
    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
    }

    pdf.save(`${(templateName || "scoring-matrix").replace(/[^a-z0-9]+/gi, "-")}-summary.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}