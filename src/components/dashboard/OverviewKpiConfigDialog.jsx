import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff, RotateCcw, Check } from "lucide-react";
import { OVERVIEW_KPIS, DEFAULT_VISIBLE_KPIS } from "./overviewKpis";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function OverviewKpiConfigDialog({
  open,
  onOpenChange,
  currentConfig,
  onSave,
}) {
  const [visible, setVisible] = useState([]);
  const [hidden, setHidden] = useState([]);

  useEffect(() => {
    if (!open) return;
    const visibleKeys = (currentConfig && currentConfig.length ? currentConfig : DEFAULT_VISIBLE_KPIS);
    const visibleSet = new Set(visibleKeys);
    setVisible(OVERVIEW_KPIS.filter((k) => visibleSet.has(k.key)));
    setHidden(OVERVIEW_KPIS.filter((k) => !visibleSet.has(k.key)));
  }, [open, currentConfig]);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(visible);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setVisible(reordered);
  };

  const hideKpi = (key) => {
    setVisible((prev) => prev.filter((k) => k.key !== key));
    setHidden((prev) => [...prev, OVERVIEW_KPIS.find((k) => k.key === key)]);
  };

  const showKpi = (key) => {
    const kpi = OVERVIEW_KPIS.find((k) => k.key === key);
    setHidden((prev) => prev.filter((k) => k.key !== key));
    setVisible((prev) => [...prev, kpi]);
  };

  const handleReset = () => {
    setVisible(OVERVIEW_KPIS);
    setHidden([]);
  };

  const handleSave = () => {
    onSave(visible.map((k) => k.key));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Configure Dashboard KPIs</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-gray-500 -mt-1">
          Choose which metric cards appear on your Overview Dashboard and drag to reorder them.
        </p>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-indigo-500" />
              Shown on dashboard ({visible.length})
            </p>
            {visible.length === 0 ? (
              <p className="text-xs text-gray-400 italic px-1">No KPIs selected — your dashboard will show an empty summary row.</p>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="visible-kpis">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                      {visible.map((kpi, idx) => {
                        const Icon = kpi.icon;
                        return (
                          <Draggable key={kpi.key} draggableId={kpi.key} index={idx}>
                            {(prov) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2"
                              >
                                <span {...prov.dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500">
                                  <GripVertical className="w-4 h-4" />
                                </span>
                                <div className={`w-7 h-7 rounded-md ${kpi.color} flex items-center justify-center flex-shrink-0`}>
                                  <Icon className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="flex-1 text-sm font-medium text-gray-700">{kpi.label}</span>
                                <button
                                  type="button"
                                  onClick={() => hideKpi(kpi.key)}
                                  className="text-gray-300 hover:text-red-500 p-1"
                                  title="Hide from dashboard"
                                >
                                  <EyeOff className="w-4 h-4" />
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
            )}
          </div>

          {hidden.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                Hidden ({hidden.length})
              </p>
              <div className="space-y-1.5">
                {hidden.map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <div
                      key={kpi.key}
                      className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-2.5 py-2"
                    >
                      <div className={`w-7 h-7 rounded-md ${kpi.color} flex items-center justify-center flex-shrink-0 opacity-60`}>
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-500">{kpi.label}</span>
                      <button
                        type="button"
                        onClick={() => showKpi(kpi.key)}
                        className="text-gray-400 hover:text-indigo-600 p-1"
                        title="Show on dashboard"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="text-xs">
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to default
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Check className="w-3.5 h-3.5 mr-1" /> Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}