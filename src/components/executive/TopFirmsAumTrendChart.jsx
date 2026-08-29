import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";

const FIRM_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#06b6d4", "#ef4444", "#3b82f6",
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

function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/**
 * Displays historical AUM growth trends for the top investment firms (by latest AUM).
 * Each firm becomes a line in the chart, letting executives spot performance patterns
 * at a glance. Includes a toggle to control how many top firms to show.
 */
export default function TopFirmsAumTrendChart({ firms = [] }) {
  const [topN, setTopN] = useState(5);

  // Rank firms by latest AUM and pick the top N that actually have AUM history
  const { topFirms, chartData, allDates } = useMemo(() => {
    const withHistory = firms
      .filter((f) => !f.deleted_at && (f.aum_history || []).length > 0)
      .map((f) => {
        const history = [...(f.aum_history || [])].sort(
          (a, b) => (a.month_end_date || "").localeCompare(b.month_end_date || "")
        );
        const latest = history[history.length - 1];
        return {
          id: f.id,
          name: f.name,
          history,
          latestAum: Number(latest?.firm_aum) || 0,
        };
      })
      .sort((a, b) => b.latestAum - a.latestAum);

    const selected = withHistory.slice(0, topN);

    // Collect all unique month-end dates across selected firms, sorted
    const dateSet = new Set();
    for (const firm of selected) {
      for (const h of firm.history) {
        if (h.month_end_date) dateSet.add(h.month_end_date);
      }
    }
    const dates = Array.from(dateSet).sort();

    // Build chart data: one entry per date, with each firm's AUM at that date
    const data = dates.map((date) => {
      const point = { date, dateLabel: formatDateLabel(date) };
      for (const firm of selected) {
        const entry = firm.history.find((h) => h.month_end_date === date);
        if (entry && entry.firm_aum != null) {
          point[firm.id] = Number(entry.firm_aum) || 0;
        }
      }
      return point;
    });

    return { topFirms: selected, chartData: data, allDates: dates };
  }, [firms, topN]);

  const hasData = topFirms.length > 0 && chartData.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Top Firms AUM Growth Trends</h2>
            <p className="text-xs text-gray-400">
              Historical AUM trajectory for the highest-exposure firms
            </p>
          </div>
        </div>
        {hasData && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {[3, 5, 8].map((n) => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  topN === n ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3">
        {!hasData ? (
          <div className="h-72 flex items-center justify-center text-gray-400 text-sm">
            No AUM history data available for top firms.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactCurrency(v)}
                width={70}
              />
              <Tooltip
                formatter={(v) => formatCompactCurrency(v)}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
                iconType="line"
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              />
              {topFirms.map((firm, idx) => (
                <Line
                  key={firm.id}
                  type="monotone"
                  dataKey={firm.id}
                  name={firm.name}
                  stroke={FIRM_COLORS[idx % FIRM_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {hasData && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          {topFirms.map((firm, idx) => (
            <span key={firm.id} className="inline-flex items-center gap-1.5">
              <span
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: FIRM_COLORS[idx % FIRM_COLORS.length] }}
              />
              <span className="font-medium text-gray-700">{firm.name}</span>
              <span className="text-gray-400">· {formatCompactCurrency(firm.latestAum)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}