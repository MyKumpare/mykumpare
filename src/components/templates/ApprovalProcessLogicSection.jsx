import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

let _aplId = 0;
const nextAplId = () => `aplstep_${Date.now()}_${++_aplId}`;

const capitalizeWords = (str) =>
  (str || "").replace(/\b([a-z])/g, (_, c) => c.toUpperCase());

/**
 * Template-level approval process logic definition section.
 * User defines process steps, each referencing a due diligence stage
 * (and optionally a sub-stage) to determine the workflow.
 *
 * Props:
 *   steps: [{ id, name, stage_id, stage_name, sub_stage_id, sub_stage_name }]
 *   stages: [{ id, name, sub_stages: [{ id, name }] }] — the template's stages, used for referencing
 *   onChange: (newSteps) => void
 */
export default function ApprovalProcessLogicSection({ steps = [], stages = [], onChange }) {
  const [newName, setNewName] = useState("");

  const addStep = () => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    onChange([...steps, { id: nextAplId(), name: capitalizeWords(trimmed), stage_id: "", stage_name: "", sub_stage_id: "", sub_stage_name: "" }]);
    setNewName("");
  };

  const updateStep = (id, changes) => {
    onChange(steps.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  };

  const removeStep = (id) => {
    onChange(steps.filter((s) => s.id !== id));
  };

  const handleStageChange = (id, stageId) => {
    const stage = stages.find((s) => s.id === stageId);
    updateStep(id, {
      stage_id: stageId,
      stage_name: stage?.name || "",
      sub_stage_id: "",
      sub_stage_name: "",
    });
  };

  const handleSubStageChange = (id, subStageId) => {
    const stage = stages.find((s) => s.id === steps.find((st) => st.id === id)?.stage_id);
    const sub = stage?.sub_stages?.find((ss) => ss.id === subStageId);
    updateStep(id, {
      sub_stage_id: subStageId,
      sub_stage_name: sub?.name || "",
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const reordered = [...steps];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onChange(reordered);
  };

  return (
    <div className="space-y-3 rounded-md border border-purple-200 bg-purple-50/40 p-3">
      <Label className="text-xs font-medium text-gray-700">Approval Process Logic</Label>
      <p className="text-[10px] text-gray-500">Define approval process steps that reference due diligence stages and sub-stages to determine the workflow.</p>

      {steps.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="approval-logic">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                {steps.map((step, index) => {
                  const stage = stages.find((s) => s.id === step.stage_id);
                  const subStages = stage?.sub_stages || [];
                  return (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(dragProvided) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className="bg-white border border-gray-200 rounded-md px-2 py-1.5 space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5">
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
                              value={step.name || ""}
                              onChange={(e) => updateStep(step.id, { name: e.target.value })}
                              onBlur={(e) => updateStep(step.id, { name: capitalizeWords((e.target.value || "").trim()) })}
                              className="h-7 text-xs flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
                              placeholder="Process step name..."
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-red-600 shrink-0"
                              onClick={() => removeStep(step.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1.5 pl-6">
                            <Link2 className="w-3 h-3 text-gray-400 shrink-0" />
                            <Select
                              value={step.stage_id || ""}
                              onValueChange={(v) => handleStageChange(step.id, v)}
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="Reference stage..." />
                              </SelectTrigger>
                              <SelectContent>
                                {stages.map((s) => (
                                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {subStages.length > 0 && (
                              <Select
                                value={step.sub_stage_id || ""}
                                onValueChange={(v) => handleSubStageChange(step.id, v)}
                              >
                                <SelectTrigger className="h-7 text-xs flex-1">
                                  <SelectValue placeholder="Sub-stage (optional)..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {subStages.map((ss) => (
                                    <SelectItem key={ss.id} value={ss.id} className="text-xs">{ss.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
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

      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } }}
          placeholder="New process step..."
          className="h-7 text-xs flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={addStep}
          disabled={!newName.trim()}
        >
          <Plus className="w-3 h-3" /> Add Step
        </Button>
      </div>
    </div>
  );
}