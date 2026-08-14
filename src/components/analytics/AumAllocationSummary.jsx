import React, { useMemo, useState } from "react";
import {
  DollarSign,
  Scale,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const fmt = (n) => {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtFull = (n) => {
  if (n == null || isNaN(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
};

export default function AumAllocationSummary({ firms, loading }) {
  const [expandedFirm, setExpandedFirm] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Build per-firm reconciliation rows from the latest AUM history entry of each firm
  const rows = useMemo(() => {
    const out = [];
    for (const firm of firms) {
      const history = firm.aum_history || [];
      if (!history.length) continue;
      // latest entry by month_end_date
      const latest = [...history].sort(
        (a, b) => new Date(b.month_end_date) - new Date(a.month_end_date)
      )[0];
      if (!latest) continue;

      const firmAum = Number(latest.firm_aum) || 0;
      const breakdown = latest.client_type_breakdown || [];
      const allocated = breakdown.reduce(
        (sum, ct) => sum + (Number(ct.aum_amount) || 0),
        0
      );
      const diff = allocated - firmAum;
      const match = Math.abs(diff) < 1; // within $1 tolerance

      // per client-type detail
      const clientRows = breakdown.map((ct) => ({
        client_type: ct.client_type || "(unnamed)",
        aum_amount: Number(ct.aum_amount) || 0,
        gained: Number(ct.assets_gained) || 0,
        loss: Number(ct.assets_loss) || 0,
      }));

      out.push({
        firmId: firm.id,
        firmName: firm.name,
        date: latest.month_end_date,
        firmAum,
        allocated,
        diff,
        match,
        clientRows,
      });
    }
    return out.sort((a, b) => b.firmAum - a.firmAum);
  }, [firms]);

  const totals = useMemo(() => {
    const totalFirmAum = rows.reduce((s, r) => s + r.firmAum, 0);
    const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
    const totalDiff = totalAllocated - totalFirmAum;
    const mismatches = rows.filter((r) => !r.match);
    return {
      totalFirmAum,
      totalAllocated,
      totalDiff,
      mismatchCount: mismatches.length,
      firmCount: rows.length,
    };
  }, [rows]);

  const mismatchRows = rows.filter((r) => !r.match);
  const visibleRows = showAll ? rows : mismatchRows.slice(0, 10);
  const allMatch = totals.mismatchCount === 0;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-800">AUM Allocation Reconciliation</h2>
        </div>
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-800">AUM Allocation Reconciliation</h2>
        </div>
        <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
          No AUM history data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-800">
            AUM Allocation Reconciliation
          </h2>
          <span className="text-xs text-gray-400">({totals.firmCount} firms with AUM)</span>
        </div>
        {allMatch ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            All allocations match
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            {totals.mismatchCount} firm{totals.mismatchCount !== 1 ? "s" : ""} mismatched
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs text-gray-500">Total Firm AUM</span>
          </div>
          <p className="text-lg font-bold text-gray-900" title={fmtFull(totals.totalFirmAum)}>
            {fmt(totals.totalFirmAum)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Scale className="w-3.5 h-3.5 text-violet-500" />
            <span className="text-xs text-gray-500">Total Allocated</span>
          </div>
          <p className="text-lg font-bold text-gray-900" title={fmtFull(totals.totalAllocated)}>
            {fmt(totals.totalAllocated)}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            Math.abs(totals.totalDiff) < 1
              ? "border-gray-200"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-gray-500">Net Difference</span>
          </div>
          <p
            className={`text-lg font-bold ${
              Math.abs(totals.totalDiff) < 1 ? "text-gray-900" : "text-amber-700"
            }`}
            title={fmtFull(totals.totalDiff)}
          >
            {fmt(totals.totalDiff)}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 ${
            allMatch ? "border-gray-200" : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {allMatch ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span className="text-xs text-gray-500">Mismatches</span>
          </div>
          <p
            className={`text-lg font-bold ${
              allMatch ? "text-emerald-600" : "text-amber-700"
            }`}
          >
            {totals.mismatchCount}
          </p>
        </div>
      </div>

      {/* Reconciliation table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500">
              <th className="text-left font-medium py-2 px-2">Firm</th>
              <th className="text-center font-medium py-2 px-2">Month-End</th>
              <th className="text-right font-medium py-2 px-2">Firm AUM</th>
              <th className="text-right font-medium py-2 px-2">Allocated</th>
              <th className="text-right font-medium py-2 px-2">Difference</th>
              <th className="text-center font-medium py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const isOpen = expandedFirm === r.firmId;
              return (
                <React.Fragment key={r.firmId}>
                  <tr
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                      !r.match ? "bg-amber-50/40" : ""
                    }`}
                    onClick={() => setExpandedFirm(isOpen ? null : r.firmId)}
                  >
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        {r.clientRows.length > 0 ? (
                          isOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          )
                        ) : null}
                        <span
                          className="font-medium text-gray-800 truncate max-w-[200px]"
                          title={r.firmName}
                        >
                          {r.firmName}
                        </span>
                      </div>
                    </td>
                    <td className="text-center py-2 px-2 text-gray-600 whitespace-nowrap">
                      {r.date
                        ? new Date(r.date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="text-right py-2 px-2 font-medium text-gray-900 whitespace-nowrap" title={fmtFull(r.firmAum)}>
                      {fmt(r.firmAum)}
                    </td>
                    <td className="text-right py-2 px-2 font-medium text-gray-900 whitespace-nowrap" title={fmtFull(r.allocated)}>
                      {fmt(r.allocated)}
                    </td>
                    <td
                      className={`text-right py-2 px-2 font-medium whitespace-nowrap ${
                        r.match ? "text-gray-400" : "text-amber-600"
                      }`}
                      title={fmtFull(r.diff)}
                    >
                      {r.match ? "—" : fmt(r.diff)}
                    </td>
                    <td className="text-center py-2 px-2">
                      {r.match ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Match
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Mismatch
                        </span>
                      )}
                    </td>
                  </tr>
                  {isOpen && r.clientRows.length > 0 && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={6} className="py-2 px-2">
                        <div className="ml-6 rounded-lg border border-gray-200 bg-white overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200 text-gray-500">
                                <th className="text-left font-medium py-1.5 px-3">Client Type</th>
                                <th className="text-right font-medium py-1.5 px-3">AUM Allocated</th>
                                <th className="text-right font-medium py-1.5 px-3 text-emerald-600">Gained</th>
                                <th className="text-right font-medium py-1.5 px-3 text-red-500">Loss</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.clientRows.map((c, i) => (
                                <tr key={i} className="border-b border-gray-100 last:border-0">
                                  <td className="py-1.5 px-3 text-gray-700">{c.client_type}</td>
                                  <td className="text-right py-1.5 px-3 font-medium text-gray-900" title={fmtFull(c.aum_amount)}>
                                    {fmt(c.aum_amount)}
                                  </td>
                                  <td className="text-right py-1.5 px-3 text-emerald-600" title={fmtFull(c.gained)}>
                                    {fmt(c.gained)}
                                  </td>
                                  <td className="text-right py-1.5 px-3 text-red-500" title={fmtFull(c.loss)}>
                                    {fmt(c.loss)}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-medium">
                                <td className="py-1.5 px-3 text-gray-700">Total</td>
                                <td className="text-right py-1.5 px-3 text-gray-900" title={fmtFull(r.allocated)}>
                                  {fmt(r.allocated)}
                                </td>
                                <td className="text-right py-1.5 px-3 text-emerald-600" title={fmtFull(r.clientRows.reduce((s,c)=>s+c.gained,0))}>
                                  {fmt(r.clientRows.reduce((s, c) => s + c.gained, 0))}
                                </td>
                                <td className="text-right py-1.5 px-3 text-red-500" title={fmtFull(r.clientRows.reduce((s,c)=>s+c.loss,0))}>
                                  {fmt(r.clientRows.reduce((s, c) => s + c.loss, 0))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > visibleRows.length && !showAll && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Show all {rows.length} firms
          </button>
        </div>
      )}
      {showAll && rows.length > 10 && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowAll(false)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Show mismatches only
          </button>
        </div>
      )}
    </div>
  );
}