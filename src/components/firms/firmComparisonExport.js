// Firm Comparison report export utilities (PDF + CSV).
// Produces a branded PDF and a CSV that mirror the on-screen Key Metrics table
// (respecting the user's metric customization), plus an AUM-trends snapshot
// and benchmark-data section in the PDF.
//
// Uses the shared MyKumpare branding (header band + footer) for consistency
// with all other reports in the app.

import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import {
  drawReportHeader,
  drawMyKumpareBranding,
  preloadMyKumpareLogo,
} from "@/components/reports/reportBranding";
import {
  buildFirmMetrics,
  resolveMetricRows,
  fmtCurrency,
  FIRM_COLORS,
} from "@/components/firms/FirmMetricsTable";

const INK_RGB = [31, 41, 55];
const MUTED_RGB = [120, 128, 140];
const BORDER_RGB = [226, 232, 240];
const HEADER_BG_RGB = [245, 247, 250];
const ZEBRA_RGB = [248, 250, 252];

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cellText(row, m) {
  const raw = m[row.key];
  if (row.isLink && raw) return String(raw).replace(/^https?:\/\//, "");
  if (row.format) return row.format(raw);
  return raw === null || raw === undefined || raw === "" ? "—" : String(raw);
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = parseISO(d);
  return isNaN(dt.getTime()) ? d : format(dt, "MM/dd/yyyy");
}

/**
 * Build the AUM-trends snapshot table data (dates as rows, firms as columns),
 * filtered by the selected date range. Returns the most recent 18 dates so the
 * PDF stays readable.
 */
function buildAumSnapshot(firms, dateRange) {
  const dateMap = new Map();
  for (const firm of firms) {
    for (const row of firm.aum_history || []) {
      if (!row.month_end_date) continue;
      if (dateRange?.start && row.month_end_date < dateRange.start) continue;
      if (dateRange?.end && row.month_end_date > dateRange.end) continue;
      if (!dateMap.has(row.month_end_date)) {
        dateMap.set(row.month_end_date, { date: row.month_end_date });
      }
      dateMap.get(row.month_end_date)[firm.id] = toNumber(row.firm_aum);
    }
  }
  const rows = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  return rows.slice(-18);
}

/**
 * Build the benchmark-data section: per firm, list products with their default
 * benchmark and the 3 most recent monthly returns.
 */
function buildBenchmarkData(firms, products, benchmarks) {
  return firms.map((firm) => {
    const firmProducts = products.filter(
      (p) => p.firm_id === firm.id && !p.deleted_at
    );
    const items = firmProducts
      .map((p) => {
        if (!p.default_benchmark_id) return null;
        const b = benchmarks.find((x) => x.id === p.default_benchmark_id);
        if (!b) return null;
        const latest = (b.monthly_returns || [])
          .filter((r) => r.date)
          .sort((a, c) => (c.date || "").localeCompare(a.date || ""))
          .slice(0, 3);
        return { productName: p.name, benchmark: b, latest };
      })
      .filter(Boolean);
    return { firm, items };
  });
}

function ensureSpace(doc, y, needed, margin, pageH) {
  if (y + needed > pageH - margin - 20) {
    doc.addPage();
    return margin + 4;
  }
  return y;
}

function drawSectionTitle(doc, x, y, text) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  doc.text(text, x, y);
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.5);
  doc.line(x, y + 3, doc.internal.pageSize.getWidth() - x, y + 3);
  return y + 12;
}

/**
 * Render a generic table with a header row and zebra striping. Columns is an
 * array of { header, width, align }. rows is an array of arrays of strings.
 * Returns the y position after the table.
 */
function drawTable(doc, x, y, columns, rows, pageH, margin) {
  const rowH = 16;
  const headerH = 18;
  const pageW = doc.internal.pageSize.getWidth();
  const tableW = columns.reduce((s, c) => s + c.width, 0);

  // Header
  doc.setFillColor(HEADER_BG_RGB[0], HEADER_BG_RGB[1], HEADER_BG_RGB[2]);
  doc.rect(x, y, tableW, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  let cx = x;
  for (const col of columns) {
    const tx =
      col.align === "right" ? cx + col.width - 6 : col.align === "center" ? cx + col.width / 2 : cx + 6;
    doc.text(String(col.header), tx, y + headerH - 6, {
      align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
    });
    cx += col.width;
  }
  y += headerH;

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  for (let i = 0; i < rows.length; i++) {
    y = ensureSpace(doc, y, rowH, margin, pageH);
    if (i % 2 === 1) {
      doc.setFillColor(ZEBRA_RGB[0], ZEBRA_RGB[1], ZEBRA_RGB[2]);
      doc.rect(x, y, tableW, rowH, "F");
    }
    cx = x;
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const val = String(rows[i][c] ?? "—");
      const tx =
        col.align === "right" ? cx + col.width - 6 : col.align === "center" ? cx + col.width / 2 : cx + 6;
      doc.text(val.length > 48 ? val.slice(0, 46) + "…" : val, tx, y + rowH - 5, {
        align: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
      });
      cx += col.width;
    }
    y += rowH;
  }
  // outer border
  doc.setDrawColor(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  doc.setLineWidth(0.5);
  doc.rect(x, y - rows.length * rowH - headerH, tableW, rows.length * rowH + headerH);
  return y + 6;
}

/**
 * Generate and download a branded PDF of the Firm Comparison report.
 * @param {object} opts - { firms, products, benchmarks, dueDiligences, dateRange, rows }
 */
export async function exportFirmComparisonPdf({
  firms = [],
  products = [],
  benchmarks = [],
  dueDiligences = [],
  dateRange,
  rows = [],
}) {
  await preloadMyKumpareLogo();

  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  const metrics = buildFirmMetrics(firms, products, dueDiligences);
  const firmNames = firms.map((f) => f.name);
  const subtitleParts = [firmNames.join(" · ")];
  if (dateRange?.start || dateRange?.end) {
    subtitleParts.push(
      `AUM range: ${dateRange.start ? fmtDate(dateRange.start) : "earliest"} → ${
        dateRange.end ? fmtDate(dateRange.end) : "latest"
      }`
    );
  }
  const generated = `Generated ${format(new Date(), "MM/dd/yyyy h:mm a")}`;

  let y = drawReportHeader(doc, {
    title: "Firm Comparison Report",
    subtitle: subtitleParts.join("   |   "),
    margin,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  doc.text(generated, pageW - margin, y - 8, { align: "right" });

  // ── Key Metrics table ──
  y = drawSectionTitle(doc, margin, y + 4, "Key Metrics");
  const metricColW = 150;
  const firmColW = Math.max(90, (pageW - margin * 2 - metricColW) / Math.max(firms.length, 1));
  const kmColumns = [
    { header: "METRIC", width: metricColW, align: "left" },
    ...metrics.map((m, i) => ({
      header: firmNames[i] || "",
      width: firmColW,
      align: "left",
    })),
  ];
  const kmRows = rows.map((row) => [row.label, ...metrics.map((m) => cellText(row, m))]);
  y = drawTable(doc, margin, y, kmColumns, kmRows, pageH, margin);

  // ── AUM Trends snapshot ──
  const aumSnapshot = buildAumSnapshot(firms, dateRange);
  if (aumSnapshot.length > 0) {
    y = ensureSpace(doc, y, 60, margin, pageH);
    y = drawSectionTitle(doc, margin, y + 4, "AUM Trends (Month-End)");
    const aumColumns = [
      { header: "DATE", width: metricColW, align: "left" },
      ...metrics.map((m, i) => ({
        header: firmNames[i] || "",
        width: firmColW,
        align: "right",
      })),
    ];
    const aumRows = aumSnapshot.map((r) => [
      fmtDate(r.date),
      ...metrics.map((m) => {
        const v = r[m.firm.id];
        return v === undefined ? "—" : fmtCurrency(v);
      }),
    ]);
    y = drawTable(doc, margin, y, aumColumns, aumRows, pageH, margin);
  }

  // ── Benchmark Data ──
  const benchData = buildBenchmarkData(firms, products, benchmarks);
  const hasBench = benchData.some((b) => b.items.length > 0);
  if (hasBench) {
    y = ensureSpace(doc, y, 60, margin, pageH);
    y = drawSectionTitle(doc, margin, y + 4, "Benchmark Data");
    const bColumns = [
      { header: "FIRM", width: 160, align: "left" },
      { header: "PRODUCT", width: 180, align: "left" },
      { header: "BENCHMARK", width: 180, align: "left" },
      { header: "ASSET CLASS", width: 90, align: "left" },
      { header: "RECENT RETURNS", width: 150, align: "left" },
    ];
    const bRows = [];
    for (const { firm, items } of benchData) {
      if (items.length === 0) {
        bRows.push([firm.name, "—", "No benchmarks assigned", "", ""]);
      } else {
        for (const it of items) {
          const rets = it.latest
            .map((r) => {
              const v = toNumber(r.return_value);
              return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
            })
            .join("   ");
          bRows.push([
            firm.name,
            it.productName,
            it.benchmark.name,
            it.benchmark.asset_class || "—",
            rets || "No returns",
          ]);
        }
      }
    }
    y = drawTable(doc, margin, y, bColumns, bRows, pageH, margin);
  }

  drawMyKumpareBranding(doc, { margin });

  const fileFirms = firmNames.slice(0, 3).join("_") || "firms";
  const datePart = format(new Date(), "yyyy-MM-dd");
  doc.save(`Firm_Comparison_${fileFirms}_${datePart}.pdf`);
}

/**
 * Generate and download a CSV of the Key Metrics table.
 * @param {object} opts - { firms, products, dueDiligences, rows }
 */
export function exportFirmComparisonCsv({ firms = [], products = [], dueDiligences = [], rows = [] }) {
  const metrics = buildFirmMetrics(firms, products, dueDiligences);
  const header = ["Metric", ...firms.map((f) => f.name)];
  const body = rows.map((row) => [row.label, ...metrics.map((m) => cellText(row, m))]);
  const all = [header, ...body];
  const csv = all
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fileFirms = firms.map((f) => f.name).slice(0, 3).join("_") || "firms";
  a.download = `Firm_Comparison_${fileFirms}_${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { resolveMetricRows };