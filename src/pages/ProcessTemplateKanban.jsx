import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import ProcessTemplateKanbanBoard from "@/components/firms/ProcessTemplateKanbanBoard";
import AddDueDiligenceDialog from "@/components/firms/AddDueDiligenceDialog";
import { evaluateStageSignoff } from "@/components/firms/DigitalSignoffPanel";
import { evaluateGate } from "@/components/firms/ProcessLogicGate";
import { appendAuditEntry } from "@/../base44/shared/ddAuditTrail";
import {
  LayoutDashboard, List, Loader2, X, KanbanSquare, FileText,
  UserCheck, AlertCircle, CheckCircle2, CheckSquare, Zap, XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

/**
 * Checks whether a DD record's current stage meets all checklist requirements
 * for bulk approval:
 *  - All sub-stages in the current stage are completed
 *  - All required digital sign-offs are collected
 *  - All gate requirements (document attachments, etc.) are satisfied
 * Returns { canApprove, blockers: [{ type, label }] }
 */
function checkCanApprove(rec) {
  const stages = rec.stages || [];
  const idx = rec.current_stage_index || 0;
  const stage = stages[idx];
  if (!stage) return { canApprove: false, blockers: [{ type: "stage", label: "No current stage" }] };
  if (stage.completed) return { canApprove: false, blockers: [{ type: "stage", label: "Stage already completed" }] };

  const blockers = [];
  const subs = stage.sub_stages || [];
  const docChecklist = rec.documentation_checklist || [];
  const processLogic = rec.process_logic || [];
  const approvalProcess = rec.approval_process || {};
  const stageApprovers = rec.stage_approvers || [];
  const digitalSignatures = rec.digital_signatures || [];

  // 1. All sub-stages completed
  const pendingSubs = subs.filter((ss) => (ss.status || "not_started") !== "completed");
  if (pendingSubs.length > 0) {
    blockers.push({ type: "sub_stage", label: `${pendingSubs.length} sub-stage(s) not completed` });
  }

  // 2. All required digital sign-offs collected
  const signoffEval = evaluateStageSignoff(stageApprovers, digitalSignatures, stage.id);
  if (signoffEval.hasApprovers && !signoffEval.allSigned) {
    blockers.push({ type: "signoff", label: `${signoffEval.pendingRequired.length} required sign-off(s) pending` });
  }

  // 3. Gate requirements satisfied
  const gate = processLogic.find((g) => g.from_stage_id === stage.id);
  if (gate && gate.requirements) {
    const ctx = { stages, docChecklist, approvalProcess, stageApprovers, digitalSignatures };
    const gateEval = evaluateGate(gate, ctx);
    gateEval.requirements.forEach(({ req, eval: evalResult }) => {
      if (req.required !== false && !evalResult.satisfied) {
        blockers.push({ type: req.type, label: evalResult.label || req.label || "Gate requirement" });
      }
    });
  }

  return { canApprove: blockers.length === 0, blockers };
}

export default function ProcessTemplateKanban() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  const { data: records = [], isLoading: ddLoading } = useQuery({
    queryKey: ["due-diligence-all"],
    queryFn: () => base44.entities.DueDiligence.list("-created_date", 500),
  });

  const { data: templates = [], isLoading: tplLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => base44.entities.Template.list("-created_date", 5000),
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["firms-all"],
    queryFn: () => base44.entities.Firm.list("-created_date", 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-all"],
    queryFn: () => base44.entities.Product.list("-created_date", 500),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-all"],
    queryFn: () => base44.entities.Contact.list("-created_date", 500),
  });

  // Only process templates (with stages)
  const ddTemplates = useMemo(
    () => templates.filter(
      (t) => t.template_type === "Manager Due Diligence" && Array.isArray(t.stages) && t.stages.length > 0
    ),
    [templates]
  );

  // Auto-select first template
  React.useEffect(() => {
    if (!selectedTemplateId && ddTemplates.length > 0) {
      setSelectedTemplateId(ddTemplates[0].id);
    }
  }, [ddTemplates, selectedTemplateId]);

  const selectedTemplate = ddTemplates.find((t) => t.id === selectedTemplateId);
  const templateStages = selectedTemplate?.stages || [];

  // Filter DD records by selected template (active only, not rejected)
  const templateRecords = useMemo(
    () => records.filter((r) =>
      !r.deleted_at &&
      r.status !== "Rejected" &&
      r.template_id === selectedTemplateId &&
      Array.isArray(r.stages) && r.stages.length > 0
    ),
    [records, selectedTemplateId]
  );

  // Aggregate pending stats across all visible records
  const aggregateStats = useMemo(() => {
    let pendingDocs = 0, pendingApprovals = 0, pendingGates = 0, ready = 0;
    templateRecords.forEach((r) => {
      const stages = r.stages || [];
      const idx = r.current_stage_index || 0;
      const stage = stages[idx];
      if (!stage) return;
      const subs = stage.sub_stages || [];
      const docChecklist = r.documentation_checklist || [];
      const processLogic = r.process_logic || [];
      const approvalProcess = r.approval_process || {};
      const ctx = { stages, docChecklist, approvalProcess };
      const gate = processLogic.find((g) => g.from_stage_id === stage.id);
      let recPending = 0;
      if (gate) {
        gate.requirements?.forEach((req) => {
          if (req.required !== false) {
            // simplified check
            if (req.type === "document_attachment") {
              const item = docChecklist.find((d) => d.id === req.document_checklist_item_id);
              if (!item || (!item.document_url && !item.document_id)) {
                pendingDocs++;
                recPending++;
              }
            } else if (req.type === "approval") {
              if ((stage.supervisor_status || "pending") !== "approved") {
                pendingApprovals++;
                recPending++;
              }
            } else if (!req.satisfied) {
              pendingGates++;
              recPending++;
            }
          }
        });
      }
      if (recPending === 0 && subs.length > 0 && subs.every((ss) => (ss.status || "not_started") === "completed")) {
        ready++;
      }
    });
    return { pendingDocs, pendingApprovals, pendingGates, ready, total: templateRecords.length };
  }, [templateRecords]);

  const handleMoveCard = async (rec, newStageIndex) => {
    const stages = rec.stages || [];
    if (newStageIndex < 0 || newStageIndex >= stages.length) return;
    // Update current_stage_index and mark the new stage's start_date
    const newStages = stages.map((s, i) => {
      if (i === newStageIndex && !s.start_date) {
        return { ...s, start_date: new Date().toISOString().slice(0, 10) };
      }
      return s;
    });
    await base44.entities.DueDiligence.update(rec.id, {
      current_stage_index: newStageIndex,
      stages: newStages,
    });
    queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
  };

  const handleCardClick = (rec) => {
    if (selectionMode) return; // Don't open dialog in selection mode
    setEditing(rec);
    setShowDialog(true);
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleExitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  // Bulk approve: checks each selected process meets checklist requirements,
  // then approves the current stage and advances to the next.
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    setBulkApproving(true);

    const selectedRecs = templateRecords.filter((r) => selectedIds.includes(r.id));
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const results = { approved: 0, blocked: 0, errors: 0, blockedDetails: [] };

    for (const rec of selectedRecs) {
      const { canApprove, blockers } = checkCanApprove(rec);
      if (!canApprove) {
        results.blocked++;
        results.blockedDetails.push({
          name: rec.product_name || rec.firm_name || rec.id,
          blockers: blockers.map((b) => b.label),
        });
        continue;
      }

      try {
        const stages = rec.stages || [];
        const idx = rec.current_stage_index || 0;
        const stage = stages[idx];
        const newStages = stages.map((s, i) => {
          if (i !== idx) return s;
          return {
            ...s,
            supervisor_status: "approved",
            supervisor_date: todayStr,
            completed: true,
            completed_date: todayStr,
            end_date: todayStr,
          };
        });

        // Determine next stage index (advance if not last stage)
        const nextIdx = idx < stages.length - 1 ? idx + 1 : idx;
        if (nextIdx !== idx && !newStages[nextIdx].start_date) {
          newStages[nextIdx] = { ...newStages[nextIdx], start_date: todayStr };
        }

        // Append audit trail entry
        const newAuditTrail = appendAuditEntry(rec.audit_trail, "bulk_approved", {
          stageId: stage?.id,
          stageName: stage?.name,
          details: `Stage "${stage?.name || ""}" bulk approved and advanced to "${newStages[nextIdx]?.name || ""}"`,
        });

        await base44.entities.DueDiligence.update(rec.id, {
          stages: newStages,
          current_stage_index: nextIdx,
          audit_trail: newAuditTrail,
        });
        results.approved++;
      } catch (err) {
        console.error("Bulk approve error for", rec.id, err);
        results.errors++;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });

    if (results.approved > 0) {
      toast({
        title: "Bulk approve complete",
        description: `${results.approved} process${results.approved !== 1 ? "es" : ""} approved and advanced.`,
      });
    }
    if (results.blocked > 0) {
      toast({
        title: `${results.blocked} process${results.blocked !== 1 ? "es" : ""} blocked`,
        description: results.blockedDetails
          .map((d) => `${d.name}: ${d.blockers.join(", ")}`)
          .join("; "),
        variant: "destructive",
      });
    }
    if (results.errors > 0) {
      toast({
        title: `${results.errors} error(s)`,
        description: "Some processes could not be saved. Check console for details.",
        variant: "destructive",
      });
    }

    setBulkApproving(false);
    handleExitSelection();
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KanbanSquare className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-800">Process Template Kanban</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
            onClick={() => { setEditing(null); setShowDialog(true); }}
          >
            <List className="w-4 h-4" /> Add Due Diligence
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => navigate("/")}
            title="Close and return to dashboard"
          >
            <X className="w-4 h-4" /> Close
          </Button>
        </div>
      </div>

      {/* Template selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Template:</span>
        {ddTemplates.length === 0 ? (
          <span className="text-xs text-gray-400 italic">No process templates with stages yet</span>
        ) : (
          ddTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTemplateId(t.id)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium transition-colors",
                selectedTemplateId === t.id
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {t.name}
            </button>
          ))
        )}
      </div>

      {/* Aggregate pending stats */}
      {templateRecords.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
            <FileText className="w-3.5 h-3.5" /> {aggregateStats.pendingDocs} docs pending
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            <UserCheck className="w-3.5 h-3.5" /> {aggregateStats.pendingApprovals} approvals pending
          </span>
          {aggregateStats.pendingGates > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" /> {aggregateStats.pendingGates} gate requirements
            </span>
          )}
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> {aggregateStats.ready} ready to advance
          </span>
          <span className="text-gray-400 ml-auto">{aggregateStats.total} active processes</span>
        </div>
      )}

      {/* Kanban board */}
      {ddLoading || tplLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : !selectedTemplate ? (
        <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl">
          Select a process template above to view its kanban board
        </div>
      ) : templateRecords.length === 0 ? (
        <div className="text-sm text-gray-400 italic py-8 text-center border border-dashed border-gray-200 rounded-xl">
          No active due diligence processes using this template
        </div>
      ) : (
        <div className="h-[calc(100vh-320px)] min-h-[400px]">
          <ProcessTemplateKanbanBoard
            records={templateRecords}
            stages={templateStages}
            onMoveCard={handleMoveCard}
            onCardClick={handleCardClick}
          />
        </div>
      )}

      <AddDueDiligenceDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        firmId={editing?.firm_id || ""}
        firmName={editing?.firm_name || ""}
        products={products.filter((p) => !p.deleted_at)}
        contacts={contacts.filter((c) => !c.deleted_at)}
        editingRecord={editing}
        onSubmit={(data) => {
          const op = editing
            ? base44.entities.DueDiligence.update(editing.id, data)
            : base44.entities.DueDiligence.create(data);
          op.finally(() => {
            queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
            queryClient.invalidateQueries({ queryKey: ["due-diligence-search"] });
            queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
          });
          setShowDialog(false);
        }}
        onDelete={(id) => {
          base44.entities.DueDiligence.delete(id);
          queryClient.invalidateQueries({ queryKey: ["due-diligence-all"] });
          queryClient.invalidateQueries({ queryKey: ["due-diligence-search"] });
          queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
          setShowDialog(false);
          setEditing(null);
        }}
      />
    </div>
  );
}