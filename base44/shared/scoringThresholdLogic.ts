/**
 * Shared scoring-threshold logic used by the checkScoringThresholds backend
 * function. Mirrors the weighted-final computation shown in the
 * ScoringMatrixScoreCard UI (computeTotals("final_score")) so that threshold
 * comparisons are consistent with the score the analyst sees on screen.
 */

/**
 * Computes the weighted final score for a ScoringMatrixScore record.
 * Applies bonus/penalty adjustments to each criterion's final_score (clamped
 * to the 1-5 scale), then produces a weight-weighted average across all
 * scored criteria — matching the UI's computeTotals("final_score") formula.
 *
 * Honors optional block/criterion multiplier factors (normalized to 100%
 * total). Multipliers default to 1, so records without multiplier fields
 * produce exactly the same result as before.
 *
 * @param {object} score - A ScoringMatrixScore record (with scoring_blocks).
 * @returns {number|null} The weighted final score, or null if no criteria are scored.
 */
export function computeWeightedFinal(score) {
  const blocks = score.scoring_blocks || [];
  const num = (v) => (v == null || isNaN(v) ? 1 : Number(v));
  let total = 0;
  let totalWeight = 0;
  blocks.forEach((block) => {
    const blockEff = ((block.weight || 0) * num(block.multiplier)) / 100;
    (block.criteria || []).forEach((crit) => {
      let s = crit.final_score;
      if (s != null) {
        if (crit.bonus_penalty_active && crit.bonus_penalty_value) {
          s = Math.max(1, Math.min(5, s + crit.bonus_penalty_value));
        }
        const w = blockEff * num(crit.multiplier);
        total += s * w;
        totalWeight += w;
      }
    });
  });
  return totalWeight > 0 ? total / totalWeight : null;
}