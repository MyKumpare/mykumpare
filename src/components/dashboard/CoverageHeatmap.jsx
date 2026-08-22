import React, { useMemo } from "react";

// Visual heatmap matrix of team coverage: rows = firms, columns = roles
// (Primary / Secondary). Each cell is color-coded by the number of analysts
// assigned to that role for that firm — red = 0 (gap), amber = 1 (thin),
// green = 2+ (covered) — so under-resourced firms and missing role assignments
// stand out immediately. Firms are received already sorted (gaps first).
const cellStyle = (count) => {
  if (count === 0)
    return "bg-red-100 text-red-700 border-red-200";
  if (count === 1)
    return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
};

export default function CoverageHeatmap({ firms = [] }) {
  const rows = useMemo(
    () =>
      firms.map((f) => ({
        firm_id: f.firm_id,
        firm_name: f.firm_name,
        primary: f.primaryNames.length,
        secondary: f.secondaryNames.length,
        total: f.totalAnalysts,
        status: f.status,
      })),
    [firms]
  );

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200">
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
          Coverage Heatmap
        </span>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-red-200 border border-red-300" /> 0
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-300" /> 1
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-200 border border-emerald-300" /> 2+
          </span>
        </div>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-gray-200">
              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Firm</th>
              <th className="text-center py-1.5 px-2 font-semibold text-indigo-600 w-20">Primary</th>
              <th className="text-center py-1.5 px-2 font-semibold text-violet-600 w-20">Secondary</th>
              <th className="text-center py-1.5 px-2 font-semibold text-gray-600 w-14">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.firm_id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td
                  className="py-1.5 px-2 text-gray-700 truncate max-w-[240px]"
                  title={r.firm_name}
                >
                  {r.status !== "covered" && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 align-middle" />
                  )}
                  {r.firm_name}
                </td>
                <td className="py-1 px-2">
                  <div
                    className={`mx-auto w-7 h-7 rounded flex items-center justify-center text-[11px] font-semibold border ${cellStyle(r.primary)}`}
                  >
                    {r.primary}
                  </div>
                </td>
                <td className="py-1 px-2">
                  <div
                    className={`mx-auto w-7 h-7 rounded flex items-center justify-center text-[11px] font-semibold border ${cellStyle(r.secondary)}`}
                  >
                    {r.secondary}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-center font-semibold text-gray-700">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}