import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Target, TrendingUp, TrendingDown } from "lucide-react";
import { computeWeightedScoreMulti } from "@/components/templates/scoringWeightLogic";
import { computeBonusPenaltyTotal, getCriterionRange } from "@/components/templates/testmode/testModeUtils";

const fmt = (n) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(2));

/**
 * Side-by-side scorecard summary: final weighted total, pass/fail, total max
 * score, and bonus/penalty impact. Used in the Scorecard Comparison view.
 */
export default function ScorecardSummaryStats({ score, template, accent }) {
  const blocks = score?.scoring_blocks || [];

  const templateCriteria = useMemo(() => {
    const map = {};
    (template?.scoring_blocks || []).forEach((b) => {
      (b.criteria || []).forEach((c) => { map[c.id] = c; });
    });
    return map;
  }, [template]);

  // Final weighted total (with bonus/penalty applied)
  const finalWeightedTotal = useMemo(
    () => computeWeightedScoreMulti(blocks, "final_score", { applyBonusPenalty: true }),
    [blocks]
  );

  // Base weighted total (without bonus/penalty) to isolate the adjustment impact
  const baseWeightedTotal = useMemo(
    () => computeWeightedScoreMulti(blocks, "final_score", { applyBonusPenalty: false }),
    [blocks]
  );

  // Total max achievable weighted score (every criterion at its max)
  const totalMaxScore = useMemo(() => {
    const getValue = (crit) => {
      const r = getCriterionRange(templateCriteria[crit.id]);
      return r?.max ?? null;
    };
    return computeWeightedScoreMulti(blocks, "final_score", { getValue });
  }, [blocks, templateCriteria]);

  // Bonus/penalty raw total + count of active adjustments
  const bpTotal = useMemo(() => computeBonusPenaltyTotal(blocks), [blocks]);
  const bpCount = useMemo(() => {
    let n = 0;
    blocks.forEach((b) => (b.criteria || []).forEach((c) => {
      if (c.bonus_penalty_active && c.bonus_penalty_value) n++;
    }));
    return n;
  }, [blocks]);

  // Weighted impact of bonus/penalty on the final score
  const bpImpact = (finalWeightedTotal != null && baseWeightedTotal != null)
    ? finalWeightedTotal - baseWeightedTotal
    : null;

  const passFail = score?.overall_pass_fail;
  const rating = score?.overall_rating;
  const hasBp = bpCount > 0;

  return (
    <div className="space-y-3">
      {/* Final weighted total + pass/fail */}
      <div className={`rounded-lg border p-4 ${accent}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1">Final Weighted Total Score</div>
            <div className="text-4xl font-bold tabular-nums leading-none">{fmt(finalWeightedTotal)}</div>
            {totalMaxScore != null && (
              <div className="text-xs text-gray-400 mt-1">of {fmt(totalMaxScore)} max achievable</div>
            )}
          </div>
          <div className="text-right shrink-0">
            {passFail === "Pass" ? (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-bold">PASS</span>
              </div>
            ) : passFail === "Fail" ? (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-100 text-red-700 border border-red-300">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-bold">FAIL</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 border border-gray-300">
                <span className="text-sm font-medium">No Pass/Fail</span>
              </div>
            )}
            {rating && (
              <Badge className="mt-1.5 text-xs bg-indigo-100 text-indigo-700">{rating}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid: total max score + bonus/penalty impact */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
            <Target className="w-3.5 h-3.5 text-indigo-500" />
            Total Max Score
          </div>
          <div className="text-2xl font-bold tabular-nums text-indigo-600">{fmt(totalMaxScore)}</div>
          <div className="text-[10px] text-gray-400">max achievable</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
            {bpTotal > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            Bonus/Penalty Impact
          </div>
          <div
            className="text-2xl font-bold tabular-nums"
            style={{ color: bpTotal > 0 ? "#059669" : bpTotal < 0 ? "#dc2626" : "#6b7280" }}
          >
            {hasBp ? `${bpTotal > 0 ? "+" : ""}${bpTotal.toFixed(2)}` : "—"}
          </div>
          <div className="text-[10px] text-gray-400">
            {hasBp
              ? `${bpCount} adjustment${bpCount > 1 ? "s" : ""} · weighted ${bpImpact != null ? `${bpImpact > 0 ? "+" : ""}${bpImpact.toFixed(2)}` : "—"}`
              : "no adjustments"}
          </div>
        </div>
      </div>
    </div>
  );
}