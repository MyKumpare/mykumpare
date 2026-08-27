import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

/**
 * Creates a new ScoringMatrixScore by re-scoring from a prior (closed) scoring.
 * Deep-copies the prior score's structure (blocks, criteria, notes) as a starting
 * baseline, resets all workflow flags, increments the version number, and links
 * back via prior_score_id. Returns the new score record.
 *
 * @param {Object} priorScore - the closed ScoringMatrixScore to re-score from
 * @param {Array} existingScores - all scores for the same product+template (to compute next version)
 * @returns {Promise<Object>} the newly created ScoringMatrixScore
 */
export async function createRescoreFromPrior(priorScore, existingScores = []) {
  const nextVersion = Math.max(
    ...existingScores.map((s) => s.version_number || 1),
    priorScore?.version_number || 1
  ) + 1;

  const copiedBlocks = (priorScore.scoring_blocks || []).map((block) => ({
    id: block.id,
    name: block.name,
    weight: block.weight,
    criteria: (block.criteria || []).map((crit) => ({
      id: crit.id,
      number: crit.number,
      name: crit.name,
      category: crit.category,
      // Carry over the prior final score + notes as the starting primary score
      primary_score: crit.final_score ?? crit.adjusted_primary_score ?? crit.primary_score ?? null,
      primary_notes: crit.final_notes || crit.adjusted_primary_notes || crit.primary_notes || "",
      // Reset all other columns
      secondary_score: null,
      secondary_notes: "",
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

  const todayStr = format(new Date(), "yyyy-MM-dd");

  return base44.entities.ScoringMatrixScore.create({
    due_diligence_id: priorScore.due_diligence_id,
    product_id: priorScore.product_id,
    product_name: priorScore.product_name,
    firm_id: priorScore.firm_id,
    firm_name: priorScore.firm_name,
    template_id: priorScore.template_id,
    template_name: priorScore.template_name,
    primary_analyst_contact_id: priorScore.primary_analyst_contact_id,
    primary_analyst_name: priorScore.primary_analyst_name,
    secondary_scoring_enabled: false,
    secondary_scoring_status: "not_requested",
    scoring_blocks: copiedBlocks,
    primary_score_finalized: false,
    team_review_status: "not_started",
    adjusted_primary_finalized: false,
    ic_review_status: "not_started",
    final_score_finalized: false,
    status: "primary_scoring",
    scoring_start_date: todayStr,
    scoring_end_date: "",
    is_closed: false,
    version_number: nextVersion,
    prior_score_id: priorScore.id
  });
}