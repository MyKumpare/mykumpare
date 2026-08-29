/**
 * Shared helpers for building Due Diligence audit trail entries.
 * Used by the DD flow and the bulk-approve action to log workflow events.
 * (JS port of base44/shared/ddAuditTrail.ts — moved here to avoid sandbox
 *  403s on base44/shared/*.ts imports during Vite dev server preview.)
 */

let _counter = 0;
function auditId() {
  _counter = (_counter + 1) % 100000;
  return `audit_${Date.now()}_${_counter}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds a new audit trail entry.
 */
export function buildAuditEntry(actionType, options = {}) {
  return {
    id: auditId(),
    timestamp: new Date().toISOString(),
    action_type: actionType,
    stage_id: options.stageId || "",
    stage_name: options.stageName || "",
    sub_stage_id: options.subStageId || "",
    sub_stage_name: options.subStageName || "",
    actor_id: options.actorId || "",
    actor_name: options.actorName || "",
    details: options.details || "",
  };
}

/**
 * Appends a new audit entry to an existing audit trail array.
 * Returns a new array (immutable).
 */
export function appendAuditEntry(existingTrail = [], actionType, options = {}) {
  return [...(existingTrail || []), buildAuditEntry(actionType, options)];
}