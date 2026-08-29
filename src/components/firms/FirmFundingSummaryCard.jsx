import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { base44 } from "@/api/base44Client";
import { Wallet, TrendingUp, Package, Loader2, Download, BarChart3, Users } from "lucide-react";

const PRODUCT_BAR_COLORS = ["#6366f1", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"];

/**
 * Summary card displayed at the top of the firm profile page.
 * Shows four aggregated metrics:
 *  1. Total Funding Amount — net funding across all funded client portfolios (allocation history)
 *  2. Funded Products — count of the firm's products with funding_status = "Funded"
 *  3. Total Market Value — sum of latest product AUM across all client portfolios, with the most recent market value date
 *  4. Funded Clients — count of active client portfolios referencing this firm's products
 */
export default function FirmFundingSummaryCard({ firmId, firmName }) {
  const [downloading, setDownloading] = useState(false);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products_funding_summary", firmId],
    queryFn: () => base44.entities.Product.filter({ firm_id: firmId }),
    enabled: !!firmId,
  });

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery({
    queryKey: ["portfolios_funding_summary", firmId],
    queryFn: () => base44.entities.Portfolio.filter({ advisor_firm_id: firmId }),
    enabled: !!firmId,
  });

  const { data: firm } = useQuery({
    queryKey: ["firm_funding_summary", firmId],
    queryFn: () => base44.entities.Firm.get(firmId),
    enabled: !!firmId,
  });

  const {
    totalFunding,
    fundedProductCount,
    totalMarketValue,
    marketValueDate,
    fundedClientCount,
    marketValueProducts,
  } = useMemo(() => {
    // ── 1. Total Funding Amount: net funding across all funded client portfolios ──
    // Sum advisor-level allocation_history records (Initial Allocation + Capital Addition − Redemption).
    // Fall back to advisor_initial_allocation_amount when no advisor-level records exist.
    let funding = 0;
    let clientCount = 0;
    for (const p of portfolios) {
      if (p.deleted_at) continue;
      if ((p.funding_status || "Active") !== "Active") continue;
      clientCount++;
      const advisorRecords = (p.allocation_history || []).filter(
        (r) => r.level === "advisor" && !r.deleted_at
      );
      if (advisorRecords.length > 0) {
        for (const r of advisorRecords) {
          const amt = Number(r.amount) || 0;
          if (r.activity_type === "Redemption") {
            funding -= Math.abs(amt);
          } else {
            funding += amt;
          }
        }
      } else {
        funding += Number(p.advisor_initial_allocation_amount) || 0;
      }
    }

    // ── 2. Funded Products: count of products with funding_status = "Funded" ──
    const fundedCount = products.filter(
      (p) => !p.deleted_at && p.funding_status === "Funded"
    ).length;

    // ── 3. Total Market Value: sum of latest product AUM across all products ──
    let marketValue = 0;
    let mvDate = null;
    const mvProducts = [];
    for (const p of products) {
      if (p.deleted_at) continue;
      const history = (p.aum_history || []).filter((h) => h.month_end_date);
      if (history.length === 0) continue;
      history.sort((a, b) => new Date(b.month_end_date) - new Date(a.month_end_date));
      const latestEntry = history[0];
      const aum = Number(latestEntry.firm_aum) || 0;
      marketValue += aum;
      mvProducts.push({
        name: p.name,
        aum,
        fundingStatus: p.funding_status,
        date: latestEntry.month_end_date,
      });
      if (!mvDate || new Date(latestEntry.month_end_date) > new Date(mvDate)) {
        mvDate = latestEntry.month_end_date;
      }
    }

    return {
      totalFunding: funding,
      fundedProductCount: fundedCount,
      totalMarketValue: marketValue,
      marketValueDate: mvDate,
      fundedClientCount: clientCount,
      marketValueProducts: mvProducts,
    };
  }, [products, portfolios]);

  // Bar chart data — each product's latest AUM, sorted descending
  const chartData = useMemo(
    () =>
      [...marketValueProducts]
        .sort((a, b) => b.aum - a.aum)
        .map((p) => ({
          name: p.name.length > 22 ? p.name.slice(0, 20) + "…" : p.name,
          aum: p.aum,
        })),
    [marketValueProducts]
  );

  const isLoading = productsLoading || portfoliosLoading;

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
        {/* Total Funding Amount */}
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Funding Amount</p>
          <p className="text-2xl font-bold text-gray-900 leading-tight">
            {formatCurrency(totalFunding)}
          </p>
        </div>
        <div className="flex items-center gap-5 flex-wrap ml-auto">
          {/* Funded Products */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center text-xs text-gray-500 mb-0.5">
              <Package className="w-3.5 h-3.5" />
              <span>Funded Products</span>
            </div>
            <p className="text-lg font-bold text-indigo-700">{fundedProductCount}</p>
          </div>
          {/* Total Market Value + date */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center text-xs text-gray-500 mb-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Total Market Value</span>
            </div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{formatCurrency(totalMarketValue)}</p>
            {marketValueDate && (
              <p className="text-[11px] text-gray-500">as of {formatDate(marketValueDate)}</p>
            )}
          </div>
          {/* Funded Clients */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center text-xs text-gray-500 mb-0.5">
              <Users className="w-3.5 h-3.5" />
              <span>Funded Clients</span>
            </div>
            <p className="text-lg font-bold text-indigo-700">{fundedClientCount}</p>
          </div>
          <button
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadFirmReport(firm, products, portfolios, firmName);
              } finally {
                setDownloading(false);
              }
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
      {marketValueProducts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-indigo-100/80 flex flex-wrap gap-1.5">
          {marketValueProducts.slice(0, 6).map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs"
              title={`${p.name} — ${formatCurrency(p.aum)}`}
            >
              <span className="font-medium text-gray-700 truncate max-w-[140px]">{p.name}</span>
              <span className="font-semibold text-indigo-600">{formatCompactCurrency(p.aum)}</span>
            </span>
          ))}
          {marketValueProducts.length > 6 && (
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              +{marketValueProducts.length - 6} more
            </span>
          )}
        </div>
      )}
      {marketValueProducts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-indigo-100/80">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-xs font-semibold text-gray-600">Product AUM (Market Value)</span>
            <span className="ml-auto text-[11px] text-gray-400">Latest month-end AUM per product</span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(140, marketValueProducts.length * 38)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2ff" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: "#374151" }}
                axisLine={false}
                tickLine={false}
                width={130}
              />
              <Tooltip
                cursor={{ fill: "#f5f3ff" }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                formatter={(v) => [formatCurrency(v), "AUM"]}
              />
              <Bar dataKey="aum" name="AUM" radius={[0, 6, 6, 0]} barSize={18}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={PRODUCT_BAR_COLORS[i % PRODUCT_BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
 * Includes the firm-level AUM history, each linked product's AUM history,
 * and each client portfolio's allocation history.
 */
async function downloadFirmReport(firm, products, portfolios, firmName) {
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

  // ── Client portfolio allocation history ──
  const activePortfolios = (portfolios || []).filter((p) => !p.deleted_at);
  if (activePortfolios.length > 0) {
    rows.push(["Client Portfolio Allocation History"]);
    rows.push(["Portfolio", "Activity Date", "Activity Type", "Level", "Amount", "Notes"]);
    for (const p of activePortfolios) {
      const allocHistory = (p.allocation_history || [])
        .filter((r) => !r.deleted_at)
        .sort((a, b) => new Date(a.activity_date || 0) - new Date(b.activity_date || 0));
      for (const r of allocHistory) {
        rows.push([
          p.portfolio_name || "",
          r.activity_date || "",
          r.activity_type || "",
          r.level || "",
          Number(r.amount) || 0,
          (r.notes || "").replace(/<[^>]*>/g, ""),
        ]);
      }
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