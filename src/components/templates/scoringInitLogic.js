import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

/**
 * Builds a fresh scoring_blocks array from a Scoring Matrix template,
 * initializing all score/notes/status fields to their starting values.
 */
export function buildScoringBlocksFromTemplate(template) {
  return (template.scoring_blocks || []).map((block) => ({
    id: block.id,
    name: block.name,
    weight: block.weight,
    criteria: (block.criteria || []).map((crit) => ({
      id: crit.id,
      number: crit.number,
      name: crit.name,
      category: crit.category,
      primary_score: null,
      primary_notes: "",
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
      final_notes: "",
      bonus_penalty_active: false,
      bonus_penalty_value: 0,
      bonus_penalty_notes: ""
    }))
  }));
}

/**
 * Initiates a scoring matrix evaluation for a single product.
 *
 * Finds an existing non-deleted DueDiligence record for the product, or creates
 * one if none exists. Then creates a ScoringMatrixScore linked to that DD and
 * the provided template, with scoring_blocks copied from the template (all
 * scores blank). Returns the created score record.
 *
 * @param {Object} product  - { id, name, firm_id, firm_name }
 * @param {Object} template - { id, name, scoring_blocks }
 * @param {Object} primaryAnalyst - { id, name }
 * @param {Object} [options]
 * @param {Object} [options.secondaryAnalyst] - { id, name }
 * @param {boolean} [options.secondaryScoringEnabled]
 * @returns {Promise<Object>} the newly created ScoringMatrixScore
 */
export async function initiateScoringForProduct(product, template, primaryAnalyst, options = {}) {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  // 1. Find or create a DueDiligence record for this product
  let ddRecords = await base44.entities.DueDiligence.filter({ product_id: product.id });
  let ddRecord = (ddRecords || []).find((r) => !r.deleted_at);

  if (!ddRecord) {
    ddRecord = await base44.entities.DueDiligence.create({
      firm_id: product.firm_id,
      firm_name: product.firm_name,
      product_id: product.id,
      product_name: product.name,
      status: "Pipeline",
      process_status: "In-Process",
      start_date: todayStr,
      primary_analyst_contact_id: primaryAnalyst?.id || "",
      primary_analyst_name: primaryAnalyst?.name || ""
    });
  }

  // 2. Compute the next version number for this product+template
  const existingScores = await base44.entities.ScoringMatrixScore.filter({
    product_id: product.id,
    template_id: template.id
  });
  const nextVersion = Math.max(0, ...(existingScores || []).map((s) => s.version_number || 1)) + 1;

  // 3. Build scoring blocks from the template
  const scoringBlocks = buildScoringBlocksFromTemplate(template);

  // 4. Create the ScoringMatrixScore
  return base44.entities.ScoringMatrixScore.create({
    due_diligence_id: ddRecord.id,
    product_id: product.id,
    product_name: product.name,
    firm_id: product.firm_id,
    firm_name: product.firm_name,
    template_id: template.id,
    template_name: template.name,
    primary_analyst_contact_id: primaryAnalyst?.id || "",
    primary_analyst_name: primaryAnalyst?.name || "",
    secondary_scoring_enabled: options.secondaryScoringEnabled || false,
    secondary_scoring_status: options.secondaryScoringEnabled ? "pending" : "not_requested",
    secondary_analyst_contact_id: options.secondaryAnalyst?.id || "",
    secondary_analyst_name: options.secondaryAnalyst?.name || "",
    scoring_blocks: scoringBlocks,
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
    prior_score_id: ""
  });
}