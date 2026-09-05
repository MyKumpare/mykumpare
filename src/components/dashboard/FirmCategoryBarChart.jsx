import React, { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Building, MousePointerClick } from "lucide-react";
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

/**
 * Standalone "Firms by Category" bar chart. Extracted from FirmCategoryChart
 * so it can be rendered individually inside a report dialog.
 */
export default function FirmCategoryBarChart({ firms, onClickCategory }) {
  const [activeCategory, setActiveCategory] = useState(null);

  const activeFirms = useMemo(() => (firms || []).filter((f) => !f.deleted_at), [firms]);

  const categoryData = useMemo(() => {
    const counts = {};
    for (const f of activeFirms) {
      const types = getFirmTypes(f);
      const type = types.length > 0 ? types[0] : "Uncategorized";
      counts[type] = (counts[type] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, shortLabel: CATEGORY_LABELS[name] || name }))
      .sort((a, b) => b.value - a.value);
  }, [activeFirms]);

  const totalFirms = activeFirms.length;

  if (totalFirms === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building className="w-10 h-10 text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">No firms yet — add firms to see the category breakdown.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Building className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-700">Firms by Category</h3>
        {onClickCategory && (
          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
            <MousePointerClick className="w-3 h-3" />
            Click a bar to filter
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">{totalFirms} total</span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
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
              if (!name || !onClickCategory || name === "Uncategorized") return;
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
      <div className="flex flex-wrap gap-2 mt-3">
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
              className={`flex items-center gap-1.5 text-xs text-gray-500 rounded-md px-1.5 py-0.5 transition-colors ${
                clickable ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"
              } ${activeCategory === cat.name ? "bg-indigo-50 text-indigo-700" : ""}`}
            >
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
              <span>{cat.name}</span>
              <span className="font-medium text-gray-700">{cat.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}