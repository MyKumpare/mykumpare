import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function AnalystAssignmentChart({ xponanceContacts, assignmentCounts }) {
  const chartData = useMemo(() => {
    return xponanceContacts
      .map((c) => {
        const counts = assignmentCounts[c.id] || { primary: 0, secondary: 0 };
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";
        return {
          name: name.length > 15 ? name.split(" ").map((n) => n[0]).join("") + " " + c.last_name : name,
          fullName: [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" "),
          Primary: counts.primary,
          Secondary: counts.secondary,
          Total: counts.primary + counts.secondary,
        };
      })
      .sort((a, b) => b.Total - a.Total);
  }, [xponanceContacts, assignmentCounts]);

  const balance = useMemo(() => {
    const totals = chartData.map((d) => d.Total);
    const totalAssignments = totals.reduce((s, n) => s + n, 0);
    const analystCount = totals.length;
    const avg = analystCount > 0 ? totalAssignments / analystCount : 0;
    const max = analystCount > 0 ? Math.max(...totals) : 0;
    const min = analystCount > 0 ? Math.min(...totals) : 0;
    const unassigned = totals.filter((t) => t === 0).length;
    // Simple imbalance ratio: how far the max is from the average (0 = perfectly balanced, 1+ = very imbalanced)
    const imbalance = avg > 0 ? (max - min) / avg : 0;
    return { totalAssignments, analystCount, avg, max, min, unassigned, imbalance };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400 italic">
        No Xponance analysts found.
      </div>
    );
  }

  const balanceLabel = balance.imbalance < 0.5 ? "Well balanced" : balance.imbalance < 1.2 ? "Moderately imbalanced" : "Heavily imbalanced";
  const balanceColor = balance.imbalance < 0.5 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : balance.imbalance < 1.2 ? "text-amber-600 bg-amber-50 border-amber-200" : "text-red-600 bg-red-50 border-red-200";

  return (
    <div>
      {/* Workload balance summary */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs">
          <span className="text-gray-400">Analysts:</span>
          <span className="font-bold text-gray-700">{balance.analystCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs">
          <span className="text-gray-400">Total assignments:</span>
          <span className="font-bold text-gray-700">{balance.totalAssignments}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs">
          <span className="text-gray-400">Avg/analyst:</span>
          <span className="font-bold text-gray-700">{balance.avg.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs">
          <span className="text-gray-400">Min / Max:</span>
          <span className="font-bold text-gray-700">{balance.min} / {balance.max}</span>
        </div>
        {balance.unassigned > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200 text-xs">
            <span className="text-violet-400">Unassigned analysts:</span>
            <span className="font-bold text-violet-700">{balance.unassigned}</span>
          </div>
        )}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${balanceColor}`}>
          {balanceLabel}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 36 + 60)}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#374151" }} />
          <Tooltip
            formatter={(value, name) => [value, name]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Primary" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Secondary" stackId="a" fill="#a78bfa" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}