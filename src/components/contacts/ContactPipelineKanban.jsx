import React, { useMemo, useRef, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { User } from "lucide-react";

const STAGE_ACCENTS = [
  "border-blue-300 bg-blue-50/40",
  "border-amber-300 bg-amber-50/40",
  "border-violet-300 bg-violet-50/40",
  "border-cyan-300 bg-cyan-50/40",
  "border-emerald-300 bg-emerald-50/40",
  "border-rose-300 bg-rose-50/40",
  "border-gray-300 bg-gray-50/40",
];

function formatContactName(c) {
  const name = [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
  return c.designations?.length ? `${name}, ${c.designations.join(", ")}` : name;
}

function ContactAvatar({ contact }) {
  if (contact.photo_url) {
    return (
      <img src={contact.photo_url} alt={contact.first_name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
    );
  }
  const initials = [contact.first_name?.[0], contact.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  return (
    <div className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
      {initials || <User className="w-3 h-3" />}
    </div>
  );
}

function ContactCard({ contact, onContactClick }) {
  const cardRef = useRef(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !onContactClick) return;
    const handler = (e) => {
      if (e.detail === 0) return; // skip programmatic clicks
      e.stopPropagation();
      onContactClick(contact);
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [contact, onContactClick]);

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-2.5 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <ContactAvatar contact={contact} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{formatContactName(contact)}</p>
          {contact.title && <p className="text-[11px] text-gray-500 truncate">{contact.title}</p>}
        </div>
        {contact.contact_status === "Active" ? (
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Active" />
        ) : contact.contact_status === "Inactive" ? (
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Inactive" />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Contact pipeline Kanban board. Contacts are grouped into columns by their
 * `pipeline_stage` field (a ContactPipelineStage name). Contacts with no stage
 * appear in the first column until dragged. Dragging a card to another column
 * calls onMoveContact(contact, newStageName).
 */
export default function ContactPipelineKanban({ contacts, stages, onMoveContact, onContactClick }) {
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [stages]
  );

  const grouped = useMemo(() => {
    const map = {};
    sortedStages.forEach((s) => { map[s.name] = []; });
    const firstStage = sortedStages[0]?.name;
    for (const c of contacts) {
      const stage = c.pipeline_stage;
      if (stage && map[stage]) map[stage].push(c);
      else if (firstStage) map[firstStage].push(c); // unassigned → first column
    }
    return map;
  }, [contacts, sortedStages]);

  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    const destStage = destination.droppableId;
    const srcStage = source.droppableId;
    if (srcStage === destStage) return; // same column → no-op
    const items = grouped[srcStage] || [];
    const rec = items[source.index];
    if (!rec) return;
    onMoveContact?.(rec, destStage);
  };

  if (sortedStages.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-xl">
        No pipeline stages yet. Click "Manage Stages" to add stages.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 px-1" style={{ minWidth: "max-content" }}>
          {sortedStages.map((stage, idx) => {
            const items = grouped[stage.name] || [];
            const accent = STAGE_ACCENTS[idx % STAGE_ACCENTS.length];
            return (
              <div key={stage.id} className={`flex flex-col w-64 flex-shrink-0 rounded-xl border ${accent}`}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-black/5">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide truncate">{stage.name}</span>
                  <span className="text-[10px] font-semibold text-gray-400 bg-white/70 rounded-full px-1.5">{items.length}</span>
                </div>
                <Droppable droppableId={stage.name}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-white/60" : ""}`}
                    >
                      {items.length === 0 && (
                        <p className="text-[10px] text-gray-400 italic text-center py-3">No contacts</p>
                      )}
                      {items.map((contact, index) => (
                        <Draggable key={contact.id} draggableId={contact.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              style={prov.draggableProps.style}
                              className={snap.isDragging ? "opacity-80 shadow-lg" : "cursor-pointer"}
                            >
                              <ContactCard contact={contact} onContactClick={onContactClick} />
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