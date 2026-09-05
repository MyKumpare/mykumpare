import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODULE_MAP } from "./monitorModules";
import { useMonitorLayout, UNCAT_ID } from "./useMonitorLayout";
import CategoryNameDialog from "@/components/common/CategoryNameDialog";

/**
 * Categorized, drag-and-drop grid of Monitor modules. 3 cards per row.
 * Cards can be reordered within a category or dragged across categories.
 * Categories can be created, renamed, reordered, and deleted (items fall back
 * to the system "Uncategorized" bucket).
 *
 * onLayoutApi: optional callback invoked with { setCategories } so the parent
 * can load a saved layout into the grid.
 */
export default function MonitorModuleGrid({ onSelect, onLayoutApi }) {
  const { categories, setCategories, addCategory, renameCategory, deleteCategory, moveCategory, onDragEnd } = useMonitorLayout();
  const [dialog, setDialog] = useState({ open: false, mode: "create", id: null, name: "" });

  useEffect(() => {
    if (onLayoutApi) onLayoutApi({ setCategories });
  }, [onLayoutApi, setCategories]);

  const isLastUserCategory = (idx) => idx >= categories.length - 2; // last before uncat

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          Drag the grip to reorder cards or move them between categories. Click a card to open it.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog({ open: true, mode: "create", id: null, name: "" })}
        >
          <Plus className="w-4 h-4" /> New Category
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        {categories.map((cat, catIdx) => (
          <Droppable droppableId={cat.id} type="item" key={cat.id}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-700">{cat.name}</h3>
                    <span className="text-xs text-gray-400">({cat.items.length})</span>
                  </div>
                  {!cat.isSystem && (
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={catIdx === 0}
                        onClick={() => moveCategory(cat.id, "up")}
                        title="Move category up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={isLastUserCategory(catIdx)}
                        onClick={() => moveCategory(cat.id, "down")}
                        title="Move category down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDialog({ open: true, mode: "edit", id: cat.id, name: cat.name })}
                        title="Rename category"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        disabled={cat.items.length > 0}
                        onClick={() => deleteCategory(cat.id)}
                        title={cat.items.length > 0 ? "Move all items to another category first" : "Delete category"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {cat.items.length === 0 ? (
                  <div className="text-xs text-gray-400 py-6 text-center border-2 border-dashed border-gray-200 rounded-lg">
                    {cat.id === UNCAT_ID ? "No unassigned modules" : "Drag modules here"}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cat.items.map((itemKey, index) => {
                      const mod = MODULE_MAP[itemKey];
                      if (!mod) return null;
                      const Icon = mod.icon;
                      return (
                        <Draggable draggableId={itemKey} index={index} key={itemKey}>
                          {(p, s) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              className={`group relative flex items-stretch rounded-lg border ${mod.border} bg-white overflow-hidden transition-all hover:shadow-md ${s.isDragging ? "shadow-lg ring-2 ring-rose-300" : ""}`}
                            >
                              <button
                                onClick={() => onSelect(itemKey)}
                                className="flex items-center gap-3 flex-1 p-3 text-left"
                              >
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${mod.bg}`}>
                                  <Icon className={`w-5 h-5 ${mod.color}`} />
                                </span>
                                <span className="text-sm font-semibold text-gray-800">{mod.label}</span>
                              </button>
                              <span
                                {...p.dragHandleProps}
                                className="flex items-center justify-center px-2 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 border-l border-gray-100"
                                title="Drag to reorder"
                              >
                                <GripVertical className="w-4 h-4" />
                              </span>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </DragDropContext>

      <CategoryNameDialog
        open={dialog.open}
        mode={dialog.mode}
        initialName={dialog.name}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSave={(name) => {
          if (dialog.mode === "create") addCategory(name);
          else renameCategory(dialog.id, name);
          setDialog((d) => ({ ...d, open: false }));
        }}
      />
    </div>
  );
}