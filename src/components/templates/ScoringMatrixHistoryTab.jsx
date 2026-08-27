import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, History, TrendingUp, Calendar, GitBranch, Lock, FileText } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
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
 * History tab showing how an entity's final scores change over time.
 * Fetches all ScoringMatrixScore records for the same product + template,
 * ordered by version, and visualizes the evaluation progress with a trend chart.
 *
 * Props:
 *   score - the current ScoringMatrixScore record
 *   onOpenScore - callback(scoreId) to open a different score version
 */
export default function ScoringMatrixHistoryTab({ score, onOpenScore }) {
  const [selectedVersion, setSelectedVersion] = useState(null);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["scoringMatrixHistory", score?.product_id, score?.template_id],
    queryFn: () =>
      base44.entities.ScoringMatrixScore.filter({
        product_id: score.product_id,
        template_id: score.template_id
      }, "-scoring_start_date", 100),
    enabled: !!score?.product_id && !!score?.template_id
  });

  // Sort by version_number ascending for the chart
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => (a.version_number || 1) - (b.version_number || 1));
  }, [history]);

  // Build chart data: one data point per scoring version, showing weighted final score
  const chartData = useMemo(() => {
    return sortedHistory.map((s) => {
      const blocks = s.scoring_blocks || [];
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
      const weightedFinal = totalWeight > 0 ? parseFloat((total / totalWeight).toFixed(2)) : null;

      return {
        version: `v${s.version_number || 1}`,
        versionNum: s.version_number || 1,
        date: s.scoring_start_date || format(new Date(s.created_date), "yyyy-MM-dd"),
        weightedFinal,
        status: s.status,
        isClosed: s.is_closed,
        id: s.id
      };
    });
  }, [sortedHistory]);

  // Per-criterion trend data (for the detailed breakdown)
  const criterionTrend = useMemo(() => {
    if (sortedHistory.length === 0) return [];
    const firstScore = sortedHistory[0];
    const criteria = [];
    (firstScore.scoring_blocks || []).forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        criteria.push({
          id: crit.id,
          name: crit.name,
          blockName: block.name,
          scores: sortedHistory.map((s) => {
            const b = (s.scoring_blocks || []).find((bl) => bl.id === block.id);
            const c = b?.criteria?.find((cr) => cr.id === crit.id);
            return c?.final_score ?? null;
          })
        });
      });
    });
    return criteria;
  }, [sortedHistory]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (sortedHistory.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No scoring history available.
      </div>
    );
  }

  const currentVersion = score.version_number || 1;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center gap-2 border-b pb-2">
        <History className="w-4 h-4 text-indigo-500" />
        <h4 className="text-sm font-semibold">Scoring History — {score.product_name}</h4>
        <Badge variant="secondary" className="text-xs ml-auto">
          {sortedHistory.length} version{sortedHistory.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">Weighted Final Score Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="version" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value, name) => [value != null ? value : "Not scored", name === "weightedFinal" ? "Weighted Final" : name]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.version === label);
                  return item ? `${label} — ${item.date}` : label;
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
      )}

      {/* Version timeline */}
      <div className="space-y-2">
        {[...sortedHistory].reverse().map((s) => {
          const isCurrent = s.id === score.id;
          const vNum = s.version_number || 1;
          const daysElapsed = s.scoring_start_date && s.scoring_end_date
            ? differenceInDays(parseISO(s.scoring_end_date), parseISO(s.scoring_start_date))
            : null;

          // Compute weighted final for this version
          let weightedFinal = null;
          let totalWeight = 0;
          let totalScore = 0;
          (s.scoring_blocks || []).forEach((block) => {
            const bw = (block.weight || 0) / 100;
            (block.criteria || []).forEach((crit) => {
              if (crit.final_score != null) {
                totalScore += crit.final_score * bw;
                totalWeight += bw;
              }
            });
          });
          if (totalWeight > 0) weightedFinal = (totalScore / totalWeight).toFixed(2);

          return (
            <div
              key={s.id}
              className={`border rounded-lg p-3 transition-colors ${
                isCurrent ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Version badge */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      isCurrent ? "bg-indigo-100 border-indigo-400 text-indigo-700" : "bg-gray-100 border-gray-300 text-gray-600"
                    }`}>
                      v{vNum}
                    </div>
                    {s.is_closed && <Lock className="w-3 h-3 text-gray-400" />}
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {s.is_closed ? "Finalized Scoring" : "In Progress"}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                      {isCurrent && <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-700">Current View</Badge>}
                      {s.prior_score_id && (
                        <Badge variant="outline" className="text-[10px] flex items-center gap-0.5">
                          <GitBranch className="w-2.5 h-2.5" /> Re-scored from v{sortedHistory.find((h) => h.id === s.prior_score_id)?.version_number || "?"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {s.scoring_start_date ? format(parseISO(s.scoring_start_date), "MMM d, yyyy") : "—"}
                        {s.scoring_end_date && (
                          <> → {format(parseISO(s.scoring_end_date), "MMM d, yyyy")}</>
                        )}
                      </span>
                      {daysElapsed != null && (
                        <span className="text-gray-400">({daysElapsed} day{daysElapsed !== 1 ? "s" : ""})</span>
                      )}
                      {weightedFinal != null && (
                        <span className="flex items-center gap-1 font-medium text-gray-700">
                          Final: <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border ${SCORE_COLORS[Math.round(weightedFinal)] || "border-gray-200"}`}>{weightedFinal}</span>
                        </span>
                      )}
                    </div>
                    {s.primary_analyst_name && (
                      <p className="text-xs text-gray-400 mt-0.5">Analyst: {s.primary_analyst_name}</p>
                    )}
                  </div>
                </div>

                {/* Open button */}
                {!isCurrent && onOpenScore && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onOpenScore(s.id)}
                  >
                    <FileText className="w-3.5 h-3.5" /> Open
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-criterion trend table */}
      {criterionTrend.length > 0 && sortedHistory.length > 1 && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <div className="px-3 py-2 bg-gray-50 border-b">
            <span className="text-sm font-medium">Per-Criterion Final Score Evolution</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="border-b">
                <th className="text-left p-2 font-medium text-gray-600 min-w-[200px]">Criterion</th>
                {sortedHistory.map((s) => (
                  <th key={s.id} className="text-center p-2 font-medium text-gray-600">
                    v{s.version_number || 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criterionTrend.map((crit) => (
                <tr key={crit.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <div className="font-medium">{crit.name}</div>
                    <div className="text-gray-400 text-[10px]">{crit.blockName}</div>
                  </td>
                  {crit.scores.map((s, i) => (
                    <td key={i} className="p-2 text-center">
                      {s != null ? (
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${SCORE_COLORS[s] || "border-gray-200"}`}>
                          {s}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}