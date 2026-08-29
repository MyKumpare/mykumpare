import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Package, Loader2, Download, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  fetchFirmAssociatedPortfolios,
  computePortfolioNetFunding,
} from "./firmPortfolioLookup";
import FundingBreakdownDialog from "./FundingBreakdownDialog";

/**
 * Summary card displayed at the top of the firm profile page.
 * Shows four aggregated metrics in this order:
 *  1. Total Funding Amount — net funding across all associated client portfolios
 *  2. Total Market Value    — sum of latest product AUM across all products
 *  3. Funded Clients        — count of active client portfolios referencing this firm's products
 *  4. Funded Products       — count of the firm's products with funding_status = "Funded"
 *
 * Each metric is clickable and opens a drill-down dialog showing the breakdown by
 * client portfolio or product, with hyperlinks back to the source portfolio.
 */
export default function FirmFundingSummaryCard({ firmId, firmName, onPortfolioClick }) {
  const [downloading, setDownloading] = useState(false);
  const [breakdown, setBreakdown] = useState(null); // { type, title, subtitle, items }

  // Fetch all portfolios associated with this firm (allocator + advisor + sub-manager),
  // plus the firm's products. This covers the sub-manager case the old advisor-only
  // filter missed.
  const { data, isLoading } = useQuery({
    queryKey: ["firm_funding_summary", firmId],
    queryFn: () => fetchFirmAssociatedPortfolios(firmId),
    enabled: !!firmId,
  });

  const { data: firm } = useQuery({
    queryKey: ["firm_record", firmId],
    queryFn: () => base44.entities.Firm.get(firmId),
    enabled: !!firmId,
  });

  const portfolios = data?.portfolios || [];
  const products = data?.products || [];
  const roleMap = data?.roleMap || {};

  const {
    totalFunding,
    fundedProductCount,
    totalMarketValue,
    marketValueDate,
    fundedClientCount,
    fundingByPortfolio,
    marketValueByProduct,
    fundedClientItems,
    fundedProductItems,
  } = useMemo(() => {
    // ── 1. Total Funding Amount: net funding across all associated portfolios ──
    let funding = 0;
    const fundingByPort = [];
    const clientItems = [];
    for (const p of portfolios) {
      if (p.deleted_at) continue;
      if ((p.funding_status || "Active") !== "Active") continue;
      const role = roleMap[p.id] || {};
      const matchedIds = role.matchedProductIds || [];
      const net = computePortfolioNetFunding(p, matchedIds, role);
      funding += net;
      fundingByPort.push({
        id: p.id,
        name: p.portfolio_name,
        subtext: [p.allocator_name, p.advisor_firm_name].filter(Boolean).join(" · "),
        amount: net,
        portfolio: p,
      });
      clientItems.push({
        id: p.id,
        name: p.portfolio_name,
        subtext: [p.allocator_name, p.advisor_firm_name].filter(Boolean).join(" · "),
        amount: net,
        portfolio: p,
      });
    }

    // ── 2. Funded Products: count of products with funding_status = "Funded" ──
    const fundedProds = products.filter((p) => p.funding_status === "Funded");
    const fundedCount = fundedProds.length;
    const fundedProdItems = fundedProds.map((p) => ({
      id: p.id,
      name: p.name,
      subtext: p.firm_name || firmName,
      amount: null,
    }));

    // ── 3. Total Market Value: sum of latest product AUM across all products ──
    let marketValue = 0;
    let mvDate = null;
    const mvProducts = [];
    for (const p of products) {
      const history = (p.aum_history || []).filter((h) => h.month_end_date);
      if (history.length === 0) continue;
      history.sort((a, b) => new Date(b.month_end_date) - new Date(a.month_end_date));
      const latestEntry = history[0];
      const aum = Number(latestEntry.firm_aum) || 0;
      marketValue += aum;
      mvProducts.push({
        id: p.id,
        name: p.name,
        subtext: p.firm_name || firmName,
        amount: aum,
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
      fundedClientCount: clientItems.length,
      fundingByPortfolio: fundingByPort,
      marketValueByProduct: mvProducts,
      fundedClientItems: clientItems,
      fundedProductItems: fundedProdItems,
    };
  }, [portfolios, products, roleMap, firmName]);

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

  const openBreakdown = (type) => {
    if (type === "funding") {
      setBreakdown({
        type,
        title: "Total Funding Amount Breakdown",
        subtitle: "by Client Portfolio — click a row to open the source portfolio",
        items: fundingByPortfolio,
        showAmount: true,
      });
    } else if (type === "marketValue") {
      setBreakdown({
        type,
        title: "Total Market Value Breakdown",
        subtitle: "by Product (latest month-end AUM)",
        items: marketValueByProduct,
        showAmount: true,
      });
    } else if (type === "clients") {
      setBreakdown({
        type,
        title: "Funded Clients Breakdown",
        subtitle: "Active client portfolios — click a row to open the source portfolio",
        items: fundedClientItems,
        showAmount: true,
      });
    } else if (type === "products") {
      setBreakdown({
        type,
        title: "Funded Products Breakdown",
        subtitle: "Products with funding_status = Funded",
        items: fundedProductItems,
        showAmount: false,
      });
    }
  };

  const hasFundingData = fundingByPortfolio.length > 0;
  const hasMvData = marketValueByProduct.length > 0;
  const hasClientData = fundedClientItems.length > 0;
  const hasProductData = fundedProductItems.length > 0;

  return (
    <>
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-violet-50/50 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>

          {/* 1. Total Funding Amount (clickable) */}
          <button
            type="button"
            onClick={() => hasFundingData && openBreakdown("funding")}
            disabled={!hasFundingData}
            className={`text-left min-w-0 ${hasFundingData ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
            title={hasFundingData ? "Click to see breakdown by client portfolio" : ""}
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Funding Amount</p>
            <p className="text-2xl font-bold text-gray-900 leading-tight">
              {formatCurrency(totalFunding)}
            </p>
          </button>

          <div className="flex items-center gap-5 flex-wrap ml-auto">
            {/* 2. Total Market Value (clickable) */}
            <button
              type="button"
              onClick={() => hasMvData && openBreakdown("marketValue")}
              disabled={!hasMvData}
              className={`text-center ${hasMvData ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
              title={hasMvData ? "Click to see breakdown by product" : ""}
            >
              <div className="flex items-center gap-1 justify-center text-xs text-gray-500 mb-0.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Total Market Value</span>
              </div>
              <p className="text-lg font-bold text-indigo-700 leading-tight">{formatCurrency(totalMarketValue)}</p>
              {marketValueDate && (
                <p className="text-[11px] text-gray-500">as of {formatDate(marketValueDate)}</p>
              )}
            </button>

            {/* 3. Funded Clients (clickable) */}
            <button
              type="button"
              onClick={() => hasClientData && openBreakdown("clients")}
              disabled={!hasClientData}
              className={`text-center ${hasClientData ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
              title={hasClientData ? "Click to see breakdown by client portfolio" : ""}
            >
              <div className="flex items-center gap-1 justify-center text-xs text-gray-500 mb-0.5">
                <Users className="w-3.5 h-3.5" />
                <span>Funded Clients</span>
              </div>
              <p className="text-lg font-bold text-indigo-700">{fundedClientCount}</p>
            </button>

            {/* 4. Funded Products (clickable) */}
            <button
              type="button"
              onClick={() => hasProductData && openBreakdown("products")}
              disabled={!hasProductData}
              className={`text-center ${hasProductData ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
              title={hasProductData ? "Click to see breakdown by product" : ""}
            >
              <div className="flex items-center gap-1 justify-center text-xs text-gray-500 mb-0.5">
                <Package className="w-3.5 h-3.5" />
                <span>Funded Products</span>
              </div>
              <p className="text-lg font-bold text-indigo-700">{fundedProductCount}</p>
            </button>

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
      </div>

      {breakdown && (
        <FundingBreakdownDialog
          open={!!breakdown}
          onOpenChange={(v) => !v && setBreakdown(null)}
          title={breakdown.title}
          subtitle={breakdown.subtitle}
          items={breakdown.items}
          showAmount={breakdown.showAmount}
          onPortfolioClick={(portfolio) => {
            setBreakdown(null);
            if (onPortfolioClick) onPortfolioClick(portfolio);
          }}
        />
      )}
    </>
  );
}

function formatCurrency(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Generates and downloads a CSV report of all assets and net flows for a firm.
 */
async function downloadFirmReport(firm, products, portfolios, firmName) {
  const rows = [];
  rows.push(["Firm Assets & Net Flows Report"]);
  rows.push(["Firm", firmName || firm?.name || ""]);
  rows.push(["Generated", new Date().toLocaleString("en-US")]);
  rows.push([]);

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