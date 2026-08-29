import React, { useMemo, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  ClipboardCheck, FileText, UserCheck, AlertCircle, CheckCircle2,
  Circle, Clock, Lock, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { evaluateGate } from "./ProcessLogicGate";

/**
 * Counts pending items for a DD record:
 *  - Pending sub-stages in the current stage
 *  - Pending documents (checklist items without attachments)
 *  - Pending approvals (supervisor approval for current stage)
 *  - Pending gate requirements (blocking advancement to next stage)
 */
function getPendingSummary(rec) {
  const stages = rec.stages || [];
  const docChecklist = rec.documentation_checklist || [];
  const processLogic = rec.process_logic || [];
  const approvalProcess = rec.approval_process || {};
  const currentIdx = rec.current_stage_index || 0;
  const stage = stages[currentIdx];

  if (!stage) {
    return { pendingDocs: 0, pendingApprovals: 0, pendingSubStages: 0, pendingGates: 0, total: 0 };
  }

  // Pending sub-stages in current stage
  const subs = stage.sub_stages || [];
  const pendingSubStages = subs.filter((ss) => (ss.status || "not_started") !== "completed").length;

  // Pending documents (checklist items without attachments, referenced by gates)
  const ctx = { stages, docChecklist, approvalProcess };
  const gate = processLogic.find((g) => g.from_stage_id === stage.id);
  let pendingDocs = 0;
  let pendingGates = 0;
  if (gate) {
    const gateEval = evaluateGate(gate, ctx);
    gateEval.requirements.forEach(({ req, eval: evalResult }) => {
      if (req.required !== false && !evalResult.satisfied) {
        pendingGates++;
        if (req.type === "document_attachment") pendingDocs++;
      }
    });
  }

  // Also count any checklist items without documents (not just gate-referenced)
  const unattachedDocs = docChecklist.filter((d) => !d.document_url && !d.document_id).length;

  // Pending approval
  let pendingApprovals = 0;
  if (subs.length > 0 && subs.every((ss) => (ss.status || "not_started") === "completed")) {
    if ((stage.supervisor_status || "pending") === "pending") pendingApprovals = 1;
  }

  return {
    pendingSubStages,
    pendingDocs: Math.max(pendingDocs, unattachedDocs > 0 ? unattachedDocs : 0),
    pendingApprovals,
    pendingGates,
    total: pendingSubStages + pendingDocs + pendingApprovals + pendingGates,
  };
}

function KanbanCard({ rec, stageIndex, onCardClick }) {
  const cardRef = useRef(null);
  const pending = useMemo(() => getPendingSummary(rec), [rec]);
  const stages = rec.stages || [];
  const stage = stages[stageIndex];
  const subs = stage?.sub_stages || [];
  const subsDone = subs.filter((ss) => (ss.status || "not_started") === "completed").length;
  const subsTotal = subs.length;
  const subsPct = subsTotal > 0 ? Math.round((subsDone / subsTotal) * 100) : 0;
  const isCompleted = stage?.completed;

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !onCardClick) return;
    const handler = (e) => {
      if (e.detail === 0) return;
      e.stopPropagation();
      onCardClick(rec);
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [rec, onCardClick]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "bg-white rounded-lg border shadow-sm p-2.5 hover:shadow-md transition-all cursor-pointer",
        isCompleted ? "border-emerald-200" : "border-gray-200 hover:border-indigo-300"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <ClipboardCheck className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", isCompleted ? "text-emerald-500" : "text-indigo-400")} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{rec.product_name || "—"}</p>
          <p className="text-[11px] text-gray-500 truncate">{rec.firm_name || "—"}</p>
        </div>
      </div>

      {/* Sub-stage progress */}
      {subsTotal > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-0.5">
            <span>Sub-stages</span>
            <span>{subsDone}/{subsTotal}</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", isCompleted ? "bg-emerald-500" : "bg-indigo-500")} style={{ width: `${subsPct}%` }} />
          </div>
        </div>
      )}

      {/* Pending items badges */}
      {pending.total > 0 ? (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {pending.pendingDocs > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700" title={`${pending.pendingDocs} document(s) pending`}>
              <FileText className="w-2.5 h-2.5" /> {pending.pendingDocs} doc{pending.pendingDocs > 1 ? "s" : ""}
            </span>
          )}
          {pending.pendingApprovals > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700" title="Supervisor approval pending">
              <UserCheck className="w-2.5 h-2.5" /> Approval
            </span>
          )}
          {pending.pendingSubStages > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700" title={`${pending.pendingSubStages} sub-stage(s) pending`}>
              <Clock className="w-2.5 h-2.5" /> {pending.pendingSubStages} task{pending.pendingSubStages > 1 ? "s" : ""}
            </span>
          )}
          {pending.pendingGates > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700" title={`${pending.pendingGates} gate requirement(s) blocking`}>
              <AlertCircle className="w-2.5 h-2.5" /> {pending.pendingGates} gate
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-600 font-medium">
          <CheckCircle2 className="w-3 h-3" /> Ready to advance
        </div>
      )}

      {/* Analyst */}
      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-100">
        <span className="text-[10px] text-gray-400 truncate">{rec.primary_analyst_name || "—"}</span>
        <span className="text-[10px] text-indigo-500 font-medium">Edit →</span>
      </div>
    </div>
  );
}

/**
 * Kanban board for process templates — columns are template stages,
 * cards are active DD records. Drag to move between stages.
 *
 * Props:
 *   records, stages (template stages), onMoveCard, onCardClick
 */
export default function ProcessTemplateKanbanBoard({ records, stages, onMoveCard, onCardClick }) {
  const grouped = useMemo(() => {
    const map = {};
    stages.forEach((s, i) => { map[i] = []; });
    records.forEach((r) => {
      const idx = r.current_stage_index || 0;
      const col = map[idx] ?? map[0];
      if (col) col.push(r);
    });
    return map;
  }, [records, stages]);

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const rec = grouped[source.droppableId]?.[source.index];
    if (!rec) return;
    onMoveCard?.(rec, parseInt(destination.droppableId, 10));
  };

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 h-full px-1 pb-1" style={{ minWidth: "max-content" }}>
          {stages.map((stage, index) => {
            const items = grouped[index] || [];
            const isLast = index === stages.length - 1;
            return (
              <div key={stage.id || index} className="flex flex-col w-64 flex-shrink-0 rounded-xl border border-indigo-200 bg-indigo-50/30">
                <div className="flex items-center justify-between px-3 py-2 border-b border-black/5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                    <span className="text-[11px] font-bold text-gray-700 truncate">{stage.name || "Unnamed"}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-400 bg-white/70 rounded-full px-1.5">{items.length}</span>
                </div>
                <Droppable droppableId={String(index)}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 overflow-y-auto p-2 space-y-2 transition-colors min-h-[100px]",
                        snapshot.isDraggingOver ? "bg-white/60" : ""
                      )}
                    >
                      {items.length === 0 && (
                        <p className="text-[10px] text-gray-400 italic text-center py-3">No processes</p>
                      )}
                      {items.map((rec, i) => (
                        <Draggable key={rec.id} draggableId={rec.id} index={i}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              style={prov.draggableProps.style}
                              className={snap.isDragging ? "opacity-80 shadow-lg" : "cursor-pointer"}
                            >
                              <KanbanCard rec={rec} stageIndex={index} onCardClick={onCardClick} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                {!isLast && (
                  <div className="flex items-center justify-center py-1 border-t border-black/5 text-gray-300">
                    <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}