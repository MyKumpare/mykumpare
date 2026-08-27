import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
export default function ScoringMatrixComparisonTable({ blocks, showSecondary, showTeam, showAdjustedPrimary, showIC, showFinal }) {
  const [expandedBlocks, setExpandedBlocks] = useState({});

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
                  <td colSpan={showFinal ? (showSecondary ? 8 : 7) : showIC ? (showSecondary ? 7 : 6) : 3} className="p-2 font-semibold text-gray-700">
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
    </div>
  );
}