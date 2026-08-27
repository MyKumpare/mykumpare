import React, { useMemo, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList
} from "recharts";
import { BarChart3, Radar as RadarIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

const SCORE_COLORS_HEX = {
  1: "#dc2626",
  2: "#ea580c",
  3: "#ca8a04",
  4: "#65a30d",
  5: "#16a34a"
};

const colorForScore = (s) => {
  if (s == null) return "#9ca3af";
  const r = Math.round(s);
  return SCORE_COLORS_HEX[r] || "#9ca3af";
};

/**
 * Visualization comparing the firm's final scores against peer benchmark averages.
 * Supports two views: a radar chart (overall shape comparison) and a bar chart
 * (per-criterion ranking with delta indicators).
 */
export default function ScoringMatrixBenchmarkChart({ blocks, benchmark }) {
  const [view, setView] = useState("radar"); // "radar" | "bar"

  const hasBenchmark =
    benchmark &&
    benchmark.total_sample_size > 0 &&
    Object.keys(benchmark.criteria || {}).length > 0;

  const data = useMemo(() => {
    const rows = [];
    blocks.forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        const bench = hasBenchmark ? benchmark.criteria[crit.id] : null;
        const finalScore = crit.final_score;
        const avg = bench?.avg_score != null ? Math.round(bench.avg_score * 100) / 100 : null;
        const delta = finalScore != null && avg != null ? Math.round((finalScore - avg) * 100) / 100 : null;
        rows.push({
          name: crit.name,
          shortName: crit.name.length > 22 ? crit.name.slice(0, 20) + "…" : crit.name,
          block: block.name,
          finalScore: finalScore != null ? Math.round(finalScore * 100) / 100 : null,
          benchmarkAvg: avg,
          delta,
          sampleSize: bench?.sample_size || 0
        });
      });
    });
    return rows;
  }, [blocks, benchmark, hasBenchmark]);

  const scoredRows = data.filter((r) => r.finalScore != null);
  const comparableRows = data.filter((r) => r.finalScore != null && r.benchmarkAvg != null);

  // Summary stats
  const summary = useMemo(() => {
    if (!comparableRows.length) return null;
    const above = comparableRows.filter((r) => r.delta > 0).length;
    const below = comparableRows.filter((r) => r.delta < 0).length;
    const equal = comparableRows.filter((r) => r.delta === 0).length;
    const avgDelta =
      Math.round((comparableRows.reduce((s, r) => s + r.delta, 0) / comparableRows.length) * 100) / 100;
    const best = comparableRows.reduce((max, r) => (r.delta > max.delta ? r : max), comparableRows[0]);
    const worst = comparableRows.reduce((min, r) => (r.delta < min.delta ? r : min), comparableRows[0]);
    return { above, below, equal, avgDelta, best, worst, total: comparableRows.length };
  }, [comparableRows]);

  if (!scoredRows.length) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 text-gray-400">
          <BarChart3 className="w-4 h-4" />
          <span className="text-sm">No finalized scores yet to visualize.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
      {/* Header + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <h4 className="text-sm font-semibold text-gray-800">
            Score vs. Peer Benchmark
          </h4>
          {hasBenchmark && (
            <span className="text-[11px] text-gray-500">
              ({comparableRows.length} of {scoredRows.length} scored criteria have peer data)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setView("radar")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              view === "radar" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <RadarIcon className="w-3 h-3" /> Radar
          </button>
          <button
            type="button"
            onClick={() => setView("bar")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              view === "bar" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <BarChart3 className="w-3 h-3" /> Bar
          </button>
        </div>
      </div>

      {/* Summary strip (only when benchmark exists) */}
      {hasBenchmark && summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-green-50 border border-green-200 rounded-md p-2">
            <div className="flex items-center gap-1 text-green-700">
              <TrendingUp className="w-3 h-3" />
              <span className="text-[11px] font-medium">Above Peer</span>
            </div>
            <p className="text-lg font-bold text-green-700">{summary.above}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-md p-2">
            <div className="flex items-center gap-1 text-red-700">
              <TrendingDown className="w-3 h-3" />
              <span className="text-[11px] font-medium">Below Peer</span>
            </div>
            <p className="text-lg font-bold text-red-700">{summary.below}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
            <div className="flex items-center gap-1 text-gray-600">
              <Minus className="w-3 h-3" />
              <span className="text-[11px] font-medium">Equal</span>
            </div>
            <p className="text-lg font-bold text-gray-700">{summary.equal}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-md p-2">
            <span className="text-[11px] font-medium text-indigo-700">Avg Delta</span>
            <p
              className="text-lg font-bold"
              style={{ color: summary.avgDelta > 0 ? "#15803d" : summary.avgDelta < 0 ? "#b91c1c" : "#4b5563" }}
            >
              {summary.avgDelta > 0 ? "+" : ""}{summary.avgDelta}
            </p>
          </div>
        </div>
      )}

      {/* Chart area */}
      <div className="w-full" style={{ height: 360 }}>
        {view === "radar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="75%">
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="shortName" tick={{ fontSize: 10, fill: "#6b7280" }} />
              <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9, fill: "#9ca3af" }} angle={90} />
              {hasBenchmark && (
                <Radar
                  name="Peer Avg"
                  dataKey="benchmarkAvg"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.18}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              )}
              <Radar
                name="This Firm"
                dataKey="finalScore"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.35}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                formatter={(value, name) => {
                  if (value == null) return [name === "This Firm" ? "Not scored" : "No peer data", name];
                  return [value, name];
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 32, bottom: 4, left: 4 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: "#6b7280" }} />
              <YAxis
                type="category"
                dataKey="shortName"
                tick={{ fontSize: 10, fill: "#374151" }}
                width={140}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                formatter={(value, name) => {
                  if (value == null) return [name === "finalScore" ? "Not scored" : "No peer data", name === "finalScore" ? "This Firm" : "Peer Avg"];
                  return [value, name === "finalScore" ? "This Firm" : "Peer Avg"];
                }}
                labelFormatter={(label, payload) => {
                  const row = data.find((d) => d.shortName === label);
                  return row ? `${row.name} (${row.block})` : label;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar name="This Firm" dataKey="finalScore" radius={[0, 3, 3, 0]}>
                {data.map((row, i) => (
                  <Cell key={`f-${i}`} fill={colorForScore(row.finalScore)} />
                ))}
                <LabelList dataKey="finalScore" position="right" style={{ fontSize: 10, fill: "#374151" }} />
              </Bar>
              {hasBenchmark && (
                <Bar name="Peer Avg" dataKey="benchmarkAvg" radius={[0, 3, 3, 0]} fill="#c7d2fe" />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Best / worst callouts */}
      {hasBenchmark && summary && comparableRows.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="border border-green-200 bg-green-50 rounded-md p-2">
            <div className="text-[11px] font-medium text-green-700 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Strongest vs. Peers
            </div>
            <p className="text-xs text-gray-700 mt-0.5">
              <span className="font-medium">{summary.best.name}</span>{" "}
              <span className="text-green-700 font-semibold">+{summary.best.delta}</span>
              <span className="text-gray-400"> (firm {summary.best.finalScore} vs avg {summary.best.benchmarkAvg})</span>
            </p>
          </div>
          <div className="border border-red-200 bg-red-50 rounded-md p-2">
            <div className="text-[11px] font-medium text-red-700 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Weakest vs. Peers
            </div>
            <p className="text-xs text-gray-700 mt-0.5">
              <span className="font-medium">{summary.worst.name}</span>{" "}
              <span className="text-red-700 font-semibold">{summary.worst.delta}</span>
              <span className="text-gray-400"> (firm {summary.worst.finalScore} vs avg {summary.worst.benchmarkAvg})</span>
            </p>
          </div>
        </div>
      )}

      {!hasBenchmark && (
        <p className="text-[11px] text-gray-400 text-center">
          No peer benchmark data available — chart shows this firm's scores only.
        </p>
      )}
    </div>
  );
}