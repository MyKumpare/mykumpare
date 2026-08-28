/**
 * Shared weighted-score computation that honors optional multiplier factors
 * on blocks (sections) and criteria (sub-sections).
 *
 * Multiplier model:
 *  - block.multiplier (default 1) scales the block's base weight.
 *  - crit.multiplier  (default 1) weights the criterion within its block.
 *
 * The result is normalized by the sum of effective weights, so the overall
 * score stays on the 1-5 scale regardless of the multipliers chosen — i.e.
 * the effective weights always "adjust to 100% total".
 *
 * Backward compatible: records without multiplier fields behave exactly like
 * the original formulas (multipliers default to 1).
 */

const num = (v) => (v == null || isNaN(v) ? 1 : Number(v));

/**
 * Effective adjusted primary score for a criterion.
 *
 * - If the primary analyst accepted the team's recommendation → team_score.
 * - Otherwise (rejected, or not yet reviewed) → fall back to the primary
 *   analyst's own score. i.e. "no accepted team rec adjustment" keeps the
 *   primary recommendation.
 */
export function effectiveAdjustedPrimary(crit) {
  if (!crit) return null;
  if (crit.team_status === "accepted") return crit.team_score ?? crit.primary_score;
  return crit.adjusted_primary_score != null ? crit.adjusted_primary_score : crit.primary_score;
}

/**
 * Effective final score for a criterion.
 *
 * - If the primary analyst accepted the IC's recommendation → ic_score.
 * - Otherwise → the effective adjusted primary (which already incorporates
 *   the accepted team rec, or the primary score when no team rec was accepted).
 *
 * So the final column = adjusted primary (with accepted team recs) plus the
 * accepted IC recommendations, falling back to the adjusted primary otherwise.
 */
export function effectiveFinalScore(crit) {
  if (!crit) return null;
  if (crit.ic_status === "accepted") return crit.ic_score ?? effectiveAdjustedPrimary(crit);
  return crit.final_score != null ? crit.final_score : effectiveAdjustedPrimary(crit);
}

/**
 * Effective block weight % for the editor "adjust to 100% total" display.
 * Returns one entry per block with base weight, multiplier, effective weight,
 * and the normalized percentage (all normalized pcts sum to 100).
 */
export function computeEffectiveBlockWeights(blocks) {
  const arr = (blocks || []).map((b) => ({
    id: b.id,
    baseWeight: b.weight || 0,
    multiplier: num(b.multiplier),
    effectiveWeight: (b.weight || 0) * num(b.multiplier),
  }));
  const total = arr.reduce((s, b) => s + b.effectiveWeight, 0);
  return arr.map((b) => ({
    ...b,
    normalizedPct: total > 0 ? (b.effectiveWeight / total) * 100 : 0,
  }));
}

/**
 * Whether any block or criterion has a multiplier active (≠ 1).
 * Used to decide whether to show the effective-weight impact display.
 */
export function hasActiveMultipliers(blocks) {
  return (blocks || []).some(
    (b) => num(b.multiplier) !== 1 || (b.criteria || []).some((c) => num(c.multiplier) !== 1)
  );
}

/**
 * Compute a weighted score for a given criterion field, applying optional
 * bonus/penalty adjustments (final_score only) and multiplier factors.
 *
 * @param {Array} blocks - scoring_blocks array
 * @param {string} field - criterion field to average (e.g. "final_score")
 * @param {object} [opts]
 * @param {boolean} [opts.applyBonusPenalty=false]
 * @param {"perCriterion"|"blockAvg"} [opts.mode="perCriterion"]
 *   - "perCriterion": each scored criterion contributes score × blockEff × critMult
 *     (matches the ScoringMatrixScoreCard UI + threshold logic + scorecard PDF).
 *   - "blockAvg": block average (criterion-multiplier-weighted) × blockEff
 *     (matches snapshot utils + multi-firm comparison PDF).
 * @returns {number|null} weighted average, or null if no criteria are scored
 */
export function computeWeightedScoreMulti(blocks, field, opts = {}) {
  if (!Array.isArray(blocks)) return null;
  const { applyBonusPenalty = false, mode = "perCriterion", getValue } = opts;
  const read = getValue ? (crit) => getValue(crit) : (crit) => crit[field];

  let total = 0;
  let totalWeight = 0;

  blocks.forEach((block) => {
    const crits = block.criteria || [];
    const blockEff = (block.weight || 0) * num(block.multiplier);

    if (mode === "blockAvg") {
      let cws = 0;
      let cwsum = 0;
      crits.forEach((crit) => {
        let s = read(crit);
        if (s == null) return;
        if (applyBonusPenalty && field === "final_score" && crit.bonus_penalty_active && crit.bonus_penalty_value) {
          s = Math.max(1, Math.min(5, s + crit.bonus_penalty_value));
        }
        const cm = num(crit.multiplier);
        cws += s * cm;
        cwsum += cm;
      });
      if (cwsum <= 0) return;
      const blockAvg = cws / cwsum;
      total += blockAvg * blockEff;
      totalWeight += blockEff;
    } else {
      crits.forEach((crit) => {
        let s = read(crit);
        if (s == null) return;
        if (applyBonusPenalty && field === "final_score" && crit.bonus_penalty_active && crit.bonus_penalty_value) {
          s = Math.max(1, Math.min(5, s + crit.bonus_penalty_value));
        }
        const w = blockEff * num(crit.multiplier);
        total += s * w;
        totalWeight += w;
      });
    }
  });

  if (totalWeight <= 0) return null;
  return total / totalWeight;
}