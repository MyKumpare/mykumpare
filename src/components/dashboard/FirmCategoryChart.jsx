import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { Building, TrendingUp, MousePointerClick } from "lucide-react";
import { getFirmTypes } from "@/components/firms/firmTypeUtils";

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

const CATEGORY_LABELS = {
  "Investment Manager": "IM",
  "Allocator": "Allocator",
  "Investment Consultant": "Consultant",
  "Securities Brokerage": "Brokerage",
  "Trade Organizations": "Trade Org",
};

function formatMonth(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FirmCategoryChart({ firms, onClickCategory }) {
  const [activeCategory, setActiveCategory] = useState(null);
  const activeFirms = useMemo(() => (firms || []).filter((f) => !f.deleted_at), [firms]);

  // ── Category breakdown (bar + pie) ──
  const categoryData = useMemo(() => {
    const counts = {};
    for (const f of activeFirms) {
      const types = getFirmTypes(f);
      // A firm has a single type; if none assigned, bucket as "Uncategorized"
      const type = types.length > 0 ? types[0] : "Uncategorized";
      counts[type] = (counts[type] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, shortLabel: CATEGORY_LABELS[name] || name }))
      .sort((a, b) => b.value - a.value);
  }, [activeFirms]);

  // ── Cumulative growth over time (area chart by month) ──
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

  const totalFirms = activeFirms.length;

  if (totalFirms === 0) {
    return (
      <div className="mb-6 bg-card border border-border rounded-xl p-6 text-center">
        <Building className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No firms yet — add firms to see your database growth chart.</p>
      </div>
    );
  }

  return (
    <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Category breakdown — bar chart */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Building className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Firms by Category</h3>
          {onClickCategory && (
            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
              <MousePointerClick className="w-3 h-3" />
              Click a bar to filter
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{totalFirms} total</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
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
              formatter={(value, _name, props) => [value, props?.payload?.name || "Firms"]}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              onClick={(data) => {
                const name = data?.payload?.name;
                if (!name || !onClickCategory) return;
                // "Uncategorized" firms have no type to filter by — skip
                if (name === "Uncategorized") return;
                setActiveCategory(name);
                onClickCategory(name);
              }}
            >
              {categoryData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  opacity={activeCategory && activeCategory !== entry.name ? 0.35 : 1}
                  style={{ cursor: entry.name === "Uncategorized" ? "default" : onClickCategory ? "pointer" : "default" }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Legend pills below the chart — clickable to filter */}
        <div className="flex flex-wrap gap-2 mt-2">
          {categoryData.map((cat, idx) => {
            const clickable = onClickCategory && cat.name !== "Uncategorized";
            return (
              <button
                key={cat.name}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (!clickable) return;
                  setActiveCategory(cat.name);
                  onClickCategory(cat.name);
                }}
                className={`flex items-center gap-1.5 text-xs text-muted-foreground rounded-md px-1.5 py-0.5 transition-colors ${
                  clickable ? "hover:bg-accent cursor-pointer" : "cursor-default"
                } ${activeCategory === cat.name ? "bg-indigo-50 text-indigo-700" : ""}`}
              >
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                <span>{cat.name}</span>
                <span className="font-medium text-foreground">{cat.value}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Database growth over time — area chart */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Database Growth</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            {growthData.length > 0 ? `Since ${growthData[0].month}` : ""}
          </span>
        </div>
        {growthData.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={growthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#growthGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
            Not enough data to show growth trend yet.
          </div>
        )}
      </div>
    </div>
  );
}