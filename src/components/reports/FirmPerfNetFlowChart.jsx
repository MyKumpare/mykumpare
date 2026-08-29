import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { TrendingUp } from "lucide-react";
import { toNumber, compactCurrency, getLatestAum, FIRM_COLORS } from "./firmPerfUtils";

export default function FirmPerfNetFlowChart({ firms = [] }) {
  const data = useMemo(() => {
    return firms.map((f, i) => {
      const latest = getLatestAum(f);
      const flow = toNumber(latest.netFlow);
      return {
        name: (f.name || "").slice(0, 20),
        fullName: f.name,
        flow,
        gained: toNumber(latest.gained),
        loss: toNumber(latest.loss),
        color: FIRM_COLORS[i % FIRM_COLORS.length],
      };
    });
  }, [firms]);

  if (!data.length || data.every((d) => d.flow === 0 && d.gained === 0 && d.loss === 0)) {
    return (
      <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl bg-white">
        No net flow data available.
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold text-gray-800">Latest Net Asset Flows</h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} interval={0} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
          <Tooltip
            formatter={(v, name) => {
              const label = name === "flow" ? "Net Flow" : name === "gained" ? "Gained" : "Loss";
              return [compactCurrency(v), label];
            }}
            labelFormatter={(l) => data.find((d) => d.name === l)?.fullName || l}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1} />
          <Bar dataKey="flow" radius={[4, 4, 0, 0]} name="flow">
            {data.map((d, i) => (
              <Cell key={i} fill={d.flow >= 0 ? "#10b981" : "#f43f5e"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}