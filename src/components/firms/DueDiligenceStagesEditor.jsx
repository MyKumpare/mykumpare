import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { AlertCircle, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

let _stageIdCounter = 0;
const nextStageId = () => `stage_${Date.now()}_${++_stageIdCounter}`;

const normalize = (s) => (s || "").trim().toLowerCase().replace(/[\s_-]+/g, " ").replace(/[^\w\s]/g, "");

const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
};

// Returns 0..1 similarity ratio between two names (1 = identical)
const similarity = (a, b) => {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
};

const SIMILARITY_THRESHOLD = 0.85;

// Find a stage in `existing` that is an exact or similar match to `name` (excluding `excludeId`)
const findDuplicate = (name, existing, excludeId) => {
  const target = normalize(name);
  if (!target) return null;
  return existing.find((s) => {
    if (s.id === excludeId) return false;
    return similarity(name, s.name) >= SIMILARITY_THRESHOLD;
  });
};

/**
 * Reusable drag-and-drop stages editor for due diligence records.
 * Props:
 *   stages: [{ id, name }]
 *   onChange: (newStages) => void
 */
export default function DueDiligenceStagesEditor({ stages, onChange }) {
  const [newStageName, setNewStageName] = useState("");
  const [error, setError] = useState("");

  const addStage = (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const dup = findDuplicate(trimmed, stages);
    if (dup) {
      setError(`"${trimmed}" is too similar to existing stage "${dup.name}"`);
      return;
    }
    onChange([...stages, { id: nextStageId(), name: trimmed }]);
    setNewStageName("");
    setError("");
  };

  const renameStage = (id, name) => {
    const trimmed = (name || "").trim();
    if (trimmed) {
      const dup = findDuplicate(trimmed, stages, id);
      if (dup) {
        setError(`"${trimmed}" is too similar to existing stage "${dup.name}"`);
        return;
      }
    }
    setError("");
    onChange(stages.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
  };

  const removeStage = (id) => {
    onChange(stages.filter((s) => s.id !== id));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const reordered = [...stages];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onChange(reordered);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-gray-700">Due Diligence Stages</Label>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="stages-list">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
              {stages.map((stage, index) => (
                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                  {(dragProvided) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5"
                    >
                      <span
                        {...dragProvided.dragHandleProps}
                        className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
                      >
                        <GripVertical className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-medium text-gray-500 shrink-0 w-16">
                        Stage {index + 1}
                      </span>
                      <Input
                        value={stage.name}
                        onChange={(e) => renameStage(stage.id, e.target.value)}
                        className="h-8 text-sm flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
                        placeholder="Define stage..."
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-600 shrink-0"
                        onClick={() => removeStage(stage.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add new stage */}
      <div className="flex items-center gap-2">
        <Input
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(newStageName); } }}
          placeholder="New stage name..."
          className="h-8 text-sm flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs shrink-0"
          onClick={() => addStage(newStageName)}
          disabled={!newStageName.trim()}
        >
          <Plus className="w-3.5 h-3.5" /> Add Stage
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}