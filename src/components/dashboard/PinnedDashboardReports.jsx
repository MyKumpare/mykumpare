import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Pin, PinOff, GripVertical } from "lucide-react";
import FirmCategoryBarChart from "./FirmCategoryBarChart";
import DatabaseGrowthChart from "./DatabaseGrowthChart";
import RecentlyAddedFirms from "./RecentlyAddedFirms";

const REPORT_COMPONENTS = {
  "firm-category": {
    title: "Firms by Category",
    render: (firms, onClickCategory) => <FirmCategoryBarChart firms={firms} onClickCategory={onClickCategory} />,
  },
  "database-growth": {
    title: "Database Growth",
    render: (firms) => <DatabaseGrowthChart firms={firms} />,
  },
  "recently-added-firms": {
    title: "Recently Added Firms",
    render: (firms) => <RecentlyAddedFirms firms={firms} />,
  },
};

/**
 * Inline display of the user's pinned dashboard charts, shown at the top of
 * the Dashboard page. Pinned charts render in their stored order and can be
 * drag-reordered (edit mode) or unpinned via the pin-off button.
 */
export default function PinnedDashboardReports({ pinnedKeys, firms, onClickCategory, onReorder, onUnpin, readOnly }) {
  const valid = (pinnedKeys || []).filter((k) => REPORT_COMPONENTS[k]);

  if (valid.length === 0) return null;

  const handleDragEnd = (result) => {
    if (!result.destination || readOnly) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    const next = Array.from(valid);
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    onReorder(next);
  };

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-2">
        <Pin className="w-4 h-4 text-indigo-600" />
        <h2 className="text-sm font-semibold text-gray-700">Pinned Charts</h2>
        <span className="text-xs text-gray-400">({valid.length})</span>
        {!readOnly && (
          <span className="text-xs text-gray-400 ml-1">— drag to reorder, click unpin to remove</span>
        )}
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="pinned-reports" type="pinned">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
              {valid.map((key, index) => {
                const meta = REPORT_COMPONENTS[key];
                return (
                  <Draggable draggableId={key} index={index} key={key}>
                    {(p, s) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${
                          s.isDragging ? "shadow-lg ring-2 ring-indigo-300" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                          <div className="flex items-center gap-2">
                            {!readOnly && (
                              <span
                                {...p.dragHandleProps}
                                className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500"
                              >
                                <GripVertical className="w-4 h-4" />
                              </span>
                            )}
                            <h3 className="text-sm font-semibold text-gray-700">{meta.title}</h3>
                          </div>
                          {!readOnly && (
                            <button
                              onClick={() => onUnpin(key)}
                              className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                              title="Unpin from dashboard"
                            >
                              <PinOff className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="p-4">{meta.render(firms, onClickCategory)}</div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}