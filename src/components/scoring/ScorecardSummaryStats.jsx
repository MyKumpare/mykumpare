import React, { useMemo, useState } from "react";
import { computeWeightedScoreMulti, effectiveFinalScore } from "@/components/templates/scoringWeightLogic";
import {
  computeTotalScore,
  computeTotalMaxScore,
  computeBonusPenaltyTotal,
  getCriterionRange,
} from "@/components/templates/testmode/testModeUtils";
import { computeOverallRating } from "@/components/templates/scoringRatingLogic";
import { Award, ChevronRight, ChevronDown } from "lucide-react";

const num = (v) => (v == null || isNaN(v) ? 1 : Number(v));
const fmt = (n, d = 2) => (n == null || isNaN(n) ? "—" : Number(n).toFixed(d));

/**
 * Side-by-side scorecard summary matching the production scorecard footer:
 * 4-row stats table (Total Score, Weighted Average, Score/Max %, Total Max)
 * plus an Overall Rating bar (Pass/Fail + rating label).
 *
 * Also renders a drill-down breakdown table showing each section's total
 * score × weight × multiplier, expandable to individual criteria with their
 * own multiplier factors, ending with a total weighted average row.
 */
export default function ScorecardSummaryStats({ score, template, accent }) {
  const blocks = score?.scoring_blocks || [];
  const unit = template?.rating_config?.unit || score?.rating_config?.unit || "none";

  const templateCriteria = useMemo(() => {
    const map = {};
    (template?.scoring_blocks || []).forEach((b) => {
      (b.criteria || []).forEach((c) => { map[c.id] = c; });
    });
    return map;
  }, [template]);

  // --- Summary stats (matching the production scorecard footer) ---

  // Total raw score (sum of all criterion final scores + bonus/penalty)
  const totalScore = useMemo(
    () => computeTotalScore(blocks, "final_score", null, effectiveFinalScore),
    [blocks]
  );

  // Total max achievable (raw sum of all criterion max scores)
  const totalMaxScore = useMemo(
    () => computeTotalMaxScore(blocks, templateCriteria),
    [blocks, templateCriteria]
  );

  // Weighted average score (normalized to 1-5 scale, with block/crit multipliers)
  const weightedAvg = useMemo(
    () => computeWeightedScoreMulti(blocks, "final_score", { applyBonusPenalty: true }),
    [blocks]
  );

  // Bonus/penalty raw total
  const bpTotal = useMemo(() => computeBonusPenaltyTotal(blocks), [blocks]);

  // Score / Max percentage
  const scorePct = (totalScore != null && totalMaxScore > 0)
    ? (totalScore / totalMaxScore) * 100
    : null;

  // Overall rating from rating_config
  const ratingConfig = template?.rating_config || score?.rating_config || null;
  const overall = useMemo(() => {
    if (!ratingConfig) return { passFail: score?.overall_pass_fail || "", ratingLabel: score?.overall_rating || "", hasConfig: false };
    const r = computeOverallRating(weightedAvg, ratingConfig);
    return { passFail: r.passFail || score?.overall_pass_fail || "", ratingLabel: r.ratingLabel || score?.overall_rating || "", ratingColor: r.ratingColor || "", hasConfig: !!(ratingConfig.pass_fail_enabled || ratingConfig.rating_enabled) };
  }, [ratingConfig, weightedAvg, score]);

  // --- Breakdown table computations ---

  const breakdown = useMemo(() => {
    const totalEffWeight = blocks.reduce(
      (s, b) => s + (b.weight || 0) * num(b.multiplier), 0
    );

    return blocks.map((block) => {
      const blockEff = (block.weight || 0) * num(block.multiplier);
      const blockWeightPct = totalEffWeight > 0 ? (blockEff / totalEffWeight) * 100 : 0;

      const crits = (block.criteria || []).map((crit) => {
        const rawScore = effectiveFinalScore(crit);
        const bpVal = (crit.bonus_penalty_active && crit.bonus_penalty_value) ? crit.bonus_penalty_value : 0;
        const scoreWithBp = rawScore != null ? rawScore + bpVal : null;
        const critMult = num(crit.multiplier);
        const range = getCriterionRange(templateCriteria[crit.id]);
        const maxScore = range?.max ?? null;
        return { crit, rawScore, bpVal, scoreWithBp, critMult, maxScore };
      });

      const sumCritMult = crits.reduce((s, c) => s + c.critMult, 0) || 1;

      // Block average = sum(score × mult) / sum(mult) for scored criteria
      let blockNum = 0, blockDen = 0;
      crits.forEach((c) => {
        if (c.scoreWithBp != null) { blockNum += c.scoreWithBp * c.critMult; blockDen += c.critMult; }
      });
      const blockAvg = blockDen > 0 ? blockNum / blockDen : null;

      // Block raw total (sum of criterion scores)
      const blockRawTotal = crits.reduce((s, c) => s + (c.scoreWithBp ?? 0), 0);
      const blockMaxTotal = crits.reduce((s, c) => s + (c.maxScore ?? 0), 0);

      // Block contribution to overall weighted average
      const blockContribution = (blockAvg != null && totalEffWeight > 0)
        ? blockAvg * (blockEff / totalEffWeight)
        : null;

      // Per-criterion contributions
      const critRows = crits.map((c) => {
        const weightInBlock = c.critMult / sumCritMult;
        const contribToBlock = c.scoreWithBp != null ? c.scoreWithBp * weightInBlock : null;
        const contribToTotal = (c.scoreWithBp != null && totalEffWeight > 0)
          ? c.scoreWithBp * weightInBlock * (blockEff / totalEffWeight)
          : null;
        return { ...c, weightInBlock, contribToBlock, contribToTotal };
      });

      return {
        block, blockEff, blockWeightPct, blockAvg, blockRawTotal, blockMaxTotal,
        blockContribution, critRows,
      };
    });
  }, [blocks, templateCriteria]);

  const totalWeightedAvg = weightedAvg;

  if (!blocks.length) {
    return (
      <div className={`rounded-lg border p-4 ${accent || "bg-gray-50 border-gray-200"} text-center text-sm text-gray-400`}>
        No scoring data available.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats table — matches production scorecard footer */}
      <div className={`rounded-lg border overflow-hidden ${accent || "bg-white border-gray-200"}`}>
        <table className="w-full text-sm">
          <tbody>
            {/* Row 1: Total Score (incl. bonus/penalty) */}
            <tr className="border-b border-gray-200">
              <td className="px-4 py-2.5 font-medium text-gray-700">
                Total Score (incl. bonus/penalty)
                {bpTotal !== 0 && (
                  <span className={`ml-1.5 text-xs font-semibold ${bpTotal > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    ({bpTotal > 0 ? "+" : ""}{fmt(bpTotal)})
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900">
                {fmt(totalScore)}
              </td>
            </tr>
            {/* Row 2: Weighted Average Score */}
            <tr className="border-b border-gray-200">
              <td className="px-4 py-2.5 font-medium text-gray-700">Weighted Average Score</td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900">
                {fmt(weightedAvg)}
              </td>
            </tr>
            {/* Row 3: Total Score / Total Max Score */}
            <tr className="border-b border-gray-200">
              <td className="px-4 py-2.5 font-medium text-gray-700">Total Score / Total Max Score</td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-900">
                {scorePct != null ? `${fmt(scorePct, 1)}%` : "—"}
              </td>
            </tr>
            {/* Row 4: Total Max Score (purple) */}
            <tr>
              <td className="px-4 py-2.5 font-medium text-gray-700">Total Max Score</td>
              <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color: "#6B46C1" }}>
                {fmt(totalMaxScore)}
                <span className="ml-1 text-xs font-normal text-gray-400">(max achievable)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Overall Rating bar */}
      {overall.hasConfig && (overall.passFail || overall.ratingLabel) && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Award className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-gray-700">Overall Rating</span>
            <span className="text-xs text-gray-400">— rating logic applied to the total score</span>
          </div>
          <div className="flex items-center gap-2">
            {ratingConfig?.pass_fail_enabled && (
              <div className="flex gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium ${
                  overall.passFail === "Pass"
                    ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                    : "bg-white border-gray-200 text-gray-500"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${overall.passFail === "Pass" ? "bg-emerald-500" : "bg-gray-300"}`} />
                  Pass {ratingConfig.pass_threshold != null ? `≥ ${fmt(ratingConfig.pass_threshold, 0)}%` : ""}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium ${
                  overall.passFail === "Fail"
                    ? "bg-red-50 border-red-400 text-red-700"
                    : "bg-white border-gray-200 text-gray-500"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${overall.passFail === "Fail" ? "bg-red-500" : "bg-gray-300"}`} />
                  Fail {ratingConfig.pass_threshold != null ? `< ${fmt(ratingConfig.pass_threshold, 0)}%` : ""}
                </div>
              </div>
            )}
            {overall.ratingLabel && (
              <span
                className="px-2.5 py-1 rounded-md text-sm font-bold text-white"
                style={{ background: overall.ratingColor || "#6366f1" }}
              >
                {overall.ratingLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Drill-down breakdown table */}
      <ScorecardBreakdownTable breakdown={breakdown} totalWeightedAvg={totalWeightedAvg} unit={unit} />
    </div>
  );
}

/**
 * Collapsible breakdown table: sections → criteria with weights and multipliers.
 */
function ScorecardBreakdownTable({ breakdown, totalWeightedAvg, unit }) {
  const [expanded, setExpanded] = useState(new Set());

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fmtU = (n, d = 2) => {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n).toFixed(d);
    if (unit === "%") return `${v}%`;
    if (unit === "pts") return `${v} pts`;
    if (unit === "x") return `${v}x`;
    if (unit === "$") return `$${v}`;
    if (unit === "bps") return `${v} bps`;
    return v;
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
        <div className="col-span-5">Section / Criterion</div>
        <div className="col-span-2 text-right">Score</div>
        <div className="col-span-2 text-right">Weight</div>
        <div className="col-span-1 text-right">Mult</div>
        <div className="col-span-2 text-right">Weighted Avg</div>
      </div>

      {/* Section rows */}
      {breakdown.map((row) => {
        const isOpen = expanded.has(row.block.id);
        const hasMult = num(row.block.multiplier) !== 1;
        return (
          <div key={row.block.id} className="border-b border-gray-100 last:border-b-0">
            {/* Section header row */}
            <button
              type="button"
              onClick={() => toggle(row.block.id)}
              className="w-full grid grid-cols-12 gap-1 px-3 py-2 text-left hover:bg-indigo-50/40 transition-colors items-center"
            >
              <div className="col-span-5 flex items-center gap-1.5">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                <span className="text-sm font-semibold text-gray-800 truncate">{row.block.name}</span>
              </div>
              <div className="col-span-2 text-right text-sm font-semibold tabular-nums text-gray-700">
                {fmtU(row.blockAvg)}
                <span className="text-[10px] text-gray-400 ml-0.5">avg</span>
              </div>
              <div className="col-span-2 text-right text-xs tabular-nums text-gray-600">
                {fmt(row.blockWeightPct, 1)}%
              </div>
              <div className="col-span-1 text-right text-xs tabular-nums text-gray-600">
                {hasMult ? `${fmt(num(row.block.multiplier), 2)}x` : "—"}
              </div>
              <div className="col-span-2 text-right text-sm font-bold tabular-nums text-indigo-600">
                {fmtU(row.blockContribution)}
              </div>
            </button>

            {/* Criterion rows (drill-down) */}
            {isOpen && (
              <div className="bg-gray-50/50">
                {row.critRows.map((c) => {
                  const critHasMult = c.critMult !== 1;
                  const hasBp = c.bpVal !== 0;
                  return (
                    <div
                      key={c.crit.id}
                      className="grid grid-cols-12 gap-1 px-3 py-1.5 items-center border-t border-gray-100"
                    >
                      <div className="col-span-5 pl-6 text-xs text-gray-600 truncate">
                        {c.crit.number ? `#${c.crit.number} ` : ""}{c.crit.name}
                      </div>
                      <div className="col-span-2 text-right text-xs tabular-nums text-gray-700">
                        {fmtU(c.scoreWithBp)}
                        {hasBp && (
                          <span className={`ml-1 text-[10px] font-semibold ${c.bpVal > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            ({c.bpVal > 0 ? "+" : ""}{fmt(c.bpVal)})
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-right text-[10px] tabular-nums text-gray-400">
                        {fmt(c.weightInBlock * 100, 1)}%
                      </div>
                      <div className="col-span-1 text-right text-xs tabular-nums text-gray-600">
                        {critHasMult ? `${fmt(c.critMult, 2)}x` : "—"}
                      </div>
                      <div className="col-span-2 text-right text-xs font-semibold tabular-nums text-gray-700">
                        {fmtU(c.contribToTotal)}
                      </div>
                    </div>
                  );
                })}
                {/* Section subtotal */}
                <div className="grid grid-cols-12 gap-1 px-3 py-1.5 items-center border-t border-gray-200 bg-white">
                  <div className="col-span-10 pl-6 text-[10px] font-semibold text-gray-500 uppercase">
                    {row.block.name} subtotal
                  </div>
                  <div className="col-span-2 text-right text-xs font-bold tabular-nums text-indigo-600">
                    {fmtU(row.blockContribution)}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Total weighted average row */}
      <div className="grid grid-cols-12 gap-1 px-3 py-3 bg-indigo-50 border-t-2 border-indigo-200 items-center">
        <div className="col-span-10 text-sm font-bold text-indigo-900">
          Total Weighted Average Score
        </div>
        <div className="col-span-2 text-right text-lg font-bold tabular-nums text-indigo-700">
          {fmtU(totalWeightedAvg)}
        </div>
      </div>
    </div>
  );
}