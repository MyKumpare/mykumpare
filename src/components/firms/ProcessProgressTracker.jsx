import React, { useMemo, useState } from "react";
import {
  CheckCircle2, Circle, Clock, Lock, AlertCircle, ChevronDown, ChevronRight,
  ClipboardCheck, FileText, FileCheck, BarChart3, AlignLeft, Calculator, UserCheck,
  ShieldCheck, X, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { evaluateRequirement, evaluateGate } from "./ProcessLogicGate";
import { evaluateStageSignoff } from "./DigitalSignoffPanel";

const REQ_TYPE_META = {
  sub_stage_completion: { label: "Sub-Stage", icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50", ring: "ring-indigo-200" },
  document_attachment: { label: "Document", icon: FileText, color: "text-cyan-600", bg: "bg-cyan-50", ring: "ring-cyan-200" },
  form_completion: { label: "Form", icon: FileCheck, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200" },
  score_card_completion: { label: "Score Card", icon: BarChart3, color: "text-purple-600", bg: "bg-purple-50", ring: "ring-purple-200" },
  qualitative_analysis: { label: "Qualitative", icon: AlignLeft, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" },
  quantitative_analysis: { label: "Quantitative", icon: Calculator, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  approval: { label: "Approval", icon: UserCheck, color: "text-rose-600", bg: "bg-rose-50", ring: "ring-rose-200" },
};

/**
 * Collects all pending requirements for a given stage, drawing from:
 *  - The stage's own sub-stages (not completed)
 *  - Gate requirements that reference this stage (from_stage_id === stage.id)
 *  - Supervisor approval status
 *
 * Returns a structured list of pending items grouped by type.
 */
function collectPendingForStage(stage, index, { stages, docChecklist, approvalProcess, processLogic, stageApprovers, digitalSignatures }) {
  const pending = [];
  const ctx = { stages, docChecklist, approvalProcess, stageApprovers, digitalSignatures };

  // 1. Pending sub-stages within this stage
  const subs = stage.sub_stages || [];
  subs.forEach((ss) => {
    if ((ss.status || "not_started") !== "completed") {
      pending.push({
        type: "sub_stage_completion",
        label: ss.name || "Unnamed sub-stage",
        detail: ss.status === "in_process" ? "In progress" : "Not started",
        satisfied: false,
        stageId: stage.id,
        subStageId: ss.id,
      });
    }
  });

  // 2. Supervisor approval pending
  if (!stage.completed && subs.length > 0 && subs.every((ss) => (ss.status || "not_started") === "completed")) {
    const supStatus = stage.supervisor_status || "pending";
    if (supStatus === "pending") {
      pending.push({
        type: "approval",
        label: `Supervisor approval${stage.supervisor_name ? ": " + stage.supervisor_name : ""}`,
        detail: "Awaiting approval",
        satisfied: false,
        stageId: stage.id,
      });
    } else if (supStatus === "rejected") {
      pending.push({
        type: "approval",
        label: `Supervisor approval rejected`,
        detail: "Rejected — needs re-review",
        satisfied: false,
        stageId: stage.id,
      });
    } else if (supStatus === "on_hold") {
      pending.push({
        type: "approval",
        label: `Supervisor approval on hold`,
        detail: "On hold",
        satisfied: false,
        stageId: stage.id,
      });
    }
  }

  // 3. Digital sign-off pending (if stage has approvers defined)
  const signoffEval = evaluateStageSignoff(stageApprovers, digitalSignatures, stage.id);
  if (signoffEval.hasApprovers && !signoffEval.allSigned) {
    signoffEval.pendingRequired.forEach((role) => {
      pending.push({
        type: "approval",
        label: `Digital sign-off: ${role.role || "Approver"}${role.contact_name ? " (" + role.contact_name + ")" : " (unassigned)"}`,
        detail: role.contact_id ? "Awaiting signature" : "Assign contact first",
        satisfied: false,
        stageId: stage.id,
      });
    });
  }

  // 4. Gate requirements leading FROM this stage to the next
  const gate = (processLogic || []).find((g) => g.from_stage_id === stage.id);
  if (gate && gate.requirements) {
    const gateEval = evaluateGate(gate, ctx);
    gateEval.requirements.forEach(({ req, eval: evalResult }) => {
      const isOptional = req.required === false;
      if (!evalResult.satisfied && !isOptional) {
        pending.push({
          type: req.type,
          label: evalResult.label || REQ_TYPE_META[req.type]?.label || "Requirement",
          detail: evalResult.detail || "Pending",
          satisfied: false,
          stageId: stage.id,
          gateName: gate.name,
        });
      }
    });
  }

  return pending;
}

/**
 * Counts completed vs total items for a stage (sub-stages + gate requirements).
 */
function getStageCompletionStats(stage, { stages, docChecklist, approvalProcess, processLogic, stageApprovers, digitalSignatures }) {
  const subs = stage.sub_stages || [];
  const subsDone = subs.filter((ss) => (ss.status || "not_started") === "completed").length;
  const subsTotal = subs.length;

  // Count digital sign-off requirements for this stage
  const signoffEval = evaluateStageSignoff(stageApprovers, digitalSignatures, stage.id);
  let signoffDone = 0, signoffTotal = 0;
  if (signoffEval.hasApprovers) {
    signoffTotal = signoffEval.requiredCount;
    signoffDone = signoffEval.signedCount;
  }

  // Count gate requirements for this stage
  const gate = (processLogic || []).find((g) => g.from_stage_id === stage.id);
  let gateDone = 0, gateTotal = 0;
  if (gate && gate.requirements) {
    const ctx = { stages, docChecklist, approvalProcess, stageApprovers, digitalSignatures };
    const gateEval = evaluateGate(gate, ctx);
    gateEval.requirements.forEach(({ req, eval: evalResult }) => {
      if (req.required !== false) {
        gateTotal++;
        if (evalResult.satisfied) gateDone++;
      }
    });
  }

  const total = subsTotal + gateTotal + signoffTotal + (stage.completed ? 0 : 1); // +1 for supervisor approval
  const done = subsDone + gateDone + signoffDone + (stage.completed ? 1 : 0);

  return { subsDone, subsTotal, gateDone, gateTotal, signoffDone, signoffTotal, total, done };
}

/**
 * Visual Progress Tracker — shows pending documents, forms, sub-stages,
 * and approvals at each stage of the due diligence process.
 *
 * Props:
 *   stages, docChecklist, approvalProcess, processLogic
 */
export default function ProcessProgressTracker({
  stages = [],
  docChecklist = [],
  approvalProcess = {},
  processLogic = [],
  stageApprovers = [],
  digitalSignatures = [],
}) {
  const [expandedStages, setExpandedStages] = useState({});
  const toggleExpand = (id) => setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }));

  const ctx = useMemo(() => ({ stages, docChecklist, approvalProcess, processLogic, stageApprovers, digitalSignatures }), [stages, docChecklist, approvalProcess, processLogic, stageApprovers, digitalSignatures]);

  // Overall stats
  const overall = useMemo(() => {
    let totalPending = 0;
    let totalItems = 0;
    let completedStages = 0;
    stages.forEach((stage) => {
      const stats = getStageCompletionStats(stage, ctx);
      totalItems += stats.total;
      totalPending += stats.total - stats.done;
      if (stage.completed) completedStages++;
    });
    return {
      totalPending,
      totalItems,
      completedStages,
      totalStages: stages.length,
      pct: stages.length > 0 ? Math.round((completedStages / stages.length) * 100) : 0,
    };
  }, [stages, ctx]);

  if (stages.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-40" />
        No stages configured. Select a due diligence template to see the progress tracker.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Overall summary header */}
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-800">Completion Tracker</span>
          </div>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            overall.totalPending === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          )}>
            {overall.totalPending === 0 ? "All complete" : `${overall.totalPending} pending`}
          </span>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500" style={{ width: `${overall.pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-500">
          <span>{overall.completedStages} of {overall.totalStages} stages completed</span>
          <span>{overall.totalItems - overall.totalPending} / {overall.totalItems} items done</span>
        </div>
      </div>

      {/* Per-stage breakdown */}
      <div className="space-y-2">
        {stages.map((stage, index) => {
          const stats = getStageCompletionStats(stage, ctx);
          const pending = collectPendingForStage(stage, index, ctx);
          const isExpanded = expandedStages[stage.id];
          const stagePct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : (stage.completed ? 100 : 0);
          const isCompleted = !!stage.completed;
          const hasPending = pending.length > 0;

          return (
            <div key={stage.id} className={cn(
              "rounded-lg border transition-colors",
              isCompleted ? "border-emerald-200 bg-emerald-50/30" : hasPending ? "border-amber-200 bg-amber-50/20" : "border-gray-200 bg-white"
            )}>
              {/* Stage header row */}
              <button
                type="button"
                onClick={() => toggleExpand(stage.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              >
                {/* Status circle */}
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  isCompleted ? "bg-emerald-100" : hasPending ? "bg-amber-100" : "bg-gray-100"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : hasPending ? (
                    <Clock className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                </div>

                {/* Expand chevron */}
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                )}

                {/* Stage name + progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium truncate",
                      isCompleted ? "text-emerald-700" : "text-gray-800"
                    )}>
                      Stage {index + 1}: {stage.name || "Unnamed"}
                    </span>
                    {hasPending && !isCompleted && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
                        {pending.length} pending
                      </span>
                    )}
                  </div>
                  {/* Mini progress bar */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className={cn(
                        "h-full rounded-full transition-all",
                        isCompleted ? "bg-emerald-500" : "bg-indigo-500"
                      )} style={{ width: `${stagePct}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-500 shrink-0">{stats.done}/{stats.total}</span>
                  </div>
                </div>
              </button>

              {/* Expanded pending items */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 space-y-1.5">
                  {hasPending ? (
                    <>
                      <p className="text-[11px] text-gray-500 font-medium mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Pending items blocking completion:
                      </p>
                      {pending.map((item, i) => {
                        const meta = REQ_TYPE_META[item.type] || REQ_TYPE_META.sub_stage_completion;
                        const ItemIcon = meta.icon;
                        return (
                          <div key={i} className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 ring-1",
                            meta.bg, meta.ring
                          )}>
                            <ItemIcon className={cn("w-3.5 h-3.5 shrink-0", meta.color)} />
                            <span className="text-xs text-gray-700 flex-1 truncate">{item.label}</span>
                            <span className="text-[10px] text-gray-500 shrink-0">{item.detail}</span>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium py-1">
                      <CheckCircle2 className="w-4 h-4" />
                      All items completed for this stage
                    </div>
                  )}

                  {/* Sub-stage quick summary */}
                  {stage.sub_stages && stage.sub_stages.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400 font-medium mb-1">Sub-stages:</p>
                      <div className="space-y-0.5">
                        {stage.sub_stages.map((ss) => {
                          const done = (ss.status || "not_started") === "completed";
                          const inProgress = ss.status === "in_process";
                          return (
                            <div key={ss.id} className="flex items-center gap-1.5 text-[11px]">
                              {done ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                              ) : inProgress ? (
                                <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                              ) : (
                                <Circle className="w-3 h-3 text-gray-300 shrink-0" />
                              )}
                              <span className={cn("truncate", done ? "text-gray-400 line-through" : "text-gray-600")}>
                                {ss.name || "Unnamed"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}