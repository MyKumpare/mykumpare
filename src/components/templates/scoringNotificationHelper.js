import { base44 } from "@/api/base44Client";

/**
 * Creates a ScoringNotification record for a scoring matrix event.
 *
 * @param {Object} score - the ScoringMatrixScore record the event relates to
 * @param {string} eventType - one of: scoring_started, score_updated, phase_finalized, scoring_completed, scoring_reopened
 * @param {Object} currentUser - the current logged-in user (from useAuth)
 * @param {Object} [options]
 * @param {string} [options.phase] - which review phase (e.g. "Primary", "Team Review", "IC Review")
 * @param {string} [options.description] - custom description (falls back to a default per event type)
 * @param {string} [options.criterionName] - for score_updated: the criterion that changed
 * @returns {Promise<Object>} the created notification
 */
export async function createScoringNotification(score, eventType, currentUser, options = {}) {
  const triggeredByName = currentUser?.full_name || currentUser?.linked_contact_name || "Unknown";
  const triggeredById = currentUser?.linked_contact_id || currentUser?.id || "";

  const defaultDescriptions = {
    scoring_started: `Scoring initiated for ${score.product_name || "product"} using ${score.template_name || "template"}`,
    score_updated: `Score updated for ${score.product_name || "product"}`,
    phase_finalized: `${options.phase || "Phase"} finalized for ${score.product_name || "product"}`,
    scoring_completed: `Scoring completed and finalized for ${score.product_name || "product"}`,
    scoring_reopened: `Closed scoring reopened for ${score.product_name || "product"}`,
  };

  return base44.entities.ScoringNotification.create({
    tenant_id: score.tenant_id,
    score_id: score.id,
    product_id: score.product_id,
    product_name: score.product_name,
    firm_id: score.firm_id,
    firm_name: score.firm_name,
    template_id: score.template_id,
    template_name: score.template_name,
    due_diligence_id: score.due_diligence_id,
    event_type: eventType,
    phase: options.phase || "",
    event_description: options.description || defaultDescriptions[eventType] || "",
    criterion_name: options.criterionName || "",
    triggered_by_id: triggeredById,
    triggered_by_name: triggeredByName,
    status: "unread"
  });
}