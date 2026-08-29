/**
 * Shared helpers for building Due Diligence audit trail entries.
 * Used by the DD flow and the bulk-approve action to log workflow events.
 */

export type AuditActionType =
  | "process_created"
  | "stage_started"
  | "sub_stage_completed"
  | "sub_stage_started"
  | "stage_approved"
  | "stage_rejected"
  | "stage_on_hold"
  | "stage_advanced"
  | "signature_collected"
  | "signature_revoked"
  | "bulk_approved";

export interface AuditEntry {
  id: string;
  timestamp: string;
  action_type: AuditActionType;
  stage_id?: string;
  stage_name?: string;
  sub_stage_id?: string;
  sub_stage_name?: string;
  actor_id?: string;
  actor_name?: string;
  details?: string;
}

let _counter = 0;
function auditId(): string {
  _counter = (_counter + 1) % 100000;
  return `audit_${Date.now()}_${_counter}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds a new audit trail entry.
 */
export function buildAuditEntry(
  actionType: AuditActionType,
  options: {
    stageId?: string;
    stageName?: string;
    subStageId?: string;
    subStageName?: string;
    actorId?: string;
    actorName?: string;
    details?: string;
  } = {}
): AuditEntry {
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
export function appendAuditEntry(
  existingTrail: AuditEntry[] = [],
  actionType: AuditActionType,
  options: {
    stageId?: string;
    stageName?: string;
    subStageId?: string;
    subStageName?: string;
    actorId?: string;
    actorName?: string;
    details?: string;
  } = {}
): AuditEntry[] {
  return [...(existingTrail || []), buildAuditEntry(actionType, options)];
}