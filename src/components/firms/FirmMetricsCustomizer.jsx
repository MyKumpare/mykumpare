import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";

/**
 * Modal customizer for the Firm Metrics comparison table.
 * Lets users toggle which metric rows are visible and reorder them via drag-and-drop.
 *
 * Props:
 *  - rows: master list of metric definitions [{ id, label, icon }, ...]
 *  - order: array of metric ids in display order
 *  - enabled: array of currently-enabled metric ids
 *  - onOrderChange(newOrder)
 *  - onEnabledChange(newEnabled)
 *  - onReset()
 */
export default function FirmMetricsCustomizer({
  open,
  onOpenChange,
  rows,
  order,
  enabled,
  onOrderChange,
  onEnabledChange,
  onReset,
}) {
  const [localOrder, setLocalOrder] = useState(order);
  const [localEnabled, setLocalEnabled] = useState(enabled);

  // Sync local state when the dialog opens
  useEffect(() => {
    if (open) {
      setLocalOrder(order);
      setLocalEnabled(enabled);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => {
    setLocalEnabled((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(localOrder);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setLocalOrder(next);
  };

  const handleSave = () => {
    onOrderChange(localOrder);
    onEnabledChange(localEnabled);
    onOpenChange(false);
  };

  const handleReset = () => {
    const defaultOrder = rows.map((r) => r.id);
    const defaultEnabled = rows.map((r) => r.id);
    setLocalOrder(defaultOrder);
    setLocalEnabled(defaultEnabled);
  };

  const orderedRows = localOrder
    .map((id) => rows.find((r) => r.id === id))
    .filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Key Metrics</DialogTitle>
          <p className="text-sm text-gray-500 -mt-1">
            Toggle which metrics appear and drag to reorder them.
          </p>
        </DialogHeader>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="metrics-order">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="max-h-[50vh] overflow-y-auto space-y-1 pr-1"
              >
                {orderedRows.map((row, index) => {
                  const isEnabled = localEnabled.includes(row.id);
                  return (
                    <Draggable
                      key={row.id}
                      draggableId={row.id}
                      index={index}
                    >
                      {(p, snapshot) => (
                        <div
                          ref={p.innerRef}
                          {...p.draggableProps}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors ${
                            snapshot.isDragging
                              ? "border-indigo-300 bg-indigo-50 shadow-sm"
                              : isEnabled
                              ? "border-gray-200 bg-white"
                              : "border-gray-200 bg-gray-50 opacity-60"
                          }`}
                        >
                          <span
                            {...p.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <row.icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="flex-1 text-sm text-gray-700 truncate">
                            {row.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggle(row.id)}
                            className={`flex-shrink-0 p-1 rounded-md transition-colors ${
                              isEnabled
                                ? "text-indigo-600 hover:bg-indigo-50"
                                : "text-gray-400 hover:bg-gray-100"
                            }`}
                            title={isEnabled ? "Hide metric" : "Show metric"}
                          >
                            {isEnabled ? (
                              <Eye className="w-4 h-4" />
                            ) : (
                              <EyeOff className="w-4 h-4" />
                            )}
                          </button>
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

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-gray-500"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to default
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Apply
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}