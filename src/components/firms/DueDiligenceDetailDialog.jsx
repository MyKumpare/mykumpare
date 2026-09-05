import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck, Pencil, Flag, FileText, CheckCircle2, Circle, Clock,
  ShieldCheck, ShieldX, ShieldAlert, Lock, Calendar, UserCheck, ListChecks,
  ChevronDown, ChevronRight, FileCheck, PenLine,
} from "lucide-react";
import DdProgressBar, { getDdProgress } from "./DdProgressBar";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { format } from "date-fns";

const STATUS_STYLES = {
  "Pipeline": "bg-blue-50 text-blue-700 border-blue-200",
  "Buy List": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Rejected": "bg-red-50 text-red-700 border-red-200",
};

const PROCESS_STYLES = {
  "Not Started": "bg-gray-100 text-gray-600 border-gray-200",
  "In-process": "bg-amber-50 text-amber-700 border-amber-200",
  "Completed": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SUB_STAGE_STATUS = {
  not_started: { icon: Circle, color: "text-gray-400", label: "Not Started" },
  in_process: { icon: Clock, color: "text-amber-500", label: "In Process" },
  completed: { icon: CheckCircle2, color: "text-emerald-500", label: "Completed" },
};

const SUPERVISOR_STATUS = {
  pending: { icon: Clock, color: "text-amber-500", label: "Pending" },
  approved: { icon: ShieldCheck, color: "text-emerald-500", label: "Approved" },
  rejected: { icon: ShieldX, color: "text-red-500", label: "Rejected" },
  on_hold: { icon: ShieldAlert, color: "text-amber-500", label: "On Hold" },
};

const ACTION_LABELS = {
  process_created: "Process Created",
  stage_started: "Stage Started",
  sub_stage_started: "Sub-Stage Started",
  sub_stage_completed: "Sub-Stage Completed",
  stage_approved: "Stage Approved",
  stage_rejected: "Stage Rejected",
  stage_on_hold: "Stage Put On Hold",
  stage_advanced: "Stage Advanced",
  signature_collected: "Signature Collected",
  signature_revoked: "Signature Revoked",
  bulk_approved: "Bulk Approved",
};

function fmtDate(d) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtDateTime(d) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy 'at' h:mm a"); } catch { return d; }
}

// Read-only rich text preview
function RichTextPreview({ html, className = "" }) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  if (!clean || !clean.replace(/<[^>]*>/g, "").trim()) {
    return <p className="text-xs text-gray-400 italic">No notes</p>;
  }
  return (
    <div
      className={`quill-preview text-xs text-gray-700 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function StageSection({ stage, index, rec, onEdit }) {
  const [expanded, setExpanded] = React.useState(true);
  const subs = stage.sub_stages || [];
  const completedSubs = subs.filter((s) => s.status === "completed").length;
  const supStatus = stage.supervisor_status || "pending";
  const SupIcon = SUPERVISOR_STATUS[supStatus]?.icon || Clock;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className="text-xs font-bold text-gray-500">Stage {index + 1}</span>
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{stage.name}</span>
        {stage.completed && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            Completed
          </span>
        )}
        <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-white ${SUPERVISOR_STATUS[supStatus]?.color || "text-gray-500"} border-gray-200`}>
          <SupIcon className="w-3 h-3" />
          {SUPERVISOR_STATUS[supStatus]?.label || supStatus}
        </span>
        {subs.length > 0 && (
          <span className="text-[10px] text-gray-500 font-medium">{completedSubs}/{subs.length}</span>
        )}
      </button>

      {expanded && (
        <div className="px-3 py-2.5 space-y-3 bg-white">
          {/* Stage dates */}
          <div className="flex items-center gap-4 text-[11px] text-gray-500 flex-wrap">
            {stage.start_date && <span>Started: <strong className="text-gray-700">{fmtDate(stage.start_date)}</strong></span>}
            {stage.end_date && <span>Ended: <strong className="text-gray-700">{fmtDate(stage.end_date)}</strong></span>}
            {stage.completed_date && <span>Completed: <strong className="text-gray-700">{fmtDate(stage.completed_date)}</strong></span>}
            {stage.supervisor_name && <span>Supervisor: <strong className="text-gray-700">{stage.supervisor_name}</strong></span>}
          </div>

          {/* Rejection feedback */}
          {stage.rejection_feedback && supStatus === "rejected" && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
              <strong>Rejection Feedback:</strong> {stage.rejection_feedback}
            </div>
          )}

          {/* Stage notes */}
          {stage.notes && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Stage Notes</p>
              <RichTextPreview html={stage.notes} />
            </div>
          )}

          {/* Sub-stages */}
          {subs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Sub-Stages</p>
              {subs.map((sub) => {
                const StatusIcon = SUB_STAGE_STATUS[sub.status || "not_started"]?.icon || Circle;
                const statusColor = SUB_STAGE_STATUS[sub.status || "not_started"]?.color || "text-gray-400";
                return (
                  <div
                    key={sub.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onEdit?.(rec)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit?.(rec); } }}
                    className="border border-gray-100 rounded-md px-2.5 py-2 bg-gray-50/50 hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-3.5 h-3.5 ${statusColor} flex-shrink-0`} />
                      <span className="text-sm font-medium text-gray-800 flex-1">{sub.name}</span>
                      <span className={`text-[10px] font-semibold ${statusColor}`}>
                        {SUB_STAGE_STATUS[sub.status || "not_started"]?.label || "Not Started"}
                      </span>
                      <Pencil className="w-3 h-3 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 flex-wrap">
                      {sub.start_date && <span>Start: {fmtDate(sub.start_date)}</span>}
                      {sub.end_date && <span>End: {fmtDate(sub.end_date)}</span>}
                      {sub.performed_by_name && <span>By: <strong className="text-gray-700">{sub.performed_by_name}</strong></span>}
                    </div>
                    {/* Assignments */}
                    {(sub.assignments || []).length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {sub.assignments.map((a) => (
                          <div key={a.id} className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <UserCheck className="w-3 h-3 text-gray-400" />
                            <span>{a.contact_name || "—"}</span>
                            {a.due_date && <span className="text-gray-400">· due {fmtDate(a.due_date)}</span>}
                            <span className={`text-[9px] font-semibold px-1 rounded ${
                              a.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                              a.status === "in_process" ? "bg-amber-50 text-amber-600" :
                              "bg-gray-100 text-gray-500"
                            }`}>{a.status === "in_process" ? "In Process" : (a.status || "not_started").replace("_", " ")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Attachments */}
                    {(sub.attachments || []).length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {sub.attachments.map((att) => (
                          <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1">
                            <FileText className="w-3 h-3" /> {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                    {/* Sub-stage notes */}
                    {sub.notes && (
                      <div className="mt-1.5 pl-4 border-l-2 border-gray-200">
                        <RichTextPreview html={sub.notes} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Stage comments */}
          {(stage.comments || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Comments</p>
              {stage.comments.map((c) => (
                <div key={c.id} className="text-xs border-l-2 border-indigo-200 pl-2">
                  <span className="font-medium text-gray-700">{c.author_name || "User"}</span>
                  <span className="text-gray-400 ml-1.5 text-[10px]">{fmtDateTime(c.timestamp)}</span>
                  <p className="text-gray-600 mt-0.5">{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Read-only detail dialog showing the entire DueDiligence record.
 * Fetches the full record by ID and displays all stages, sub-stages,
 * documentation checklist, approvals, signatures, milestones, and audit trail.
 */
export default function DueDiligenceDetailDialog({ open, onOpenChange, record, onEdit }) {
  const { data: fullRecord, isLoading } = useQuery({
    queryKey: ["due-diligence", record?.id],
    queryFn: () => base44.entities.DueDiligence.get(record.id),
    enabled: !!record?.id && open,
  });

  const rec = fullRecord || record;
  const stages = rec?.stages || [];
  const docChecklist = rec?.documentation_checklist || [];
  const milestones = rec?.milestones || [];
  const signatures = rec?.digital_signatures || [];
  const auditTrail = rec?.audit_trail || [];
  const progress = useMemo(() => getDdProgress(rec), [rec]);

  if (!rec) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Due Diligence Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading record...</div>
        ) : (
          <div className="space-y-4 py-1">
            {/* Header info */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <ClipboardCheck className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold text-gray-800">{rec.product_name || "—"}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_STYLES[rec.status] || STATUS_STYLES["Pipeline"]}`}>
                  {rec.status}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PROCESS_STYLES[rec.process_status] || PROCESS_STYLES["Not Started"]}`}>
                  {rec.process_status || "Not Started"}
                </span>
              </div>
              <div className="text-xs text-gray-600 flex items-center gap-x-4 gap-y-1 flex-wrap">
                <span>Firm: <strong className="text-gray-800">{rec.firm_name || "—"}</strong></span>
                {rec.template_name && <span>Template: <strong className="text-gray-800">{rec.template_name}</strong></span>}
                {rec.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {fmtDate(rec.start_date)}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 flex items-center gap-x-4 gap-y-1 flex-wrap">
                <span>Primary: <strong className="text-gray-800">{rec.primary_analyst_name || "—"}</strong></span>
                {rec.secondary_analyst_name && (
                  <span>Secondary: <strong className="text-gray-800">{rec.secondary_analyst_name}</strong></span>
                )}
              </div>
              {/* Progress bar */}
              {progress.total > 0 && (
                <div className="pt-1">
                  <DdProgressBar rec={rec} />
                </div>
              )}
            </div>

            {/* Stages */}
            {stages.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-indigo-500" /> Stages
                </h3>
                {stages.map((stage, i) => (
                  <StageSection key={stage.id || i} stage={stage} index={i} rec={rec} onEdit={onEdit} />
                ))}
              </div>
            )}

            {/* Documentation Checklist */}
            {docChecklist.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-500" /> Documentation Checklist
                </h3>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {docChecklist.map((item) => (
                    <div key={item.id} className="flex items-start gap-2 px-3 py-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {item.status === "completed" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : item.status === "reviewed" ? (
                          <FileCheck className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800">{item.name}</p>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                          <span className={`font-semibold ${
                            item.status === "completed" ? "text-emerald-600" :
                            item.status === "reviewed" ? "text-blue-600" : "text-gray-400"
                          }`}>{item.status || "pending"}</span>
                          {item.document_name && (
                            <a href={item.document_url} target="_blank" rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline flex items-center gap-1">
                              <FileText className="w-3 h-3" /> {item.document_name}
                            </a>
                          )}
                          {item.add_date && <span>Added: {fmtDate(item.add_date)}</span>}
                        </div>
                        {item.notes && <RichTextPreview html={item.notes} className="mt-1" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Digital Signatures */}
            {signatures.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <PenLine className="w-4 h-4 text-indigo-500" /> Digital Signatures
                </h3>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {signatures.map((sig) => (
                    <div key={sig.id} className="flex items-center gap-2 px-3 py-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-800">{sig.contact_name || "—"}</span>
                        <span className="text-xs text-gray-500 ml-2">({sig.role || "Approver"})</span>
                        {sig.comment && <p className="text-xs text-gray-500 mt-0.5">{sig.comment}</p>}
                      </div>
                      <span className="text-[11px] text-gray-400">{fmtDateTime(sig.signed_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Flag className="w-4 h-4 text-indigo-500" /> Milestones
                </h3>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                      {m.completed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${m.completed ? "text-gray-800" : "text-gray-600"}`}>{m.name}</span>
                        {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                      </div>
                      <div className="text-[11px] text-gray-400 text-right">
                        {m.target_date && <div>Target: {fmtDate(m.target_date)}</div>}
                        {m.completed_date && <div className="text-emerald-600">Done: {fmtDate(m.completed_date)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Trail */}
            {auditTrail.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-500" /> Audit Trail
                </h3>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {[...auditTrail].reverse().map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 px-3 py-1.5">
                      <div className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700">
                            {ACTION_LABELS[entry.action_type] || entry.action_type}
                          </span>
                          {entry.stage_name && <span className="text-[11px] text-gray-500">· {entry.stage_name}</span>}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {entry.actor_name || "System"} · {fmtDateTime(entry.timestamp)}
                        </div>
                        {entry.details && <p className="text-[11px] text-gray-500 mt-0.5">{entry.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {onEdit && (
            <Button onClick={() => { onOpenChange(false); onEdit(rec); }} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}