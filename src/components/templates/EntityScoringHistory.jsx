import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, History, Calendar, Lock, BarChart3, CheckCircle2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell
} from "recharts";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

/**
 * Compute the block-weighted average final score for a ScoringMatrixScore record.
 */
function computeWeightedFinal(score) {
  const blocks = score.scoring_blocks || [];
  let total = 0;
  let totalWeight = 0;
  blocks.forEach((block) => {
    const blockWeight = (block.weight || 0) / 100;
    (block.criteria || []).forEach((crit) => {
      if (crit.final_score != null) {
        total += crit.final_score * blockWeight;
        totalWeight += blockWeight;
      }
    });
  });
  return totalWeight > 0 ? parseFloat((total / totalWeight).toFixed(2)) : null;
}

// Map a scorecard's workflow status to a simple In Progress / Completed bucket.
// 'completed' = finalized (or closed); 'in_progress' = any active scoring phase.
function getScorecardStatus(score) {
  return score.status === "finalized" || score.is_closed ? "completed" : "in_progress";
}

const STATUS_META = {
  completed: { label: "Completed", color: "#16a34a", badge: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "#f59e0b", badge: "bg-amber-100 text-amber-700 border-amber-300", icon: Clock },
};

/**
 * Entity-level scoring history. Aggregates ALL ScoringMatrixScore records for a
 * given firm (across every product and template) so the user can track how the
 * firm's evaluation results improve over time.
 *
 * Props:
 *  - firmId: required firm ID
 */
export default function EntityScoringHistory({ firmId }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: scores = [], isLoading } = useQuery({
    queryKey: ["firmScoringHistory", firmId],
    queryFn: () =>
      base44.entities.ScoringMatrixScore.filter(
        { firm_id: firmId },
        "-scoring_start_date",
        200
      ),
    enabled: !!firmId
  });

  // Sort ascending by scoring_start_date (fallback to created_date)
  const sorted = useMemo(() => {
    return [...scores].sort((a, b) => {
      const da = a.scoring_start_date || a.created_date || "";
      const db = b.scoring_start_date || b.created_date || "";
      return da.localeCompare(db);
    });
  }, [scores]);

  // Chart data: one point per finalized score, plotted over time
  const chartData = useMemo(() => {
    return sorted
      .map((s) => {
        const wf = computeWeightedFinal(s);
        return {
          date: s.scoring_start_date || format(new Date(s.created_date), "yyyy-MM-dd"),
          label: format(parseISO(s.scoring_start_date || s.created_date), "MMM d, yy"),
          product: s.product_name || "—",
          template: s.template_name || "—",
          version: s.version_number || 1,
          weightedFinal: wf,
          overallRating: s.overall_rating || "",
          passFail: s.overall_pass_fail || "",
          status: s.status,
          id: s.id
        };
      })
      .filter((d) => d.weightedFinal != null);
  }, [sorted]);

  // Summary stats
  const finalized = useMemo(() => sorted.filter((s) => s.status === "finalized" || s.is_closed), [sorted]);
  const firstScore = chartData[0]?.weightedFinal;
  const lastScore = chartData[chartData.length - 1]?.weightedFinal;
  const delta = firstScore != null && lastScore != null ? parseFloat((lastScore - firstScore).toFixed(2)) : null;

  // Apply the In Progress / Completed status filter to the list view.
  const filteredSorted = useMemo(() => {
    if (statusFilter === "all") return sorted;
    return sorted.filter((s) => getScorecardStatus(s) === statusFilter);
  }, [sorted, statusFilter]);

  const inProgressCount = useMemo(() => sorted.filter((s) => getScorecardStatus(s) === "in_progress").length, [sorted]);
  const completedCount = finalized.length;

  // Summary comparison chart: latest weighted final score per product (investment manager),
  // so the user can compare performance across managers at a glance.
  const comparisonData = useMemo(() => {
    const latestByProduct = new Map();
    sorted.forEach((s) => {
      const key = s.product_id || s.product_name || "—";
      const existing = latestByProduct.get(key);
      const date = s.scoring_start_date || s.created_date || "";
      if (!existing || date.localeCompare(existing.scoring_start_date || existing.created_date || "") > 0) {
        latestByProduct.set(key, s);
      }
    });
    return [...latestByProduct.values()]
      .map((s) => {
        const wf = computeWeightedFinal(s);
        const status = getScorecardStatus(s);
        return {
          product: s.product_name || "—",
          score: wf,
          status,
          statusLabel: STATUS_META[status].label,
          version: s.version_number || 1,
        };
      })
      .filter((d) => d.score != null)
      .sort((a, b) => b.score - a.score);
  }, [sorted]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50/50">
        <History className="w-6 h-6 mx-auto mb-2 text-gray-300" />
        No scoring history for this firm yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center gap-2 border-b pb-2">
        <History className="w-4 h-4 text-indigo-500" />
        <h4 className="text-sm font-semibold">Scoring History — All Products</h4>
        <Badge variant="secondary" className="text-xs ml-auto">
          {sorted.length} evaluation{sorted.length !== 1 ? "s" : ""} · {finalized.length} finalized
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-gray-200 rounded-lg p-2 bg-white">
          <div className="text-[10px] text-gray-400 uppercase">First</div>
          <div className="text-lg font-bold text-gray-700">{firstScore != null ? firstScore : "—"}</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-2 bg-white">
          <div className="text-[10px] text-gray-400 uppercase">Latest</div>
          <div className="text-lg font-bold text-gray-700">{lastScore != null ? lastScore : "—"}</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-2 bg-white">
          <div className="text-[10px] text-gray-400 uppercase">Change</div>
          <div className={`text-lg font-bold ${delta == null ? "text-gray-400" : delta > 0 ? "text-green-600" : delta < 0 ? "text-red-600" : "text-gray-500"}`}>
            {delta == null ? "—" : (delta > 0 ? "+" : "") + delta}
          </div>
        </div>
      </div>

      {/* Trend chart */}
      {chartData.length > 1 ? (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">Weighted Final Score Over Time</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value, name) => [value != null ? value : "Not scored", name === "weightedFinal" ? "Weighted Final" : name]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${label} — ${item.product}` : label;
                }}
              />
              <ReferenceLine y={3} stroke="#94a3b8" strokeDasharray="2 2" label={{ value: "Avg (3)", fontSize: 10, fill: "#94a3b8" }} />
              <Line
                type="monotone"
                dataKey="weightedFinal"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 5, fill: "#8b5cf6" }}
                activeDot={{ r: 7 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-xs text-gray-400 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
          Need at least 2 finalized scores with final scores to plot a trend.
        </div>
      )}

      {/* Summary comparison chart — total score per investment manager (product) */}
      {comparisonData.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-medium">Total Score by Manager</span>
            <span className="text-[10px] text-gray-400 ml-auto">Latest evaluation per product · sorted high → low</span>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(180, comparisonData.length * 44)}>
            <BarChart data={comparisonData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="product" tick={{ fontSize: 11 }} width={140} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value, name) => [value != null ? value : "Not scored", name === "score" ? "Weighted Final" : name]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${label} · ${item.statusLabel} (v${item.version})` : label;
                }}
              />
              <ReferenceLine x={3} stroke="#94a3b8" strokeDasharray="2 2" />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={28}>
                {comparisonData.map((entry, i) => (
                  <Cell key={i} fill={entry.status === "completed" ? "#16a34a" : "#f59e0b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500" />Completed</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />In Progress</span>
          </div>
        </div>
      )}

      {/* Full evaluation list — with In Progress / Completed status indicators + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <h4 className="text-sm font-semibold">Scorecards</h4>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400">Filter:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({sorted.length})</SelectItem>
              <SelectItem value="in_progress">In Progress ({inProgressCount})</SelectItem>
              <SelectItem value="completed">Completed ({completedCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        {filteredSorted.length === 0 && (
          <div className="text-center text-xs text-gray-400 border border-gray-200 rounded-lg p-4 bg-gray-50/50">
            No scorecards match this filter.
          </div>
        )}
        {[...filteredSorted].reverse().map((s) => {
          const wf = computeWeightedFinal(s);
          const status = getScorecardStatus(s);
          const meta = STATUS_META[status];
          const StatusIcon = meta.icon;
          return (
            <div key={s.id} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{s.product_name || "—"}</span>
                    <Badge variant="outline" className="text-[10px]">v{s.version_number || 1}</Badge>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badge}`} title={s.status}>
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    {s.is_closed && <Lock className="w-3 h-3 text-gray-400" />}
                    {s.overall_pass_fail && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold text-white ${s.overall_pass_fail === "Pass" ? "bg-green-500" : "bg-red-500"}`}>
                        {s.overall_pass_fail}
                      </span>
                    )}
                    {s.overall_rating && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                        {s.overall_rating}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                    <span className="truncate">{s.template_name || "—"}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {s.scoring_start_date ? format(parseISO(s.scoring_start_date), "MMM d, yyyy") : "—"}
                      {s.scoring_end_date && <> → {format(parseISO(s.scoring_end_date), "MMM d, yyyy")}</>}
                    </span>
                  </div>
                </div>
                {wf != null && (
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${SCORE_COLORS[Math.round(wf)] || "border-gray-200"}`}>
                    {wf}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}