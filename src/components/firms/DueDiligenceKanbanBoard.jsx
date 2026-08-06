import React, { useMemo, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ClipboardCheck, Plus } from "lucide-react";

const COLUMN_DEFS = {
  status: {
    key: "status",
    title: "Due Diligence Status",
    columns: ["Pipeline", "Buy List", "Rejected"],
  },
  process_status: {
    key: "process_status",
    title: "Process Status",
    columns: ["Not Started", "In-process", "Completed"],
  },
  approval_status: {
    key: "approval_status",
    title: "Approval Pipeline",
    columns: ["In Pipeline", "Awaiting Approval", "Approved"],
  },
};

const COLUMN_ACCENTS = {
  "Pipeline": "border-blue-300 bg-blue-50/40",
  "Buy List": "border-emerald-300 bg-emerald-50/40",
  "Rejected": "border-red-300 bg-red-50/40",
  "Not Started": "border-gray-300 bg-gray-50/40",
  "In-process": "border-amber-300 bg-amber-50/40",
  "Completed": "border-emerald-300 bg-emerald-50/40",
  "In Pipeline": "border-blue-300 bg-blue-50/40",
  "Awaiting Approval": "border-amber-300 bg-amber-50/40",
  "Approved": "border-emerald-300 bg-emerald-50/40",
};

/**
 * Computes an "approval_status" for a DD record based on its stages.
 * - "Awaiting Approval": at least one stage has supervisor_status "pending" with a supervisor assigned
 * - "Approved": all stages completed (or process_status "Completed")
 * - "In Pipeline": everything else (in progress, no pending approval)
 */
export function computeApprovalStatus(rec) {
  if (rec.process_status === "Completed" || rec.status === "Buy List") return "Approved";
  const stages = rec.stages || [];
  if (stages.length === 0) return "In Pipeline";
  const hasPending = stages.some(
    (s) => (s.supervisor_status || "pending") === "pending" && s.supervisor_contact_id
  );
  const allApproved = stages.every((s) => (s.supervisor_status || "pending") === "approved");
  if (allApproved) return "Approved";
  return hasPending ? "Awaiting Approval" : "In Pipeline";
}

const OTHER_BADGE = {
  status: {
    key: "process_status",
    styles: {
      "Not Started": "bg-gray-100 text-gray-600",
      "In-process": "bg-amber-100 text-amber-700",
      "Completed": "bg-emerald-100 text-emerald-700",
    },
  },
  process_status: {
    key: "status",
    styles: {
      "Pipeline": "bg-blue-100 text-blue-700",
      "Buy List": "bg-emerald-100 text-emerald-700",
      "Rejected": "bg-red-100 text-red-700",
    },
  },
  approval_status: {
    key: "status",
    styles: {
      "Pipeline": "bg-blue-100 text-blue-700",
      "Buy List": "bg-emerald-100 text-emerald-700",
      "Rejected": "bg-red-100 text-red-700",
    },
  },
};

function Card({ rec, columnField, onCardClick }) {
  const other = OTHER_BADGE[columnField];
  const otherVal = rec[other.key];
  const cardRef = useRef(null);

  // Use a native event listener to bypass @hello-pangea/dnd's dragHandleProps
  // which intercepts React synthetic onClick events on the parent draggable div.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !onCardClick) return;
    const handler = (e) => {
      if (e.detail === 0) return; // skip programmatic clicks
      e.stopPropagation();
      onCardClick(rec);
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [rec, onCardClick]);

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-2.5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start gap-2">
        <ClipboardCheck className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{rec.product_name || "—"}</p>
          <p className="text-[11px] text-gray-500 truncate">{rec.firm_name || "—"}</p>
          <p className="text-[11px] text-gray-500 truncate">P: {rec.primary_analyst_name || "—"}</p>
          {rec.secondary_analyst_name && (
            <p className="text-[11px] text-gray-500 truncate">S: {rec.secondary_analyst_name}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        {otherVal && (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${other.styles[otherVal] || "bg-gray-100 text-gray-600"}`}>
            {otherVal}
          </span>
        )}
        <span className="text-[10px] text-indigo-500 font-medium ml-auto">Edit →</span>
      </div>
    </div>
  );
}

export default function DueDiligenceKanbanBoard({
  records,
  columnField = "status",
  onMoveCard,
  onCardClick,
  onProductClick,
  onFirmClick,
  onContactClick,
}) {
  const def = COLUMN_DEFS[columnField];

  const grouped = useMemo(() => {
    const map = {};
    def.columns.forEach(c => { map[c] = []; });
    records.forEach(r => {
      const col = map[r[columnField]] ?? map[def.columns[0]];
      if (col) col.push(r);
    });
    return map;
  }, [records, columnField, def]);

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const rec = grouped[source.droppableId]?.[source.index];
    if (!rec) return;
    onMoveCard?.(rec, destination.droppableId);
  };

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 h-full px-1 pb-1" style={{ minWidth: "max-content" }}>
          {def.columns.map(col => {
            const items = grouped[col] || [];
            return (
              <div key={col} className={`flex flex-col w-64 flex-shrink-0 rounded-xl border ${COLUMN_ACCENTS[col] || "border-gray-200 bg-gray-50/40"}`}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-black/5">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">{col}</span>
                  <span className="text-[10px] font-semibold text-gray-400 bg-white/70 rounded-full px-1.5">{items.length}</span>
                </div>
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-white/60" : ""}`}
                    >
                      {items.length === 0 && (
                        <p className="text-[10px] text-gray-400 italic text-center py-3">No records</p>
                      )}
                      {items.map((rec, index) => (
                        <Draggable key={rec.id} draggableId={rec.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}

                              style={prov.draggableProps.style}
                              className={snap.isDragging ? "opacity-80 shadow-lg" : "cursor-pointer"}
                            >
                              <Card
                                rec={rec}
                                columnField={columnField}
                                onCardClick={onCardClick}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}