import React, { useMemo } from "react";
import {
  ShieldCheck, CheckCircle2, Circle, Lock, AlertCircle,
  ClipboardCheck, FileText, FileCheck, BarChart3, AlignLeft, Calculator, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const REQ_TYPE_META = {
  sub_stage_completion: { label: "Sub-Stage Completion", icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
  document_attachment: { label: "Document Attachment", icon: FileText, color: "text-cyan-600", bg: "bg-cyan-50" },
  form_completion: { label: "Form Completion", icon: FileCheck, color: "text-blue-600", bg: "bg-blue-50" },
  score_card_completion: { label: "Score Card Completion", icon: BarChart3, color: "text-purple-600", bg: "bg-purple-50" },
  qualitative_analysis: { label: "Qualitative Analysis", icon: AlignLeft, color: "text-amber-600", bg: "bg-amber-50" },
  quantitative_analysis: { label: "Quantitative Analysis", icon: Calculator, color: "text-emerald-600", bg: "bg-emerald-50" },
  approval: { label: "Approval", icon: UserCheck, color: "text-rose-600", bg: "bg-rose-50" },
};

/**
 * Evaluates whether a single requirement is satisfied given the current
 * due diligence state (stages, doc checklist, approval process).
 */
export function evaluateRequirement(req, { stages, docChecklist, approvalProcess }) {
  if (!req || !req.required) return { satisfied: true, label: req?.label || "", detail: "Optional" };

  switch (req.type) {
    case "sub_stage_completion": {
      const stage = stages.find((s) => s.id === req.stage_id);
      if (!stage) return { satisfied: false, label: req.label || "Sub-stage completion", detail: "Stage not found" };
      const subs = stage.sub_stages || [];
      if (subs.length === 0) return { satisfied: true, label: req.label || `Complete ${stage.name}`, detail: "No sub-stages" };
      if (req.sub_stage_id) {
        const ss = subs.find((s) => s.id === req.sub_stage_id);
        if (!ss) return { satisfied: false, label: req.label || "Sub-stage not found", detail: "Sub-stage not found" };
        const done = (ss.status || "not_started") === "completed";
        return { satisfied: done, label: req.label || `Complete: ${ss.name}`, detail: done ? "Completed" : "Not completed" };
      }
      const allDone = subs.every((ss) => (ss.status || "not_started") === "completed");
      const doneCount = subs.filter((ss) => (ss.status || "not_started") === "completed").length;
      return {
        satisfied: allDone,
        label: req.label || `Complete all sub-stages in ${stage.name}`,
        detail: `${doneCount}/${subs.length} completed`,
      };
    }
    case "document_attachment": {
      const item = docChecklist.find((d) => d.id === req.document_checklist_item_id);
      if (!item) return { satisfied: false, label: req.label || "Document attachment", detail: "Checklist item not found" };
      const hasDoc = !!(item.document_url || item.document_id);
      return {
        satisfied: hasDoc,
        label: req.label || `Attach: ${item.name}`,
        detail: hasDoc ? "Attached" : "Not attached",
      };
    }
    case "form_completion":
      return {
        satisfied: !!req.satisfied,
        label: req.label || (req.form_id ? `Complete form: ${req.form_id}` : "Form completion"),
        detail: req.satisfied ? "Completed" : "Pending",
      };
    case "score_card_completion":
      return {
        satisfied: !!req.satisfied,
        label: req.label || (req.score_card_template_id ? `Complete score card: ${req.score_card_template_id}` : "Score card completion"),
        detail: req.satisfied ? "Completed" : "Pending",
      };
    case "qualitative_analysis":
      return {
        satisfied: !!req.satisfied,
        label: req.label || `Qualitative analysis${req.analysis_description ? ": " + req.analysis_description : ""}`,
        detail: req.satisfied ? "Completed" : "Pending",
      };
    case "quantitative_analysis":
      return {
        satisfied: !!req.satisfied,
        label: req.label || `Quantitative analysis${req.analysis_description ? ": " + req.analysis_description : ""}`,
        detail: req.satisfied ? "Completed" : "Pending",
      };
    case "approval": {
      // Check if the from_stage has supervisor approval
      const stage = stages.find((s) => s.id === req.stage_id);
      if (!stage) return { satisfied: false, label: req.label || "Approval", detail: "Stage not found" };
      const approved = (stage.supervisor_status || "pending") === "approved";
      return {
        satisfied: approved,
        label: req.label || `Approval${req.approval_role ? ": " + req.approval_role : ""}`,
        detail: approved ? "Approved" : (stage.supervisor_status === "pending" ? "Awaiting approval" : "Not approved"),
      };
    }
    default:
      return { satisfied: !!req.satisfied, label: req.label || "Unknown requirement", detail: "Unknown" };
  }
}

/**
 * Evaluates an entire gate: all mandatory requirements must be satisfied.
 * Returns { passed, requirements: [{ req, eval }], blockedBy: [...] }
 */
export function evaluateGate(gate, ctx) {
  const reqEvals = (gate.requirements || []).map((req) => ({
    req,
    eval: evaluateRequirement(req, ctx),
  }));
  const mandatory = reqEvals.filter((re) => re.req.required !== false);
  const blockedBy = mandatory.filter((re) => !re.eval.satisfied);
  return {
    passed: blockedBy.length === 0,
    requirements: reqEvals,
    blockedBy,
  };
}

/**
 * Process Logic Gate display — shows the gate requirements and their
 * satisfaction status for a specific stage transition in the due diligence flow.
 *
 * Props:
 *   gate             — the process logic gate rule object
 *   stages           — current DD stages (with sub-stages, supervisor status, etc.)
 *   docChecklist     — current DD documentation checklist
 *   approvalProcess  — current DD approval process
 *   compact          — if true, show a compact summary (for inline display)
 */
export default function ProcessLogicGate({ gate, stages = [], docChecklist = [], approvalProcess = {}, compact = false }) {
  const ctx = useMemo(() => ({ stages, docChecklist, approvalProcess }), [stages, docChecklist, approvalProcess]);
  const evaluation = useMemo(() => evaluateGate(gate, ctx), [gate, ctx]);

  if (!gate || !gate.requirements || gate.requirements.length === 0) return null;

  if (compact) {
    const passed = evaluation.passed;
    return (
      <div className={cn(
        "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
        passed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      )}>
        <ShieldCheck className="w-2.5 h-2.5" />
        {passed ? "Gate passed" : `${evaluation.blockedBy.length} blocking`}
      </div>
    );
  }

  const passed = evaluation.passed;

  return (
    <div className={cn(
      "rounded-md border p-2 space-y-1.5",
      passed ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"
    )}>
      <div className="flex items-center gap-2">
        <ShieldCheck className={cn("w-3.5 h-3.5", passed ? "text-emerald-600" : "text-amber-600")} />
        <span className="text-xs font-semibold text-gray-700">{gate.name || "Process Gate"}</span>
        {passed ? (
          <span className="ml-auto text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
            <CheckCircle2 className="w-3 h-3" /> All requirements met
          </span>
        ) : (
          <span className="ml-auto text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
            <AlertCircle className="w-3 h-3" /> {evaluation.blockedBy.length} blocking
          </span>
        )}
      </div>

      <div className="space-y-1 pl-5">
        {evaluation.requirements.map(({ req, eval: evalResult }) => {
          const meta = REQ_TYPE_META[req.type] || REQ_TYPE_META.sub_stage_completion;
          const ReqIcon = meta.icon;
          const isOptional = req.required === false;
          const isSatisfied = evalResult.satisfied;
          return (
            <div key={req.id} className="flex items-center gap-1.5 text-[11px]">
              {isSatisfied ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
              ) : isOptional ? (
                <Circle className="w-3 h-3 text-gray-300 shrink-0" />
              ) : (
                <Circle className="w-3 h-3 text-amber-500 shrink-0" />
              )}
              <ReqIcon className={cn("w-3 h-3 shrink-0", meta.color)} />
              <span className={cn(
                "truncate flex-1",
                isSatisfied ? "text-gray-500 line-through" : "text-gray-700"
              )}>
                {evalResult.label || meta.label}
              </span>
              {!isSatisfied && !isOptional && (
                <span className="text-[9px] text-amber-600 shrink-0">{evalResult.detail}</span>
              )}
              {isOptional && (
                <span className="text-[9px] text-gray-400 shrink-0">optional</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}