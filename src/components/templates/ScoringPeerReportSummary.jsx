import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from "recharts";
import { BarChart3 } from "lucide-react";

function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return (Math.round(n * 100) / 100).toString();
}

const SUMMARY_ROWS = [
  { key: "own", label: "Your Score", color: "#2563eb" },
  { key: "high", label: "Peer High", color: "#16a34a" },
  { key: "mean", label: "Peer Mean", color: "#4f46e5" },
  { key: "median", label: "Peer Median", color: "#7c3aed" },
  { key: "low", label: "Peer Low", color: "#dc2626" },
];

/**
 * Visual report summary comparing the product's own weighted score against
 * the peer group's High, Low, Mean, and Median as a horizontal bar chart —
 * so the analyst can quickly see where the product sits relative to its
 * benchmarks at a glance.
 */
export default function ScoringPeerReportSummary({ overallStats, ownScore, phaseLabel, peerCount }) {
  const data = SUMMARY_ROWS.map((row) => {
    const value = row.key === "own" ? ownScore : overallStats?.[row.key];
    return { name: row.label, value, color: row.color, isOwn: row.key === "own" };
  }).filter((d) => d.value != null);

  if (!data.length) {
    return (
      <div className="border border-gray-200 rounded-lg p-6 text-center text-xs text-gray-400">
        <BarChart3 className="w-6 h-6 mx-auto mb-2 text-gray-300" />
        Select peer products to generate the benchmark report summary.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          Benchmark Report Summary ({phaseLabel})
        </h4>
        <p className="text-[11px] text-gray-500 mt-0.5">
          Visual comparison of this product's weighted {phaseLabel.toLowerCase()} against the peer
          group's High, Low, Mean, and Median
          {peerCount ? ` across ${peerCount} peer${peerCount > 1 ? "s" : ""}` : ""}.
        </p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 45, bottom: 5, left: 10 }}
          barCategoryGap={8}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            formatter={(value) => [fmt(value), "Score"]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} minPointSize={2}>
            {data.map((entry, idx) => (
              <Cell key={idx} fill={entry.color} fillOpacity={entry.isOwn ? 0.95 : 0.75} />
            ))}
            <LabelList dataKey="value" position="right" formatter={fmt} style={{ fontSize: 11, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}