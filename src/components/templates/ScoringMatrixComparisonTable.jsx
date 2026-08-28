import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, TrendingUp, AlertTriangle, CheckCircle2, BarChart3, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ScoringMatrixBenchmarkChart from "./ScoringMatrixBenchmarkChart";
import ScoringMatrixReviewNotes from "./ScoringMatrixReviewNotes";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

/**
 * Enhanced comparison table showing Primary, Team, IC, and Final scores side-by-side.
 * Team and IC cells are shaded green/red based on their deviation from the Final score.
 */
export default function ScoringMatrixComparisonTable({ blocks, showSecondary, showTeam, showAdjustedPrimary, showIC, showFinal, benchmark, scoreId, reviewNotes }) {
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const hasBenchmark = benchmark && benchmark.total_sample_size > 0 && Object.keys(benchmark.criteria || {}).length > 0;

  const allCriteria = useMemo(() => {
    const list = [];
    blocks.forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        list.push({ ...crit, blockName: block.name, blockWeight: block.weight, blockId: block.id });
      });
    });
    return list;
  }, [blocks]);

  const toggleBlock = (id) => setExpandedBlocks((p) => ({ ...p, [id]: !p[id] }));

  // Compute deviation from final score and return shading style
  const getDeviationShading = (score, finalScore) => {
    if (score == null || finalScore == null) return {};
    const diff = score - finalScore;
    if (diff === 0) return { background: "transparent", color: "inherit" };
    const intensity = Math.min(Math.abs(diff) / 4, 1);
    if (diff > 0) {
      return { background: `rgba(34, 197, 94, ${0.12 + intensity * 0.35})`, color: "#166534" };
    } else {
      return { background: `rgba(239, 68, 68, ${0.12 + intensity * 0.35})`, color: "#991b1b" };
    }
  };

  const formatScore = (score) => {
    if (score == null) return <span className="text-gray-300">—</span>;
    return <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${SCORE_COLORS[score] || "border-gray-200"}`}>{score}</span>;
  };

  // Format benchmark average score with comparison to the firm's final score
  const formatBenchmarkCell = (critId, finalScore) => {
    if (!hasBenchmark) return <span className="text-gray-300">—</span>;
    const bench = benchmark.criteria[critId];
    if (!bench || bench.avg_score == null) return <span className="text-gray-300 text-[10px]">N/A</span>;
    const avg = bench.avg_score;
    const diff = finalScore != null ? Math.round((finalScore - avg) * 100) / 100 : null;
    const roundedAvg = Math.round(avg * 10) / 10;
    const scoreColor = SCORE_COLORS[Math.round(avg)] || "border-gray-200";
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${scoreColor}`} style={{ borderStyle: "dashed" }}>
          {roundedAvg}
        </span>
        {diff != null && diff !== 0 && (
          <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: diff > 0 ? "#166534" : "#991b1b" }}>
            {diff > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
            {diff > 0 ? "+" : ""}{diff}
          </span>
        )}
        {diff === 0 && (
          <span className="text-[10px] font-medium flex items-center gap-0.5 text-gray-400">
            <Minus className="w-2.5 h-2.5" />0
          </span>
        )}
      </div>
    );
  };

  const formatScoreWithDeviation = (score, finalScore) => {
    if (score == null) return <span className="text-gray-300">—</span>;
    const shading = getDeviationShading(score, finalScore);
    const diff = finalScore != null ? score - finalScore : 0;
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${SCORE_COLORS[score] || "border-gray-200"}`} style={shading}>
          {score}
        </span>
        {finalScore != null && diff !== 0 && (
          <span className="text-[10px] font-medium" style={{ color: shading.color }}>
            {diff > 0 ? "+" : ""}{diff}
          </span>
        )}
      </div>
    );
  };

  // Compute stats
  const stats = useMemo(() => {
    let totalCriteria = 0;
    let withDeviations = 0;
    let maxDeviation = 0;
    let deviatingCriteria = [];

    allCriteria.forEach((crit) => {
      totalCriteria++;
      const finalScore = crit.final_score;
      const scores = [crit.primary_score, crit.team_score, crit.ic_score, crit.adjusted_primary_score].filter((s) => s != null && finalScore != null);
      const maxDiff = Math.max(...scores.map((s) => Math.abs(s - finalScore)), 0);
      if (maxDiff >= 2) {
        withDeviations++;
        deviatingCriteria.push({ name: crit.name, block: crit.blockName, maxDiff });
      }
      if (maxDiff > maxDeviation) maxDeviation = maxDiff;
    });

    return { totalCriteria, withDeviations, maxDeviation, deviatingCriteria };
  }, [allCriteria]);

  // Group criteria by block
  const blocksWithCriteria = useMemo(() => {
    return blocks.map((block) => ({
      ...block,
      criteriaList: (block.criteria || []).map((c) => ({ ...c, blockName: block.name, blockId: block.id }))
    }));
  }, [blocks]);

  return (
    <div className="space-y-3">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500">Total Criteria</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.totalCriteria}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-gray-500">Significant Deviations (≥2)</span>
          </div>
          <p className="text-xl font-bold mt-1 text-amber-600">{stats.withDeviations}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-500">Max Deviation</span>
          </div>
          <p className="text-xl font-bold mt-1 text-purple-600">{stats.maxDeviation} pt{stats.maxDeviation !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Benchmark info banner */}
      {hasBenchmark && (
        <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50">
          <div className="flex items-start gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-indigo-900">
                  Peer Benchmark — {benchmark.similarity_basis}
                </span>
                <div className="flex items-center gap-3 text-[11px] text-indigo-700">
                  <span>{benchmark.total_sample_size} scored evaluations</span>
                  <span>·</span>
                  <span>{benchmark.similar_firm_count} similar firms</span>
                </div>
              </div>
              <p className="text-[11px] text-indigo-600 mt-0.5">
                Dashed-circle values show the average historic final score from similar investment managers.
                Arrows indicate how this firm's final score compares against the peer average.
              </p>
            </div>
          </div>
        </div>
      )}
      {benchmark && !hasBenchmark && benchmark.message && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
          <div className="flex items-start gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-medium text-gray-600">Peer Benchmark unavailable</span>
              <p className="text-[11px] text-gray-500 mt-0.5">{benchmark.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Benchmark visualization */}
      <ScoringMatrixBenchmarkChart blocks={blocks} benchmark={benchmark} />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 rounded-lg p-2 px-3">
        <span className="font-medium">Deviation from Final:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ background: "rgba(34, 197, 94, 0.35)" }}></div>
          <span>Higher than Final (green)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ background: "rgba(239, 68, 68, 0.35)" }}></div>
          <span>Lower than Final (red)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-gray-200 bg-white"></div>
          <span>No deviation</span>
        </div>
      </div>

      {/* Comparison table */}
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="border-b">
              <th className="text-left p-2 font-medium text-gray-600 min-w-[200px]">Criterion</th>
              <th className="text-center p-2 font-medium text-gray-600">Primary</th>
              {showSecondary && <th className="text-center p-2 font-medium text-gray-600">Secondary</th>}
              {showTeam && <th className="text-center p-2 font-medium text-gray-600">Team</th>}
              {showAdjustedPrimary && <th className="text-center p-2 font-medium text-gray-600">Adj. Primary</th>}
              {showIC && <th className="text-center p-2 font-medium text-gray-600">IC</th>}
              {showFinal && <th className="text-center p-2 font-medium text-gray-600 bg-blue-50">Final</th>}
              {hasBenchmark && <th className="text-center p-2 font-medium text-gray-600 bg-indigo-50">Peer Avg</th>}
              <th className="text-center p-2 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {blocksWithCriteria.map((block) => (
              <React.Fragment key={block.id}>
                <tr
                  className="bg-gray-100 cursor-pointer hover:bg-gray-200"
                  onClick={() => toggleBlock(block.id)}
                >
                  <td colSpan={3 + (showSecondary?1:0) + (showTeam?1:0) + (showAdjustedPrimary?1:0) + (showIC?1:0) + (showFinal?1:0) + (hasBenchmark?1:0)} className="p-2 font-semibold text-gray-700">
                    <div className="flex items-center gap-1.5">
                      {expandedBlocks[block.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {block.name} <span className="text-gray-400 font-normal">({block.weight}%)</span>
                    </div>
                  </td>
                </tr>
                {expandedBlocks[block.id] && block.criteriaList.map((crit) => {
                  const finalScore = crit.final_score;
                  const allScores = [crit.primary_score, crit.team_score, crit.ic_score, crit.adjusted_primary_score].filter((s) => s != null);
                  const hasSignificantDeviation = finalScore != null && allScores.some((s) => Math.abs(s - finalScore) >= 2);
                  const hasAnyDeviation = finalScore != null && allScores.some((s) => s !== finalScore);

                  return (
                    <tr key={crit.id} className={`border-b hover:bg-gray-50 ${hasSignificantDeviation ? "bg-amber-50" : ""}`}>
                      <td className="p-2">
                        <div className="font-medium">{crit.name}</div>
                        {crit.category && <div className="text-gray-400 text-[10px]">{crit.category}</div>}
                      </td>
                      {/* Primary - shaded by deviation from final */}
                      <td className="p-2 text-center">
                        {showFinal && finalScore != null
                          ? formatScoreWithDeviation(crit.primary_score, finalScore)
                          : formatScore(crit.primary_score)}
                      </td>
                      {showSecondary && (
                        <td className="p-2 text-center">
                          {showFinal && finalScore != null
                            ? formatScoreWithDeviation(crit.secondary_score, finalScore)
                            : formatScore(crit.secondary_score)}
                        </td>
                      )}
                      {showTeam && (
                        <td className="p-2 text-center">
                          {showFinal && finalScore != null
                            ? formatScoreWithDeviation(crit.team_score, finalScore)
                            : formatScore(crit.team_score)}
                        </td>
                      )}
                      {showAdjustedPrimary && (
                        <td className="p-2 text-center">
                          {showFinal && finalScore != null
                            ? formatScoreWithDeviation(crit.adjusted_primary_score, finalScore)
                            : formatScore(crit.adjusted_primary_score)}
                        </td>
                      )}
                      {showIC && (
                        <td className="p-2 text-center">
                          {showFinal && finalScore != null
                            ? formatScoreWithDeviation(crit.ic_score, finalScore)
                            : formatScore(crit.ic_score)}
                        </td>
                      )}
                      {showFinal && (
                        <td className="p-2 text-center bg-blue-50/50">
                          {formatScore(crit.final_score)}
                        </td>
                      )}
                      {hasBenchmark && (
                        <td className="p-2 text-center bg-indigo-50/40">
                          {formatBenchmarkCell(crit.id, crit.final_score)}
                        </td>
                      )}
                      <td className="p-2 text-center">
                        {hasSignificantDeviation ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px]">⚠ Review</Badge>
                        ) : hasAnyDeviation ? (
                          <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 text-[10px]">~ Minor</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-[10px]">✓ Aligned</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Deviating criteria list */}
      {stats.deviatingCriteria.length > 0 && (
        <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
          <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Criteria with Significant Deviations (≥2 points from Final)
          </h4>
          <div className="space-y-1">
            {stats.deviatingCriteria.map((c, i) => (
              <div key={i} className="text-xs text-amber-700 flex items-center justify-between">
                <span>{c.block} → {c.name}</span>
                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px]">{c.maxDiff} pt deviation</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qualitative review notes — auto-saves to the score record */}
      {scoreId && (
        <ScoringMatrixReviewNotes scoreId={scoreId} reviewNotes={reviewNotes} />
      )}
    </div>
  );
}