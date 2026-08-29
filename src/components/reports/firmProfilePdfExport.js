// Per-firm comprehensive PDF report generator.
// Produces a branded PDF (jsPDF) for a single firm with firm overview,
// KPI strip, AUM history table, and performance metrics.
// Reuses the shared MyKumpare branding helpers.

import { jsPDF } from "jspdf";
import {
  drawReportHeader,
  drawMyKumpareBranding,
  preloadMyKumpareLogo,
  rasterizeImage,
} from "@/components/reports/reportBranding";

const INK_RGB = [31, 41, 55];
const MUTED_RGB = [120, 128, 140];
const BORDER_RGB = [226, 232, 240];
const TEAL_RGB = [13, 148, 136];
const GREEN_RGB = [16, 185, 129];
const RED_RGB = [239, 68, 68];

function compactCurrency(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function fullCurrency(v) {
  if (v == null) return "—";
  return `$${Number(v).toLocaleString("en-US")}`;
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fileTimestamp() {
  return new Date().toISOString().slice(0, 10);
}

function getFirmTypes(f) {
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}

function getLatestAum(firm) {
  const hist = firm?.aum_history || [];
  if (!hist.length) return null;
  const latest = [...hist].sort((a, b) => (b.month_end_date || "").localeCompare(a.month_end_date || ""))[0];
  return latest;
}

function getFirstAum(firm) {
  const hist = firm?.aum_history || [];
  if (!hist.length) return null;
  return [...hist].sort((a, b) => (a.month_end_date || "").localeCompare(b.month_end_date || ""))[0];
}

/**
 * Builds and downloads a branded per-firm PDF report.
 * @param {object} firm - The firm record (with aum_history embedded)
 * @param {Array} [products] - The firm's products (optional)
 */
export async function exportFirmProfilePdf(firm, products = []) {
  if (!firm) return;

  await preloadMyKumpareLogo().catch(() => {});
  const firmLogoDataUrl = await rasterizeImage(firm.logo_url, 96).catch(() => null);

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableW = pageW - margin * 2;

  let y = drawReportHeader(doc, {
    margin,
    title: firm.name || "Firm Report",
    subtitle: `${getFirmTypes(firm).join(", ") || "Firm"}  •  Generated ${todayStr()}`,
    firmName: firm.name,
    firmLogoDataUrl,
  });

  const ensureSpace = (need) => {
    if (y + need > pageH - 60) {
      doc.addPage();
      y = drawReportHeader(doc, { margin });
    }
  };

  // ── Firm Overview ──
  ensureSpace(80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  doc.text("Firm Overview", margin, y);
  y += 16;

  const overview = [
    ["Location", firm.location || "—"],
    ["Website", firm.website || "—"],
    ["Year Founded", firm.year_founded ? String(firm.year_founded) : "—"],
    ["Geographic Region", firm.geographic_region && firm.geographic_region !== "Undefined" ? firm.geographic_region : "—"],
    ["Email", firm.email || "—"],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  overview.forEach(([label, val]) => {
    ensureSpace(14);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(label, margin, y);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(String(val).slice(0, 70), margin + 90, y);
    y += 14;
  });

  if (firm.description) {
    ensureSpace(30);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text("Description:", margin, y);
    y += 12;
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    const lines = doc.splitTextToSize(firm.description.slice(0, 500), usableW);
    lines.forEach((ln) => {
      ensureSpace(12);
      doc.text(ln, margin, y);
      y += 12;
    });
  }
  y += 10;

  // ── KPI Strip ──
  const latest = getLatestAum(firm);
  const first = getFirstAum(firm);
  const growthPct = latest?.firm_aum && first?.firm_aum && first.firm_aum !== 0
    ? ((latest.firm_aum - first.firm_aum) / first.firm_aum) * 100
    : null;
  const aumPoints = (firm.aum_history || []).length;
  const firmProducts = (products || []).filter((p) => p.firm_id === firm.id && !p.deleted_at);

  const kpis = [
    { label: "Latest AUM", value: compactCurrency(latest?.firm_aum) },
    { label: "Net Flow (Latest)", value: compactCurrency(latest?.net_asset_flows) },
    { label: "Growth %", value: growthPct != null ? `${growthPct.toFixed(1)}%` : "—" },
    { label: "Products", value: String(firmProducts.length) },
    { label: "AUM Data Points", value: String(aumPoints) },
  ];
  const kpiW = usableW / kpis.length;
  const kpiH = 44;
  ensureSpace(kpiH + 14);
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

  // ── Performance Metrics Summary ──
  const hist = (firm.aum_history || []).slice().sort((a, b) => (a.month_end_date || "").localeCompare(b.month_end_date || ""));
  const totalNetFlow = hist.reduce((s, h) => s + (h.net_asset_flows || 0), 0);
  const totalGained = hist.reduce((s, h) => s + (h.assets_gained || 0), 0);
  const totalLoss = hist.reduce((s, h) => s + (h.assets_loss || 0), 0);
  const avgMonthlyFlow = hist.length ? totalNetFlow / hist.length : 0;
  const flows = hist.map((h) => h.net_asset_flows || 0).filter((v) => v != null);
  const bestMonth = flows.length ? Math.max(...flows) : null;
  const worstMonth = flows.length ? Math.min(...flows) : null;

  ensureSpace(80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  doc.text("Performance Metrics", margin, y);
  y += 16;

  const metrics = [
    ["First Recorded AUM", fullCurrency(first?.firm_aum), fmtDate(first?.month_end_date)],
    ["Latest AUM", fullCurrency(latest?.firm_aum), fmtDate(latest?.month_end_date)],
    ["Total Growth", growthPct != null ? `${growthPct.toFixed(1)}%` : "—", ""],
    ["Total Net Flow (All Periods)", fullCurrency(totalNetFlow), ""],
    ["Total Assets Gained", fullCurrency(totalGained), ""],
    ["Total Assets Loss", fullCurrency(totalLoss), ""],
    ["Avg Monthly Net Flow", fullCurrency(avgMonthlyFlow), ""],
    ["Best Month Net Flow", fullCurrency(bestMonth), ""],
    ["Worst Month Net Flow", fullCurrency(worstMonth), ""],
  ];

  // table header
  doc.setFillColor(240, 245, 244);
  doc.rect(margin, y, usableW, 18, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(TEAL_RGB[0], TEAL_RGB[1], TEAL_RGB[2]);
  doc.text("Metric", margin + 6, y + 12);
  doc.text("Value", margin + 250, y + 12);
  doc.text("As of", margin + 380, y + 12);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  metrics.forEach((row, ri) => {
    ensureSpace(15);
    if (ri % 2 === 1) {
      doc.setFillColor(249, 251, 251);
      doc.rect(margin, y, usableW, 14, "F");
    }
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text(String(row[0]), margin + 6, y + 10);
    // Color net flow values green/red
    if (row[0].includes("Net Flow") || row[0].includes("Gained") || row[0].includes("Loss")) {
      const num = parseFloat(String(row[1]).replace(/[^0-9.-]/g, ""));
      if (!isNaN(num)) {
        if (num > 0) doc.setTextColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]);
        else if (num < 0) doc.setTextColor(RED_RGB[0], RED_RGB[1], RED_RGB[2]);
      }
    }
    doc.text(String(row[1]), margin + 250, y + 10);
    doc.setTextColor(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
    doc.text(String(row[2]), margin + 380, y + 10);
    y += 14;
  });
  y += 14;

  // ── AUM History Table ──
  if (hist.length > 0) {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text("AUM History", margin, y);
    y += 16;

    const headers = ["Date", "Firm AUM", "Gained", "Loss", "Net Flow"];
    const colW = usableW / headers.length;

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
    [...hist].reverse().forEach((h, ri) => {
      ensureSpace(15);
      if (ri % 2 === 1) {
        doc.setFillColor(249, 251, 251);
        doc.rect(margin, y, usableW, 14, "F");
      }
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.text(fmtDate(h.month_end_date), margin + 6, y + 10);
      doc.text(compactCurrency(h.firm_aum), margin + colW + 6, y + 10);

      // Gained — green
      doc.setTextColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]);
      doc.text(compactCurrency(h.assets_gained), margin + colW * 2 + 6, y + 10);

      // Loss — red
      doc.setTextColor(RED_RGB[0], RED_RGB[1], RED_RGB[2]);
      doc.text(compactCurrency(h.assets_loss), margin + colW * 3 + 6, y + 10);

      // Net flow — green/red
      const nf = h.net_asset_flows || 0;
      if (nf > 0) doc.setTextColor(GREEN_RGB[0], GREEN_RGB[1], GREEN_RGB[2]);
      else if (nf < 0) doc.setTextColor(RED_RGB[0], RED_RGB[1], RED_RGB[2]);
      else doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.text(compactCurrency(nf), margin + colW * 4 + 6, y + 10);

      y += 14;
    });
    y += 14;
  }

  // ── Products ──
  if (firmProducts.length > 0) {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
    doc.text("Products", margin, y);
    y += 16;

    const headers = ["Product", "Type", "Status", "Funding"];
    const colW = usableW / headers.length;
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
    firmProducts.forEach((p, ri) => {
      ensureSpace(15);
      if (ri % 2 === 1) {
        doc.setFillColor(249, 251, 251);
        doc.rect(margin, y, usableW, 14, "F");
      }
      doc.setTextColor(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
      doc.text(String(p.name || "—").slice(0, 40), margin + 6, y + 10);
      doc.text(String(p.product_type || "—").slice(0, 24), margin + colW + 6, y + 10);
      doc.text(String(p.product_status || "—"), margin + colW * 2 + 6, y + 10);
      doc.text(String(p.funding_status || "—"), margin + colW * 3 + 6, y + 10);
      y += 14;
    });
  }

  // ── Branding footer on every page ──
  drawMyKumpareBranding(doc, { margin });

  const safeName = (firm.name || "firm").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  doc.save(`${safeName}-report-${fileTimestamp()}.pdf`);
}