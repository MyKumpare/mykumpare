import React, { useMemo } from "react";
import { Grid3x3 } from "lucide-react";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const REGIONS = [
  "North America", "Europe", "Asia-Pacific",
  "Latin America", "Middle East & Africa", "Global", "Undefined",
];

function formatCompactCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function getLatestAum(record) {
  const history = record.aum_history || [];
  if (!history.length) return 0;
  const latest = [...history].sort(
    (a, b) => (b.month_end_date || "").localeCompare(a.month_end_date || "")
  )[0];
  return Number(latest?.firm_aum) || 0;
}

function getFirmTypes(f) {
  return f.firm_types?.length ? f.firm_types : f.firm_type ? [f.firm_type] : [];
}

// Green (under) → yellow (average) → orange → red (over-allocated)
function getHeatColor(ratio) {
  if (ratio <= 0) return "#f9fafb";
  if (ratio < 0.2) return "#bbf7d0";
  if (ratio < 0.4) return "#86efac";
  if (ratio < 0.6) return "#fde047";
  if (ratio < 0.8) return "#fb923c";
  return "#ef4444";
}

export default function ExposureHeatmap({ firms }) {
  const { matrix, rowTotals, colTotals, maxCell, avgCell, totalExposure } = useMemo(() => {
    const matrix = {};
    const rowTotals = {};
    const colTotals = {};
    let maxCell = 0;
    let totalExposure = 0;
    let cellCount = 0;

    for (const f of firms) {
      const aum = getLatestAum(f);
      if (!aum) continue;
      const types = getFirmTypes(f);
      const typeList = types.length ? types : ["Uncategorized"];
      const region = f.geographic_region || "Undefined";
      for (const t of typeList) {
        if (!matrix[t]) matrix[t] = {};
        matrix[t][region] = (matrix[t][region] || 0) + aum;
        rowTotals[t] = (rowTotals[t] || 0) + aum;
        colTotals[region] = (colTotals[region] || 0) + aum;
        totalExposure += aum;
        cellCount++;
      }
    }

    for (const t of Object.keys(matrix)) {
      for (const r of Object.keys(matrix[t])) {
        if (matrix[t][r] > maxCell) maxCell = matrix[t][r];
      }
    }
    const avgCell = cellCount > 0 ? totalExposure / cellCount : 0;

    return { matrix, rowTotals, colTotals, maxCell, avgCell, totalExposure };
  }, [firms]);

  const allTypes = [...FIRM_TYPES, "Uncategorized"].filter(
    (t) => rowTotals[t] || Object.keys(matrix[t] || {}).length > 0
  );
  const allRegions = [...REGIONS].filter(
    (r) => colTotals[r] || Object.values(matrix).some((m) => m[r])
  );

  if (allTypes.length === 0 || allRegions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <Grid3x3 className="w-5 h-5 text-rose-600" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Exposure Heatmap</h2>
            <p className="text-xs text-gray-400">Firm type × region concentration</p>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          No exposure data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-5 h-5 text-rose-600" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Exposure Heatmap</h2>
            <p className="text-xs text-gray-400">
              Total exposure by firm type × region — warmer colors highlight over-allocated areas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <span>Low</span>
          <div className="flex rounded overflow-hidden border border-gray-200">
            <div className="w-5 h-3" style={{ backgroundColor: "#f9fafb" }} />
            <div className="w-5 h-3" style={{ backgroundColor: "#bbf7d0" }} />
            <div className="w-5 h-3" style={{ backgroundColor: "#86efac" }} />
            <div className="w-5 h-3" style={{ backgroundColor: "#fde047" }} />
            <div className="w-5 h-3" style={{ backgroundColor: "#fb923c" }} />
            <div className="w-5 h-3" style={{ backgroundColor: "#ef4444" }} />
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-gray-500 py-2 pr-3 sticky left-0 bg-white">
                Firm Type
              </th>
              {allRegions.map((region) => (
                <th key={region} className="text-center font-medium text-gray-500 py-2 px-1 whitespace-nowrap">
                  {region}
                </th>
              ))}
              <th className="text-right font-medium text-gray-700 py-2 pl-3 pr-1 bg-gray-50/50">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {allTypes.map((type) => {
              const rowTotal = rowTotals[type] || 0;
              return (
                <tr key={type}>
                  <td className="text-left font-medium text-gray-700 py-1 pr-3 whitespace-nowrap sticky left-0 bg-white">
                    {type}
                  </td>
                  {allRegions.map((region) => {
                    const value = matrix[type]?.[region] || 0;
                    const ratio = maxCell > 0 ? value / maxCell : 0;
                    const isOverAllocated = value > 0 && value > avgCell * 1.5;
                    return (
                      <td key={region} className="py-1 px-1 text-center">
                        <div
                          className="rounded-md py-2 px-1.5 transition-colors"
                          style={{
                            backgroundColor: value > 0 ? getHeatColor(ratio) : "#f9fafb",
                            color: ratio >= 0.8 ? "#ffffff" : "#374151",
                            fontWeight: isOverAllocated ? 600 : 400,
                          }}
                          title={`${type} × ${region}: ${formatCompactCurrency(value)}`}
                        >
                          {value > 0 ? formatCompactCurrency(value) : "—"}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-right font-semibold text-gray-900 py-1 pl-3 pr-1 whitespace-nowrap bg-gray-50/50">
                    {formatCompactCurrency(rowTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td className="text-left font-semibold text-gray-700 py-2 pr-3 sticky left-0 bg-white">
                Total
              </td>
              {allRegions.map((region) => (
                <td key={region} className="text-center font-semibold text-gray-700 py-2 px-1 whitespace-nowrap">
                  {formatCompactCurrency(colTotals[region] || 0)}
                </td>
              ))}
              <td className="text-right font-bold text-gray-900 py-2 pl-3 pr-1 whitespace-nowrap bg-gray-50/50">
                {formatCompactCurrency(totalExposure)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {avgCell > 0 && (
        <p className="text-[11px] text-gray-400 mt-3">
          Average exposure per cell: {formatCompactCurrency(avgCell)}. Cells above 1.5× the average are highlighted in warm tones (orange/red) to flag over-allocated concentrations.
        </p>
      )}
    </div>
  );
}