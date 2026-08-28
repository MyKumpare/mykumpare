// Export helpers for the Firm Summary Report.
// Produces a branded PDF (jsPDF) and a CSV spreadsheet from the report's
// computed metrics, reusing the shared MyKumpare branding helpers.

import { jsPDF } from "jspdf";
import {
  drawReportHeader,
  drawMyKumpareBranding,
  preloadMyKumpareLogo,
} from "@/components/reports/reportBranding";

const INK_RGB = [31, 41, 55];
const MUTED_RGB = [120, 128, 140];
const BORDER_RGB = [226, 232, 240];
const TEAL_RGB = [13, 148, 136];

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function fullCurrency(v) {
  if (v == null) return "";
  return `$${Number(v).toLocaleString("en-US")}`;
}

function compactCurrency(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fileTimestamp() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Builds and downloads a branded PDF of the Firm Summary Report.
 *
 * @param {object} report - The report's computed metrics:
 *   { scopeLabel, kpis: {firms, aum, products, contacts, scoredFirms},
 *     aumByType, topFirms, productStatus, fundingStatus, scoreRatings, firmMetrics }
 */
export async function exportFirmSummaryPdf(report) {
  // Ensure the brand logo raster is ready before we draw.
  await preloadMyKumpareLogo().catch(() => {});

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableW = pageW - margin * 2;

  let y = drawReportHeader(doc, {
    margin,
    title: "Firm Summary Report",
    subtitle: `${report.scopeLabel}  •  Generated ${todayStr()}`,
  });

  const ensureSpace = (need) => {
    if (y + need > pageH - 60) {
      doc.addPage();
      y = drawReportHeader(doc, { margin });
    }
  };

  // ── KPI strip ──
  const kpis = [
    { label: "Total Firms", value: String(report.kpis.firms ?? 0) },
    { label: "Total AUM", value: compactCurrency(report.kpis.aum) },
    { label: "Products", value: String(report.kpis.products ?? 0) },
    { label: "Contacts", value: String(report.kpis.contacts ?? 0) },
    { label: "Scored Firms", value: String(report.kpis.scoredFirms ?? 0) },
  ];
  const kpiW = usableW / kpis.length;
  const kpiH = 44;
  ensureSpace(kpiH + 12);
  kpis.forEach((k, i) => {
    const x = margin + i * kpiW;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x + 2, y, kpiW - 6, kpiH, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(k.value, x + 10, y + 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(k.label, x + 10, y + 34);
  });
  y += kpiH + 18;

  // Helper to render a titled section with a simple two-column table.
  const renderTable = (title, headers, rows) => {
    ensureSpace(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(title, margin, y);
    y += 14;

    const colW = usableW / headers.length;
    // header row
    doc.setFillColor(240, 245, 244);
    doc.rect(margin, y, usableW, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(TEAL_RGB[0], TEAL_RGB[1], TEAL_RGB[2]);
    headers.forEach((h, i) => {
      doc.text(h, margin + i * colW + 6, y + 12);
    });
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    rows.forEach((row, ri) => {
      ensureSpace(16);
      if (ri % 2 === 1) {
        doc.setFillColor(249, 251, 251);
        doc.rect(margin, y, usableW, 15, "F");
      }
      row.forEach((cell, i) => {
        const txt = String(cell ?? "");
        const clipped = txt.length > 40 ? txt.slice(0, 38) + "…" : txt;
        doc.text(clipped, margin + i * colW + 6, y + 11);
      });
      y += 15;
    });
    y += 12;
  };

  // ── AUM by Firm Type ──
  if (report.aumByType?.length) {
    renderTable(
      "AUM by Firm Type",
      ["Firm Type", "AUM"],
      report.aumByType.map((r) => [r.name, compactCurrency(r.value)])
    );
  }

  // ── Top 10 Firms by AUM ──
  if (report.topFirms?.length) {
    renderTable(
      "Top 10 Firms by AUM",
      ["Firm", "AUM"],
      report.topFirms.map((r) => [r.name, compactCurrency(r.aum)])
    );
  }

  // ── Product Status Distribution ──
  if (report.productStatus?.length) {
    renderTable(
      "Product Status Distribution",
      ["Status", "Count"],
      report.productStatus.map((r) => [r.name, r.value])
    );
  }

  // ── Funding Status ──
  if (report.fundingStatus?.length) {
    renderTable(
      "Funding Status",
      ["Status", "Count"],
      report.fundingStatus.map((r) => [r.name, r.value])
    );
  }

  // ── Score Rating Distribution ──
  if (report.scoreRatings?.length) {
    renderTable(
      "Score Rating Distribution",
      ["Rating", "Count"],
      report.scoreRatings.map((r) => [r.name, r.value])
    );
  }

  // ── Firm Performance Summary ──
  if (report.firmMetrics?.length) {
    renderTable(
      "Firm Performance Summary",
      ["Firm", "Type(s)", "AUM", "Products", "Contacts", "Rating", "Pass/Fail", "Funding"],
      report.firmMetrics.map((f) => [
        f.name,
        (f.types || []).join("; "),
        compactCurrency(f.aum),
        f.productCount,
        f.contactCount,
        f.score || "—",
        f.passFail || "—",
        f.fundingStatus || "—",
      ])
    );
  }

  drawMyKumpareBranding(doc, { margin });
  doc.save(`firm_summary_report_${fileTimestamp()}.pdf`);
}

/**
 * Builds and downloads a CSV spreadsheet of the Firm Summary Report.
 * Contains a KPI summary block, distribution tables, and the full firm
 * performance table.
 *
 * @param {object} report - Same shape as exportFirmSummaryPdf.
 */
export function exportFirmSummaryCsv(report) {
  const lines = [];

  const section = (title) => {
    lines.push("");
    lines.push(title);
  };

  lines.push("Firm Summary Report");
  lines.push(`${report.scopeLabel}`);
  lines.push(`Generated,${todayStr()}`);

  section("Summary KPIs");
  lines.push(["Metric", "Value"].map(csvEscape).join(","));
  lines.push(
    [
      "Total Firms",
      "Total AUM",
      "Total Products",
      "Total Contacts",
      "Firms with Scores",
    ].join(",")
  );
  lines.push(
    [
      report.kpis.firms ?? 0,
      fullCurrency(report.kpis.aum),
      report.kpis.products ?? 0,
      report.kpis.contacts ?? 0,
      report.kpis.scoredFirms ?? 0,
    ].join(",")
  );

  const distTable = (title, headers, rows) => {
    section(title);
    lines.push(headers.map(csvEscape).join(","));
    rows.forEach((r) => lines.push(r.map(csvEscape).join(",")));
  };

  if (report.aumByType?.length) {
    distTable("AUM by Firm Type", ["Firm Type", "AUM"], report.aumByType.map((r) => [r.name, fullCurrency(r.value)]));
  }
  if (report.topFirms?.length) {
    distTable("Top 10 Firms by AUM", ["Firm", "AUM"], report.topFirms.map((r) => [r.name, fullCurrency(r.aum)]));
  }
  if (report.productStatus?.length) {
    distTable("Product Status Distribution", ["Status", "Count"], report.productStatus.map((r) => [r.name, r.value]));
  }
  if (report.fundingStatus?.length) {
    distTable("Funding Status", ["Status", "Count"], report.fundingStatus.map((r) => [r.name, r.value]));
  }
  if (report.scoreRatings?.length) {
    distTable("Score Rating Distribution", ["Rating", "Count"], report.scoreRatings.map((r) => [r.name, r.value]));
  }

  if (report.firmMetrics?.length) {
    distTable(
      "Firm Performance Summary",
      ["Firm", "Type(s)", "AUM", "Products", "Contacts", "Rating", "Pass/Fail", "Funding"],
      report.firmMetrics.map((f) => [
        f.name,
        (f.types || []).join("; "),
        fullCurrency(f.aum),
        f.productCount,
        f.contactCount,
        f.score || "",
        f.passFail || "",
        f.fundingStatus || "",
      ])
    );
  }

  const csv = lines.join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `firm_summary_report_${fileTimestamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}