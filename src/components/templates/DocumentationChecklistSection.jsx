import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

let _clId = 0;
const nextClId = () => `clitem_${Date.now()}_${++_clId}`;

const capitalizeWords = (str) =>
  (str || "").replace(/\b([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Template-level documentation checklist definition section.
 * User enters how many checklist items they want; the system auto-creates
 * that many blank items, then the user fills in each item name.
 *
 * Props:
 *   items: [{ id, name }]
 *   onChange: (newItems) => void
 */
export default function DocumentationChecklistSection({ items = [], onChange }) {
  const [countInput, setCountInput] = useState(items.length > 0 ? String(items.length) : "");

  const applyCount = (raw) => {
    const n = Math.max(0, Math.min(50, parseInt(raw, 10) || 0));
    setCountInput(raw === "" ? "" : String(n));
    if (n === items.length) return;
    if (n > items.length) {
      const additions = Array.from({ length: n - items.length }, () => ({ id: nextClId(), name: "" }));
      onChange([...items, ...additions]);
    } else {
      onChange(items.slice(0, n));
    }
  };

  const renameItem = (id, name) => {
    onChange(items.map((it) => (it.id === id ? { ...it, name } : it)));
  };

  const commitItem = (id, name) => {
    const capitalized = capitalizeWords((name || "").trim());
    onChange(items.map((it) => (it.id === id ? { ...it, name: capitalized } : it)));
  };

  const removeItem = (id) => {
    const next = items.filter((it) => it.id !== id);
    onChange(next);
    setCountInput(next.length > 0 ? String(next.length) : "");
  };

  const addItem = () => {
    const next = [...items, { id: nextClId(), name: "" }];
    onChange(next);
    setCountInput(String(next.length));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const reordered = [...items];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onChange(reordered);
  };

  return (
    <div className="space-y-3 rounded-md border border-teal-200 bg-teal-50/40 p-3">
      <Label className="text-xs font-medium text-gray-700">Documentation Checklist</Label>

      <div className="space-y-1.5">
        <Label className="text-[10px] text-gray-500">Number of Checklist Items</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={50}
            value={countInput}
            onChange={(e) => setCountInput(e.target.value)}
            onBlur={(e) => applyCount(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCount(e.target.value); } }}
            placeholder="Enter number of items..."
            className="h-8 text-sm w-48"
          />
          <span className="text-xs text-gray-500">{items.length} item{items.length === 1 ? "" : "s"} created</span>
        </div>
      </div>

      {items.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="doc-checklist">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                {items.map((it, index) => (
                  <Draggable key={it.id} draggableId={it.id} index={index}>
                    {(dragProvided) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2 py-1"
                      >
                        <span
                          {...dragProvided.dragHandleProps}
                          className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
                        >
                          <GripVertical className="w-3 h-3" />
                        </span>
                        <span className="text-[11px] text-gray-400 w-5 shrink-0">
                          {index + 1}.
                        </span>
                        <Input
                          value={it.name || ""}
                          onChange={(e) => renameItem(it.id, e.target.value)}
                          onBlur={(e) => commitItem(it.id, e.target.value)}
                          className="h-7 text-xs flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
                          placeholder="Checklist item name..."
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-gray-400 hover:text-red-600 shrink-0"
                          onClick={() => removeItem(it.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={addItem}
      >
        <Plus className="w-3 h-3" /> Add Item
      </Button>
    </div>
  );
}