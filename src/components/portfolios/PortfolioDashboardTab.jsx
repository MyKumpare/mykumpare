import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { TrendingUp, Activity } from "lucide-react";

const SERIES_COLORS = [
  "#4f46e5", // indigo-600 (portfolio)
  "#0891b2", // cyan-600 (advisor)
  "#16a34a", // green-600
  "#ea580c", // orange-600
  "#db2777", // pink-600
  "#7c3aed", // violet-600
  "#ca8a04", // yellow-600
  "#0f766e", // teal-700
];

function formatCurrencyShort(v) {
  if (v == null) return "—";
  if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatCurrencyFull(v) {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function PortfolioDashboardTab({ portfolio }) {
  const historicalAum = portfolio.historical_aum || [];
  const [hiddenSeries, setHiddenSeries] = useState({});

  // Build series definitions: portfolio total + advisor + each sub-manager
  const seriesDefs = useMemo(() => {
    const defs = [];
    // Portfolio total
    const hasPortfolioData = historicalAum.some((a) => a.level === "portfolio");
    if (hasPortfolioData) {
      defs.push({ key: "portfolio", label: "Portfolio Total", level: "portfolio", refId: "" });
    }
    // Advisor
    if (portfolio.advisor_type && portfolio.advisor_firm_id) {
      const hasAdvisorData = historicalAum.some(
        (a) => a.level === "advisor" && (a.reference_id || "") === portfolio.advisor_firm_id
      );
      if (hasAdvisorData) {
        defs.push({
          key: "advisor",
          label: `${portfolio.advisor_type === "Manager of Managers" ? "MoM" : "IM"}: ${portfolio.advisor_firm_name || ""}`,
          level: "advisor",
          refId: portfolio.advisor_firm_id,
        });
      }
    }
    // Sub-managers
    (portfolio.sub_managers || []).forEach((sm) => {
      const hasData = historicalAum.some(
        (a) => a.level === "sub_manager" && (a.reference_id || "") === sm.product_id
      );
      if (hasData) {
        defs.push({
          key: `sm_${sm.product_id}`,
          label: `SM: ${sm.product_name}`,
          level: "sub_manager",
          refId: sm.product_id,
        });
      }
    });
    return defs;
  }, [historicalAum, portfolio]);

  // Merge all AUM data into a single dataset keyed by date
  const chartData = useMemo(() => {
    if (seriesDefs.length === 0) return [];
    // Collect all unique dates
    const dateSet = new Set();
    historicalAum.forEach((a) => {
      if (a.date) dateSet.add(a.date);
    });
    const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b));

    // For each date, build a row with values for each series
    return sortedDates.map((date) => {
      const row = { date };
      seriesDefs.forEach((def) => {
        const entry = historicalAum.find(
          (a) =>
            a.date === date &&
            a.level === def.level &&
            (a.reference_id || "") === (def.refId || "")
        );
        row[def.key] = entry ? entry.value : null;
      });
      return row;
    });
  }, [historicalAum, seriesDefs]);

  // Summary stats for the latest data point
  const latestRow = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const firstRow = chartData.length > 0 ? chartData[0] : null;

  const portfolioGrowth = useMemo(() => {
    if (!firstRow || !latestRow || firstRow.portfolio == null || latestRow.portfolio == null) return null;
    if (firstRow.portfolio === 0) return null;
    return ((latestRow.portfolio - firstRow.portfolio) / Math.abs(firstRow.portfolio)) * 100;
  }, [firstRow, latestRow]);

  const toggleSeries = (key) => {
    setHiddenSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (seriesDefs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <TrendingUp className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm text-gray-500 font-medium">No Historical AUM Data</p>
        <p className="text-xs text-gray-400 mt-1 max-w-xs">
          Add AUM data points in the Historical AUM tab to see the portfolio growth dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 font-medium">Latest Portfolio AUM</p>
          <p className="text-lg font-semibold text-gray-900 mt-0.5">
            {latestRow?.portfolio != null ? formatCurrencyFull(latestRow.portfolio) : "—"}
          </p>
          {latestRow?.date && (
            <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(latestRow.date), "MM/dd/yyyy")}</p>
          )}
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 font-medium">Initial Portfolio AUM</p>
          <p className="text-lg font-semibold text-gray-900 mt-0.5">
            {firstRow?.portfolio != null ? formatCurrencyFull(firstRow.portfolio) : "—"}
          </p>
          {firstRow?.date && (
            <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(firstRow.date), "MM/dd/yyyy")}</p>
          )}
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 font-medium">Growth</p>
          <p className={`text-lg font-semibold mt-0.5 ${portfolioGrowth != null ? (portfolioGrowth >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
            {portfolioGrowth != null ? `${portfolioGrowth >= 0 ? "+" : ""}${portfolioGrowth.toFixed(2)}%` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Since inception</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-gray-500 font-medium">Data Points</p>
          <p className="text-lg font-semibold text-gray-900 mt-0.5">{chartData.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">{seriesDefs.length} series tracked</p>
        </div>
      </div>

      {/* Line chart */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-800">AUM Growth Over Time</h3>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => (d ? format(parseISO(d), "MM/dd/yy") : "")}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                height={40}
              />
              <YAxis
                tickFormatter={(v) => formatCurrencyShort(v)}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                width={70}
              />
              <Tooltip
                labelFormatter={(d) => (d ? format(parseISO(d), "MM/dd/yyyy") : "")}
                formatter={(v) => [formatCurrencyFull(v), ""]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                onClick={(e) => toggleSeries(e.dataKey)}
              />
              {seriesDefs.map((def, i) => (
                <Line
                  key={def.key}
                  type="monotone"
                  dataKey={def.key}
                  name={def.label}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={def.key === "portfolio" ? 2.5 : 1.5}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                  hide={!!hiddenSeries[def.key]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Click a legend entry to toggle visibility. Portfolio Total shown in thicker line.
        </p>
      </div>

      {/* Series breakdown table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="px-3 py-2 border-b bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Series Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-600 text-xs">Series</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">Latest Value</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">First Value</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600 text-xs">Change</th>
            </tr>
          </thead>
          <tbody>
            {seriesDefs.map((def, i) => {
              const latest = latestRow?.[def.key];
              const first = firstRow?.[def.key];
              const change = latest != null && first != null ? latest - first : null;
              const pctChange = latest != null && first != null && first !== 0 ? ((latest - first) / Math.abs(first)) * 100 : null;
              return (
                <tr key={def.key} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                      <span className="text-gray-800">{def.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-800 font-medium whitespace-nowrap">
                    {latest != null ? formatCurrencyFull(latest) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                    {first != null ? formatCurrencyFull(first) : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${change != null ? (change >= 0 ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
                    {change != null ? (
                      <>
                        {formatCurrencyShort(change)}
                        {pctChange != null && <span className="text-xs ml-1">({pctChange >= 0 ? "+" : ""}{pctChange.toFixed(1)}%)</span>}
                      </>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}