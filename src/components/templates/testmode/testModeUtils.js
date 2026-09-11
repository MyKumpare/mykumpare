/**
 * Shared utilities for the Scoring Matrix Test Mode dialog.
 *
 * Mirrors the helpers used by the real ScoringMatrixScoreCard so the test
 * sandbox exercises the same scoring logic (multipliers, bonus/penalty,
 * effective scores, rating config) without persisting anything.
 */
import { computeOverallRating } from "@/components/templates/scoringRatingLogic";

/** Format a score value with the assessment's unit of measurement. */
export function formatScoreValue(value, unit) {
  if (value == null || isNaN(value)) return "—";
  const u = unit || "none";
  const v = Number.isFinite(value) ? value : value;
  if (u === "%") return `${v}%`;
  if (u === "pts") return `${v} pts`;
  if (u === "x") return `${v}x`;
  if (u === "$") return `$${v}`;
  if (u === "bps") return `${v} bps`;
  return `${v}`;
}

/**
 * Compute the total score range for a single criterion (includes bonus/penalty).
 * - single mode: uses single_score_min / single_score_max
 * - levels mode: uses the min/max descriptor levels (defaults to 1-5)
 * Folds in the bonus/penalty range so this reflects the total possible score.
 */
export function getCriterionRange(templateCrit) {
  if (!templateCrit) return null;
  let min, max;
  if (templateCrit.scoring_mode === "single") {
    min = Number.isFinite(templateCrit.single_score_min) ? templateCrit.single_score_min : 0;
    max = Number.isFinite(templateCrit.single_score_max) ? templateCrit.single_score_max : 100;
  } else {
    const descs = templateCrit.descriptors;
    if (Array.isArray(descs) && descs.length > 0) {
      const levels = descs.map((d) => d.level).filter((n) => Number.isFinite(n));
      if (levels.length > 0) { min = Math.min(...levels); max = Math.max(...levels); }
      else { min = 1; max = 5; }
    } else { min = 1; max = 5; }
  }
  if (templateCrit.bonus_penalty_enabled && templateCrit.bonus_penalty_range) {
    const bpMin = Number.isFinite(templateCrit.bonus_penalty_range.min) ? templateCrit.bonus_penalty_range.min : 0;
    const bpMax = Number.isFinite(templateCrit.bonus_penalty_range.max) ? templateCrit.bonus_penalty_range.max : 0;
    if (bpMin < 0) min += bpMin;
    if (bpMax > 0) max += bpMax;
  }
  return { min, max };
}

/** Total score range for a section = sum of its criteria's total ranges. */
export function getBlockRange(block, templateCriteria) {
  const ranges = (block.criteria || [])
    .map((c) => getCriterionRange(templateCriteria?.[c.id]))
    .filter(Boolean);
  if (ranges.length === 0) return null;
  return {
    min: ranges.reduce((s, r) => s + r.min, 0),
    max: ranges.reduce((s, r) => s + r.max, 0)
  };
}

/**
 * Build a mock score record from a template, capturing EVERY field the real
 * scorecard uses: block/criterion multipliers, scoring modes, bonus/penalty
 * config, descriptors, and the template's rating_config.
 */
export function buildMockScore(template) {
  const blocks = (template?.scoring_blocks || []).map((b) => ({
    id: b.id,
    name: b.name,
    weight: b.weight || 0,
    multiplier_enabled: b.multiplier_enabled || false,
    multiplier: b.multiplier_enabled ? (b.multiplier || 1) : 1,
    criteria: (b.criteria || []).map((c) => ({
      id: c.id,
      number: c.number,
      name: c.name,
      category: c.category || "",
      descriptors: c.descriptors || [],
      scoring_mode: c.scoring_mode || "levels",
      single_score_min: c.single_score_min,
      single_score_max: c.single_score_max,
      multiplier_enabled: c.multiplier_enabled || false,
      multiplier: c.multiplier_enabled ? (c.multiplier || 1) : 1,
      bonus_penalty_enabled: c.bonus_penalty_enabled || false,
      bonus_penalty_direction: c.bonus_penalty_direction || "penalty",
      bonus_penalty_range: c.bonus_penalty_range || null,
      bonus_penalty_step: c.bonus_penalty_step,
      bonus_penalty_levels: c.bonus_penalty_levels || [],
      bonus_penalty_guidance: c.bonus_penalty_guidance || "",
      // Runtime scoring state
      bonus_penalty_active: false,
      bonus_penalty_value: null,
      primary_score: null,
      primary_notes: "",
      team_score: null,
      team_notes: "",
      team_status: "pending",
      adjusted_primary_score: null,
      adjusted_primary_notes: "",
      ic_score: null,
      ic_notes: "",
      ic_status: "pending",
      final_score: null,
      final_notes: ""
    }))
  }));
  return {
    template_name: template?.name || "Test Template",
    firm_name: "Test Firm (Sample)",
    product_name: "Test Product (Sample)",
    status: "primary_scoring",
    primary_score_finalized: false,
    team_review_status: "not_started",
    adjusted_primary_finalized: false,
    ic_review_status: "not_started",
    final_score_finalized: false,
    is_closed: false,
    scoring_blocks: blocks,
    attachments: [],
    rating_config: template?.rating_config || null
  };
}

/**
 * Custom getValue for computeWeightedScoreMulti that reads a given score field
 * AND adds the active bonus/penalty adjustment — so every phase's weighted
 * total reflects score + bonus/penalty, not just the final phase.
 */
function makeBonusPenaltyGetValue(scoreField) {
  return (crit) => {
    let s = crit[scoreField];
    if (s == null) return null;
    if (crit.bonus_penalty_active && crit.bonus_penalty_value) {
      s = s + crit.bonus_penalty_value;
    }
    return s;
  };
}

/**
 * Weighted total for a given phase, using the real computeWeightedScoreMulti
 * (honors block/criterion multipliers, normalized to 100%) and applying the
 * bonus/penalty adjustment to every phase — not just final.
 */
export function computeTestTotals(blocks, scoreField, computeWeightedScoreMulti, effectiveAdjustedPrimary, effectiveFinalScore) {
  let getValue;
  if (scoreField === "adjusted_primary_score") {
    getValue = (crit) => {
      const s = effectiveAdjustedPrimary(crit);
      if (s == null) return null;
      return crit.bonus_penalty_active && crit.bonus_penalty_value ? s + crit.bonus_penalty_value : s;
    };
  } else if (scoreField === "final_score") {
    getValue = (crit) => {
      const s = effectiveFinalScore(crit);
      if (s == null) return null;
      return crit.bonus_penalty_active && crit.bonus_penalty_value ? s + crit.bonus_penalty_value : s;
    };
  } else {
    getValue = makeBonusPenaltyGetValue(scoreField);
  }
  const val = computeWeightedScoreMulti(blocks, scoreField, { mode: "perCriterion", getValue });
  return val != null ? val.toFixed(2) : "—";
}

/**
 * Total (raw sum) of all criterion scores for a given phase, including
 * active bonus/penalty adjustments. Unlike computeTestTotals (weighted
 * average), this is a simple sum — not normalized by weights.
 */
export function computeTotalScore(blocks, scoreField, effectiveAdjustedPrimary, effectiveFinalScore) {
  let getValue;
  if (scoreField === "adjusted_primary_score") {
    getValue = (crit) => {
      const s = effectiveAdjustedPrimary(crit);
      if (s == null) return null;
      return crit.bonus_penalty_active && crit.bonus_penalty_value ? s + crit.bonus_penalty_value : s;
    };
  } else if (scoreField === "final_score") {
    getValue = (crit) => {
      const s = effectiveFinalScore(crit);
      if (s == null) return null;
      return crit.bonus_penalty_active && crit.bonus_penalty_value ? s + crit.bonus_penalty_value : s;
    };
  } else {
    getValue = (crit) => {
      let s = crit[scoreField];
      if (s == null) return null;
      if (crit.bonus_penalty_active && crit.bonus_penalty_value) {
        s = s + crit.bonus_penalty_value;
      }
      return s;
    };
  }
  let total = 0;
  let hasAny = false;
  (blocks || []).forEach((block) => {
    (block.criteria || []).forEach((crit) => {
      const v = getValue(crit);
      if (v != null && Number.isFinite(v)) { total += Number(v); hasAny = true; }
    });
  });
  return hasAny ? total : null;
}

/** Sum of all criterion max score ranges across every block — the total max achievable score. */
export function computeTotalMaxScore(blocks, templateCriteria) {
  let total = 0;
  (blocks || []).forEach((block) => {
    (block.criteria || []).forEach((crit) => {
      const r = getCriterionRange(templateCriteria?.[crit.id]);
      if (r && Number.isFinite(r.max)) total += r.max;
    });
  });
  return total;
}

/** Sum of all active bonus/penalty adjustments across every criterion. */
export function computeBonusPenaltyTotal(blocks) {
  let sum = 0;
  (blocks || []).forEach((block) => {
    (block.criteria || []).forEach((crit) => {
      if (crit.bonus_penalty_active && crit.bonus_penalty_value != null) {
        sum += crit.bonus_penalty_value || 0;
      }
    });
  });
  return sum;
}

/** Count criteria still missing a score for a given phase field. */
export function unscoredCount(blocks, scoreField) {
  let count = 0;
  (blocks || []).forEach((block) => {
    (block.criteria || []).forEach((crit) => {
      if (crit[scoreField] == null) count++;
    });
  });
  return count;
}

/** Overall rating (pass/fail + rating label) from the template's rating_config. */
export function getOverallRating(blocks, ratingConfig, computeWeightedScoreMulti, effectiveFinalScore) {
  if (!ratingConfig) return { passFail: "", ratingLabel: "", ratingColor: "", hasConfig: false, weightedScore: null };
  const getValue = (crit) => {
    const s = effectiveFinalScore(crit);
    if (s == null) return null;
    return crit.bonus_penalty_active && crit.bonus_penalty_value ? s + crit.bonus_penalty_value : s;
  };
  const weightedScore = computeWeightedScoreMulti(blocks, "final_score", { mode: "perCriterion", getValue });
  const rating = computeOverallRating(weightedScore, ratingConfig);
  return { ...rating, hasConfig: !!(ratingConfig.pass_fail_enabled || ratingConfig.rating_enabled), weightedScore };
}