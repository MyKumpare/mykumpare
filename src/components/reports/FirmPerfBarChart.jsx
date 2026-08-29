import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { toNumber, compactCurrency, getLatestAum, FIRM_COLORS } from "./firmPerfUtils";

export default function FirmPerfBarChart({ firms = [], title = "Latest AUM by Firm", icon: Icon }) {
  const data = useMemo(() => {
    return firms.map((f, i) => ({
      name: (f.name || "").slice(0, 20),
      fullName: f.name,
      aum: toNumber(getLatestAum(f).aum),
      color: FIRM_COLORS[i % FIRM_COLORS.length],
    }));
  }, [firms]);

  if (!data.length || data.every((d) => d.aum === 0)) {
    return (
      <div className="text-sm text-gray-400 italic py-6 text-center border border-dashed border-gray-200 rounded-xl bg-white">
        No AUM data available.
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-indigo-600" />}
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} interval={0} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
          <Tooltip
            formatter={(v) => [compactCurrency(v), "AUM"]}
            labelFormatter={(l) => data.find((d) => d.name === l)?.fullName || l}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="aum" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}