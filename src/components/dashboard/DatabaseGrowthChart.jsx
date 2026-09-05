import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";

function formatMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Standalone "Database Growth" area chart. Extracted from FirmCategoryChart
 * so it can be rendered individually inside a report dialog.
 */
export default function DatabaseGrowthChart({ firms }) {
  const activeFirms = useMemo(() => (firms || []).filter((f) => !f.deleted_at), [firms]);

  const growthData = useMemo(() => {
    if (activeFirms.length === 0) return [];
    const byMonth = {};
    for (const f of activeFirms) {
      const month = formatMonth(f.created_date);
      if (!month) continue;
      if (!byMonth[month]) byMonth[month] = 0;
      byMonth[month]++;
    }
    const months = Object.keys(byMonth).sort();
    let cumulative = 0;
    return months.map((m) => {
      cumulative += byMonth[m];
      return { month: m, cumulative, added: byMonth[m] };
    });
  }, [activeFirms]);

  if (growthData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TrendingUp className="w-10 h-10 text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">No firms yet — add firms to see your database growth chart.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-700">Database Growth</h3>
        <span className="ml-auto text-xs text-gray-400">
          {growthData.length > 0 ? `Since ${growthData[0].month}` : ""}
        </span>
      </div>
      {growthData.length > 1 ? (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={growthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="growthGradientStandalone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value, name) => [
                value,
                name === "cumulative" ? "Total Firms" : "New That Month",
              ]}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#growthGradientStandalone)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
          Not enough data to show growth trend yet.
        </div>
      )}
    </div>
  );
}