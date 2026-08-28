/**
 * Shared helpers for the Scoring Matrix snapshots feature.
 * Computes block-weighted averages and derives a short phase summary
 * from a ScoringMatrixScore record's finalization flags.
 */
import { computeWeightedScoreMulti } from "@/components/templates/scoringWeightLogic";

/**
 * Compute the block-weighted average for a given score field across
 * the scoring_blocks of a ScoringMatrixScore (or snapshot copy).
 * Honors optional block/criterion multiplier factors (normalized to 100%
 * total); multipliers default to 1 so records without them are unaffected.
 * Uses the blockAvg model (block average × block weight) to preserve the
 * original snapshot weighting behavior.
 * @param {Array} blocks - scoring_blocks array
 * @param {string} field - criterion field to average (e.g. "final_score")
 * @returns {number|null} weighted average rounded to 2 decimals, or null
 */
export function computeWeightedScore(blocks, field) {
  const val = computeWeightedScoreMulti(blocks, field, { mode: "blockAvg" });
  return val == null ? null : Math.round(val * 100) / 100;
}

/**
 * Derive a short human-readable summary of the review phase captured
 * by a snapshot, based on the score's finalization flags.
 */
export function derivePhaseSummary(score) {
  if (!score) return "";
  if (score.final_score_finalized) return "Final scores finalized";
  if (score.ic_review_status === "in_progress") return "IC review in progress";
  if (score.adjusted_primary_finalized) return "Adjusted primary finalized";
  if (score.team_review_status === "in_progress") return "Team review in progress";
  if (score.primary_score_finalized) return "Primary scores finalized";
  if (score.secondary_scoring_enabled) return "Secondary scoring enabled";
  return "Primary scoring in progress";
}

/**
 * Build the snapshot payload from a ScoringMatrixScore record.
 * Deep-clones the scoring_blocks and computes the weighted scores + phase.
 */
export function buildSnapshotPayload(score, { label, description }) {
  const scoringBlocks = JSON.parse(JSON.stringify(score.scoring_blocks || []));
  return {
    score_id: score.id,
    product_id: score.product_id,
    product_name: score.product_name,
    firm_id: score.firm_id,
    firm_name: score.firm_name,
    template_id: score.template_id,
    template_name: score.template_name,
    version_number: score.version_number || 1,
    label,
    description: description || "",
    scoring_blocks: scoringBlocks,
    weighted_final_score: computeWeightedScore(scoringBlocks, "final_score"),
    weighted_primary_score: computeWeightedScore(scoringBlocks, "primary_score"),
    status_at_snapshot: score.status || "draft",
    phase_summary: derivePhaseSummary(score)
  };
}