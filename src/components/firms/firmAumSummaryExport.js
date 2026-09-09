/**
 * Export helpers for the Firm AUM Summary page.
 * Builds a CSV from the firm + product data and triggers a browser download.
 */

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function getLatestProductAum(product) {
  if (!product.aum_history || product.aum_history.length === 0) return 0;
  const sorted = [...product.aum_history].sort(
    (a, b) => new Date(b.month_end_date || 0) - new Date(a.month_end_date || 0)
  );
  return sorted[0]?.firm_aum || 0;
}

function getLatestAumDate(products) {
  let latest = null;
  for (const p of products) {
    if (!p.aum_history) continue;
    for (const entry of p.aum_history) {
      const d = entry.month_end_date;
      if (d && (!latest || d > latest)) latest = d;
    }
  }
  return latest;
}

/**
 * Build the firm → AUM summary rows (mirrors FirmAumSummarySection logic).
 */
export function buildFirmAumRows(firms, products) {
  const firmMap = new Map();
  for (const firm of firms) {
    firmMap.set(firm.id, {
      firm,
      productCount: 0,
      totalAum: 0,
      productsWithAum: 0,
    });
  }
  for (const product of products) {
    const entry = firmMap.get(product.firm_id);
    if (!entry) continue;
    entry.productCount++;
    const aum = getLatestProductAum(product);
    if (aum > 0) entry.productsWithAum++;
    entry.totalAum += aum;
  }
  return Array.from(firmMap.values())
    .filter((e) => e.productCount > 0 || e.totalAum > 0)
    .sort((a, b) => b.totalAum - a.totalAum);
}

function escapeCsv(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generate a CSV string and trigger a download.
 */
export function exportFirmAumSummaryCsv(firms, products) {
  const rows = buildFirmAumRows(firms, products);
  const latestDate = getLatestAumDate(products);
  const grandTotal = rows.reduce((sum, e) => sum + e.totalAum, 0);
  const totalProducts = rows.reduce((sum, e) => sum + e.productCount, 0);
  const firmsWithAum = rows.filter((e) => e.totalAum > 0).length;

  const header = [
    "Firm Name",
    "Firm Type",
    "Products",
    "Products with AUM",
    "Total AUM",
  ];

  const lines = [header.join(",")];

  for (const entry of rows) {
    lines.push(
      [
        escapeCsv(entry.firm.name),
        escapeCsv(entry.firm.firm_type || ""),
        entry.productCount,
        entry.productsWithAum,
        entry.totalAum,
      ].join(",")
    );
  }

  // Grand total row
  lines.push(
    [
      escapeCsv("Grand Total"),
      "",
      totalProducts,
      firmsWithAum,
      grandTotal,
    ].join(",")
  );

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = latestDate ? latestDate.replace(/-/g, "") : new Date().toISOString().slice(0, 10).replace(/-/g, "");
  link.href = url;
  link.download = `firm_aum_summary_${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}