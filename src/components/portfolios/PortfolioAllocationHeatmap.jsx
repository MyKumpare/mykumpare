import React, { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { LayoutGrid } from "lucide-react";

function formatCurrencyShort(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// Indigo gradient: lightness from 95% (low) to 35% (high)
function getCellColor(intensity) {
  if (intensity <= 0) return "transparent";
  const lightness = 95 - intensity * 60;
  return `hsl(243, 75%, ${lightness}%)`;
}

function getTextColor(intensity) {
  return intensity > 0.55 ? "#ffffff" : "#1f2937";
}

export default function PortfolioAllocationHeatmap({ portfolio }) {
  const historicalAum = portfolio.historical_aum || [];

  // Build manager definitions (advisor + sub-managers with data)
  const managers = useMemo(() => {
    const mgrs = [];
    if (portfolio.advisor_type && portfolio.advisor_firm_id) {
      const hasData = historicalAum.some(
        (a) => a.level === "advisor" && (a.reference_id || "") === portfolio.advisor_firm_id
      );
      if (hasData) {
        mgrs.push({
          key: "advisor",
          label: `${portfolio.advisor_type === "Manager of Managers" ? "MoM" : "IM"}: ${portfolio.advisor_firm_name || ""}`,
          level: "advisor",
          refId: portfolio.advisor_firm_id,
        });
      }
    }
    (portfolio.sub_managers || []).forEach((sm) => {
      const hasData = historicalAum.some(
        (a) => a.level === "sub_manager" && (a.reference_id || "") === sm.product_id
      );
      if (hasData) {
        mgrs.push({
          key: `sm_${sm.product_id}`,
          label: `SM: ${sm.product_name}`,
          level: "sub_manager",
          refId: sm.product_id,
        });
      }
    });
    return mgrs;
  }, [historicalAum, portfolio]);

  // Sorted unique dates (reporting periods)
  const sortedDates = useMemo(() => {
    const dateSet = new Set();
    historicalAum.forEach((a) => { if (a.date) dateSet.add(a.date); });
    return Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));
  }, [historicalAum]);

  // Build heatmap matrix: per-date portfolio total + each manager's value & % share
  const heatmapData = useMemo(() => {
    if (managers.length === 0 || sortedDates.length === 0) return [];

    return sortedDates.map((date) => {
      const portfolioTotal = historicalAum.find(
        (a) => a.date === date && a.level === "portfolio"
      )?.value || 0;

      const managerValues = {};
      managers.forEach((mgr) => {
        const entry = historicalAum.find(
          (a) =>
            a.date === date &&
            a.level === mgr.level &&
            (a.reference_id || "") === (mgr.refId || "")
        );
        const value = entry?.value ?? null;
        const pct = portfolioTotal > 0 && value != null ? (value / portfolioTotal) * 100 : 0;
        managerValues[mgr.key] = { value, pct };
      });

      return { date, portfolioTotal, managerValues };
    });
  }, [historicalAum, managers, sortedDates]);

  // Max percentage for color scaling across all cells
  const maxPct = useMemo(() => {
    let max = 0;
    heatmapData.forEach((row) => {
      managers.forEach((mgr) => {
        const pct = row.managerValues[mgr.key]?.pct || 0;
        if (pct > max) max = pct;
      });
    });
    return max || 100;
  }, [heatmapData, managers]);

  if (managers.length === 0 || sortedDates.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <LayoutGrid className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Allocation Shift Heatmap</h3>
        <span className="text-xs text-gray-400 ml-auto">Manager share of portfolio total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse" style={{ minWidth: managers.length > 0 ? 200 + sortedDates.length * 64 : "100%" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white text-left px-3 py-2 font-medium text-gray-600 text-xs whitespace-nowrap border-b border-gray-200">
                Manager
              </th>
              {heatmapData.map((row) => (
                <th
                  key={row.date}
                  className="px-2 py-2 font-medium text-gray-600 text-xs text-center whitespace-nowrap border-b border-gray-200"
                >
                  {format(parseISO(row.date), "MM/yy")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {managers.map((mgr) => (
              <tr key={mgr.key}>
                <td className="sticky left-0 z-10 bg-white text-left px-3 py-2 text-xs text-gray-700 whitespace-nowrap font-medium border-b border-gray-100">
                  {mgr.label}
                </td>
                {heatmapData.map((row) => {
                  const cell = row.managerValues[mgr.key];
                  const intensity = cell?.pct != null ? cell.pct / maxPct : 0;
                  const bgColor = getCellColor(intensity);
                  const textColor = getTextColor(intensity);
                  return (
                    <td
                      key={row.date}
                      className="px-2 py-2 text-center text-xs whitespace-nowrap border-b border-gray-100 transition-colors"
                      style={{ backgroundColor: bgColor, color: textColor, minWidth: 56 }}
                      title={`${mgr.label} — ${format(parseISO(row.date), "MM/dd/yyyy")}\n${formatCurrencyShort(cell?.value)} (${(cell?.pct || 0).toFixed(1)}% of portfolio)`}
                    >
                      {cell?.value != null ? `${(cell?.pct || 0).toFixed(0)}%` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Legend gradient */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-gray-400">Low share</span>
        <div
          className="flex-1 h-3 rounded"
          style={{ background: "linear-gradient(to right, hsl(243, 75%, 95%), hsl(243, 75%, 35%))" }}
        />
        <span className="text-xs text-gray-400">High share</span>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Each cell shows the manager&apos;s share of the portfolio total for that period. Darker cells indicate a larger allocation share. Hover for exact values.
      </p>
    </div>
  );
}