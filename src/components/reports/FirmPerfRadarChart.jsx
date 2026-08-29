import React, { useMemo } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Radar as RadarIcon } from "lucide-react";
import { toNumber, getLatestAum, getFirmProducts, calcGrowthPct, FIRM_COLORS } from "./firmPerfUtils";

const DIMENSIONS = [
  { key: "aum", label: "AUM" },
  { key: "products", label: "Products" },
  { key: "netFlow", label: "Net Flow" },
  { key: "growth", label: "Growth %" },
  { key: "dataPoints", label: "Data History" },
];

export default function FirmPerfRadarChart({ firms = [], products = [] }) {
  const { data, hasData } = useMemo(() => {
    if (!firms.length) return { data: [], hasData: false };

    const rawValues = firms.map((firm) => {
      const latest = getLatestAum(firm);
      return {
        firm,
        aum: toNumber(latest.aum),
        products: getFirmProducts(firm, products).length,
        netFlow: toNumber(latest.netFlow),
        growth: calcGrowthPct(firm) ?? 0,
        dataPoints: (firm.aum_history || []).length,
      };
    });

    const maxes = {};
    for (const dim of DIMENSIONS) {
      const vals = rawValues.map((v) => Math.abs(v[dim.key]));
      maxes[dim.key] = Math.max(...vals, 1);
    }

    const chartData = DIMENSIONS.map((dim) => {
      const point = { dimension: dim.label };
      for (const rv of rawValues) {
        const norm = rv[dim.key] / maxes[dim.key];
        point[rv.firm.id] = Math.round(norm * 100);
      }
      return point;
    });

    return { data: chartData, hasData: rawValues.some((v) => v.aum > 0 || v.products > 0) };
  }, [firms, products]);

  if (!hasData) {
    return (
      <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl bg-white">
        Not enough data for radar comparison.
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <RadarIcon className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Multi-Dimensional Comparison</h3>
        <span className="text-[10px] text-gray-400 ml-auto">Normalized 0–100</span>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "#6b7280" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {firms.map((firm, i) => (
            <Radar
              key={firm.id}
              dataKey={firm.id}
              name={firm.name}
              stroke={FIRM_COLORS[i % FIRM_COLORS.length]}
              fill={FIRM_COLORS[i % FIRM_COLORS.length]}
              fillOpacity={0.08}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}