import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Wallet, TrendingUp, Package, Loader2, Download } from "lucide-react";
import FundingStatusBadge from "@/components/products/FundingStatusBadge";

/**
 * Summary card displayed at the top of the firm profile page.
 * Calculates and displays the total funding amount for a specific firm
 * based on its linked products' latest AUM history entries.
 */
export default function FirmFundingSummaryCard({ firmId, firmName }) {
  const [downloading, setDownloading] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products_funding_summary", firmId],
    queryFn: () => base44.entities.Product.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });

  const { data: firm } = useQuery({
    queryKey: ["firm_funding_summary", firmId],
    queryFn: () => base44.entities.Firm.get(firmId),
    enabled: !!firmId,
  });

  const { totalFunding, fundedProductCount, fundedProducts, latestDate } = useMemo(() => {
    let total = 0;
    let count = 0;
    let latest = null;
    const funded = [];
    for (const p of products) {
      if (p.deleted_at) continue;
      // Get the latest AUM history entry for this product
      const history = (p.aum_history || []).filter((h) => h.month_end_date);
      if (history.length === 0) continue;
      history.sort((a, b) => new Date(b.month_end_date) - new Date(a.month_end_date));
      const latestEntry = history[0];
      const aum = Number(latestEntry.firm_aum) || 0;
      total += aum;
      count += 1;
      funded.push({ name: p.name, aum, fundingStatus: p.funding_status, date: latestEntry.month_end_date });
      if (!latest || new Date(latestEntry.month_end_date) > new Date(latest)) {
        latest = latestEntry.month_end_date;
      }
    }
    return { totalFunding: total, fundedProductCount: count, fundedProducts: funded, latestDate: latest };
  }, [products]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!firmId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3 text-center text-xs text-gray-400 italic">
        Save the firm to view its funding summary.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-violet-50/50 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Funding Amount</p>
          <p className="text-2xl font-bold text-gray-900 leading-tight">
            {formatCurrency(totalFunding)}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center text-xs text-gray-500 mb-0.5">
              <Package className="w-3.5 h-3.5" />
              <span>Funded Products</span>
            </div>
            <p className="text-lg font-bold text-indigo-700">{fundedProductCount}</p>
          </div>
          {latestDate && (
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center text-xs text-gray-500 mb-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>As of</span>
              </div>
              <p className="text-sm font-semibold text-gray-700">{formatDate(latestDate)}</p>
            </div>
          )}
          <button
          onClick={async () => {
            setDownloading(true);
            try { await downloadFirmReport(firm, products, firmName); }
            finally { setDownloading(false); }
          }}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 transition-colors"
          title="Download a CSV report of all assets and net flows for this firm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? "Preparing…" : "Download Report"}</span>
          </button>
        </div>
      </div>
      {fundedProducts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-indigo-100/80 flex flex-wrap gap-1.5">
          {fundedProducts.slice(0, 6).map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs"
              title={`${p.name} — ${formatCurrency(p.aum)}`}
            >
              <span className="font-medium text-gray-700 truncate max-w-[140px]">{p.name}</span>
              <span className="font-semibold text-indigo-600">{formatCompactCurrency(p.aum)}</span>
            </span>
          ))}
          {fundedProducts.length > 6 && (
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              +{fundedProducts.length - 6} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function formatCurrency(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatCompactCurrency(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Generates and downloads a CSV report of all assets and net flows for a firm.
 * Includes the firm-level AUM history and each linked product's AUM history.
 */
async function downloadFirmReport(firm, products, firmName) {
  const rows = [];
  rows.push(["Firm Assets & Net Flows Report"]);
  rows.push(["Firm", firmName || firm?.name || ""]);
  rows.push(["Generated", new Date().toLocaleString("en-US")]);
  rows.push([]);

  // ── Firm-level AUM history ──
  rows.push(["Firm-Level AUM History"]);
  rows.push(["Month-End Date", "Firm AUM", "Assets Gained", "Assets Loss", "Net Asset Flows"]);
  const firmHistory = (firm?.aum_history || [])
    .filter((h) => h.month_end_date)
    .sort((a, b) => new Date(a.month_end_date) - new Date(b.month_end_date));
  for (const h of firmHistory) {
    rows.push([
      h.month_end_date,
      Number(h.firm_aum) || 0,
      Number(h.assets_gained) || 0,
      Number(h.assets_loss) || 0,
      Number(h.net_asset_flows) || 0,
    ]);
  }
  rows.push([]);

  // ── Per-product AUM history ──
  const activeProducts = (products || []).filter((p) => !p.deleted_at);
  for (const p of activeProducts) {
    const history = (p.aum_history || [])
      .filter((h) => h.month_end_date)
      .sort((a, b) => new Date(a.month_end_date) - new Date(b.month_end_date));
    if (history.length === 0) continue;
    rows.push([`Product: ${p.name}`]);
    rows.push(["Month-End Date", "Product AUM", "Assets Gained", "Assets Loss", "Net Asset Flows"]);
    for (const h of history) {
      rows.push([
        h.month_end_date,
        Number(h.firm_aum) || 0,
        Number(h.assets_gained) || 0,
        Number(h.assets_loss) || 0,
        Number(h.net_asset_flows) || 0,
      ]);
    }
    rows.push([]);
  }

  // Convert to CSV with proper escaping
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = (firmName || firm?.name || "firm").replace(/[^a-z0-9]+/gi, "_");
  link.href = url;
  link.download = `${safeName}_Assets_NetFlows_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}