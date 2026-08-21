import React, { useMemo } from "react";
import FundingStatusBadge from "@/components/products/FundingStatusBadge";
import { Package, TrendingUp, TrendingDown } from "lucide-react";

/**
 * Compact funding-health summary for the Product Dashboard. Shows one card per
 * firm that has products, with the firm's aggregated funding status and key
 * totals (product count, funded count, terminated count) so overall health is
 * visible at a glance.
 */
export default function ProductFundingSummary({ products, firms }) {
  const firmMetrics = useMemo(() => {
    const byFirm = {};
    for (const p of products) {
      const fid = p.firm_id;
      if (!fid) continue;
      if (!byFirm[fid]) byFirm[fid] = { firm_id: fid, total: 0, funded: 0, terminated: 0 };
      byFirm[fid].total++;
      if (p.funding_status === "Funded") byFirm[fid].funded++;
      else if (p.funding_status === "Terminated") byFirm[fid].terminated++;
    }
    const firmMap = Object.fromEntries(firms.map((f) => [f.id, f]));
    return Object.values(byFirm)
      .map((r) => {
        const status = r.funded > 0 ? "Funded" : r.terminated > 0 ? "Terminated" : "";
        return { ...r, status, firm: firmMap[r.firm_id] };
      })
      .filter((r) => r.firm)
      .sort((a, b) => a.firm.name.localeCompare(b.firm.name));
  }, [products, firms]);

  const totals = useMemo(() => {
    let totalProducts = 0, totalFunded = 0, totalTerminated = 0, firmsFunded = 0;
    for (const r of firmMetrics) {
      totalProducts += r.total;
      totalFunded += r.funded;
      totalTerminated += r.terminated;
      if (r.status === "Funded") firmsFunded++;
    }
    return { totalProducts, totalFunded, totalTerminated, firmsFunded, totalFirms: firmMetrics.length };
  }, [firmMetrics]);

  if (firmMetrics.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-700">Funding Metrics</span>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-gray-500">{totals.totalFirms} firms</span>
          <span className="text-gray-500">{totals.totalProducts} products</span>
          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> {totals.totalFunded} funded
          </span>
          {totals.totalTerminated > 0 && (
            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
              <TrendingDown className="w-3.5 h-3.5" /> {totals.totalTerminated} terminated
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {firmMetrics.map((r) => (
          <div key={r.firm_id} className="rounded-lg border border-gray-100 bg-gray-50/50 p-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              {r.firm.logo_url ? (
                <img src={r.firm.logo_url} alt="" className="w-4 h-4 object-contain rounded flex-shrink-0" />
              ) : null}
              <span className="text-xs font-semibold text-gray-800 truncate flex-1">{r.firm.name}</span>
              <FundingStatusBadge status={r.status} />
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <span>{r.total} product{r.total !== 1 ? "s" : ""}</span>
              <span className="text-emerald-700 font-medium">{r.funded} funded</span>
              {r.terminated > 0 && <span className="text-red-600 font-medium">{r.terminated} terminated</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}