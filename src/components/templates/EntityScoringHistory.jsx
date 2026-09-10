import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, History, Calendar, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
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

/**
 * Entity-level scoring history. Aggregates ALL ScoringMatrixScore records for a
 * given firm (across every product and template) so the user can track how the
 * firm's evaluation results improve over time.
 *
 * Props:
 *  - firmId: required firm ID
 */
export default function EntityScoringHistory({ firmId }) {
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

      {/* Full evaluation list */}
      <div className="space-y-2">
        {[...sorted].reverse().map((s) => {
          const wf = computeWeightedFinal(s);
          return (
            <div key={s.id} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{s.product_name || "—"}</span>
                    <Badge variant="outline" className="text-[10px]">v{s.version_number || 1}</Badge>
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
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