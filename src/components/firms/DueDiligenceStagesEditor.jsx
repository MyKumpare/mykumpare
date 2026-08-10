import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { AlertCircle, ChevronDown, ChevronRight, GripVertical, Plus, Trash2, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SubStagesEditor from "./SubStagesEditor";
import PushToQuestionBankDialog from "@/components/templates/PushToQuestionBankDialog";

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

// Capitalize the first letter of each word
const capitalizeWords = (str) =>
  (str || "").replace(/\b([a-z])/g, (_, c) => c.toUpperCase());

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
export default function DueDiligenceStagesEditor({ stages, onChange, headerTitle = "Due Diligence Stages" }) {
  const [newStageName, setNewStageName] = useState("");
  const [error, setError] = useState("");
  const [expandedStages, setExpandedStages] = useState({});
  const [pushStage, setPushStage] = useState(null);
  const toggleExpand = (id) => setExpandedStages((prev) => ({ ...prev, [id]: !prev[id] }));
  const allExpanded = stages.length > 0 && stages.every((s) => expandedStages[s.id]);
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedStages({});
    } else {
      const next = {};
      stages.forEach((s) => { next[s.id] = true; });
      setExpandedStages(next);
    }
  };

  const addStage = (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const dup = findDuplicate(trimmed, stages);
    if (dup) {
      setError(`"${trimmed}" is too similar to existing stage "${dup.name}"`);
      return;
    }
    onChange([...stages, { id: nextStageId(), name: capitalizeWords(trimmed) }]);
    setNewStageName("");
    setError("");
  };

  // Store raw value (preserve spaces during typing); duplicate check uses normalized value
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
    onChange(stages.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  // On blur: capitalize first letter of each word and trim
  const commitStage = (id, name) => {
    const capitalized = capitalizeWords((name || "").trim());
    onChange(stages.map((s) => (s.id === id ? { ...s, name: capitalized } : s)));
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
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700">{headerTitle}</Label>
        {stages.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-gray-500 hover:text-gray-700 px-2"
            onClick={toggleAll}
          >
            {allExpanded ? (
              <><ChevronDown className="w-3 h-3" /> Collapse All</>
            ) : (
              <><ChevronRight className="w-3 h-3" /> Expand All</>
            )}
          </Button>
        )}
      </div>

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
                      className="bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          {...dragProvided.dragHandleProps}
                          className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExpand(stage.id)}
                          className="text-gray-400 hover:text-gray-600 shrink-0"
                        >
                          {expandedStages[stage.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-xs font-medium text-gray-500 shrink-0 w-16">
                          Stage {index + 1}
                        </span>
                        <Input
                          value={stage.name}
                          onChange={(e) => renameStage(stage.id, e.target.value)}
                          onBlur={(e) => commitStage(stage.id, e.target.value)}
                          className="h-8 text-sm flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
                          placeholder="Define stage..."
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-400 hover:text-cyan-600 shrink-0"
                          title="Push to Question Bank"
                          onClick={() => setPushStage(stage.name)}
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                        </Button>
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
                      {expandedStages[stage.id] && (
                        <div className="pl-6">
                          <SubStagesEditor
                            subStages={stage.sub_stages || []}
                            droppableId={`tmpl-subst-${stage.id}`}
                            onChange={(newSubs) =>
                              onChange(stages.map((s) => (s.id === stage.id ? { ...s, sub_stages: newSubs } : s)))
                            }
                          />
                        </div>
                      )}
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

      {pushStage && (
        <PushToQuestionBankDialog
          open={!!pushStage}
          onOpenChange={(o) => { if (!o) setPushStage(null); }}
          initialText={pushStage}
        />
      )}
    </div>
  );
}