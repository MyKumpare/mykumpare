import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSectionLayout, UNCAT_ID } from "./useSectionLayout";
import CategoryNameDialog from "@/components/common/CategoryNameDialog";

/**
 * Generic categorized, drag-and-drop module grid. Mirrors the Monitor /
 * Utility grids so every section shares a consistent layout-adjustment UX:
 * cards can be reordered within a category or dragged across categories, and
 * categories can be created, renamed, reordered, and deleted.
 *
 * Props:
 *  - modules: active module list (role-filtered if needed)
 *  - moduleMap: key -> module metadata
 *  - defaultCategories: default categorization for first load
 *  - storageKey: localStorage key for this section's layout
 *  - onSelect(key): called when a card is clicked
 *  - accentRing: tailwind ring color class applied while dragging (e.g. "ring-indigo-300")
 */
export default function SectionModuleGrid({ modules, moduleMap, defaultCategories, storageKey, onSelect, accentRing = "ring-indigo-300", readOnly = false, onLayoutApi }) {
  const layout = useSectionLayout(modules, defaultCategories, storageKey);
  const { categories, setCategories, addCategory, renameCategory, deleteCategory, moveCategory, onDragEnd } = layout;
  const [dialog, setDialog] = useState({ open: false, mode: "create", id: null, name: "" });

  // Expose the layout API (setCategories) to the parent so it can load saved
  // layouts from the entity into the working state.
  useEffect(() => {
    if (onLayoutApi) onLayoutApi({ setCategories });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLayoutApi]);

  const isLastUserCategory = (idx) => idx >= categories.length - 2; // last before uncat

  if (readOnly) {
    return (
      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat.id} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <h3 className="text-sm font-semibold text-gray-700">{cat.name}</h3>
              <span className="text-xs text-gray-400">({cat.items.length})</span>
            </div>
            {cat.items.length === 0 ? (
              <div className="text-xs text-gray-400 py-6 text-center border-2 border-dashed border-gray-200 rounded-lg">
                {cat.id === UNCAT_ID ? "No unassigned modules" : "No modules in this category"}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cat.items.map((itemKey) => {
                  const mod = moduleMap[itemKey];
                  if (!mod) return null;
                  const Icon = mod.icon;
                  return (
                    <button
                      key={itemKey}
                      onClick={() => onSelect(itemKey)}
                      className="group flex items-center gap-3 p-3 rounded-lg border bg-white text-left transition-all hover:shadow-md hover:border-gray-300"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${mod.bg}`}>
                        <Icon className={`w-5 h-5 ${mod.color}`} />
                      </span>
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{mod.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

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
                      const mod = moduleMap[itemKey];
                      if (!mod) return null;
                      const Icon = mod.icon;
                      return (
                        <Draggable draggableId={itemKey} index={index} key={itemKey}>
                          {(p, s) => (
                            <div
                              ref={p.innerRef}
                              {...p.draggableProps}
                              className={`group relative flex items-stretch rounded-lg border ${mod.border} bg-white overflow-hidden transition-all hover:shadow-md ${s.isDragging ? `shadow-lg ring-2 ${accentRing}` : ""}`}
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