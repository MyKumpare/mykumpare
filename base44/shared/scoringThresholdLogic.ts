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
 * @param {object} score - A ScoringMatrixScore record (with scoring_blocks).
 * @returns {number|null} The weighted final score, or null if no criteria are scored.
 */
export function computeWeightedFinal(score) {
  const blocks = score.scoring_blocks || [];
  let total = 0;
  let totalWeight = 0;
  blocks.forEach((block) => {
    const blockWeight = (block.weight || 0) / 100;
    (block.criteria || []).forEach((crit) => {
      let s = crit.final_score;
      if (s != null) {
        if (crit.bonus_penalty_active && crit.bonus_penalty_value) {
          s = Math.max(1, Math.min(5, s + crit.bonus_penalty_value));
        }
        total += s * blockWeight;
        totalWeight += blockWeight;
      }
    });
  });
  return totalWeight > 0 ? total / totalWeight : null;
}