import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { AlertTriangle, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

let _subId = 0;
const nextSubId = () => `subst_${Date.now()}_${++_subId}`;

const normalize = (s) =>
  (s || "").trim().toLowerCase().replace(/[\s_-]+/g, " ").replace(/[^\w\s]/g, "");

const levenshtein = (a, b) => {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};

const similarity = (a, b) => {
  const na = normalize(a),
    nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
};

const SIMILARITY_THRESHOLD = 0.85;

const capitalizeWords = (str) =>
  (str || "").replace(/\b([a-z])/g, (_, c) => c.toUpperCase());

const findDuplicate = (name, existing, excludeId) => {
  const target = normalize(name);
  if (!target) return null;
  return existing.find((s) => {
    if (s.id === excludeId) return false;
    return similarity(name, s.name) >= SIMILARITY_THRESHOLD;
  });
};

/**
 * Reusable drag-and-drop sub-stages editor for a single due diligence stage.
 * Props:
 *   subStages: [{ id, name, ... }]
 *   onChange: (newSubStages) => void
 *   droppableId: string (unique per stage instance)
 */
export default function SubStagesEditor({ subStages = [], onChange, droppableId = "substages" }) {
  const [newName, setNewName] = useState("");
  const [pendingDup, setPendingDup] = useState(null); // { name, duplicate }

  const addSubStage = (name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const dup = findDuplicate(trimmed, subStages);
    if (dup) {
      setPendingDup({ name: trimmed, duplicate: dup });
      return;
    }
    commitAdd(trimmed);
  };

  const commitAdd = (name) => {
    onChange([
      ...subStages,
      { id: nextSubId(), name: capitalizeWords(name) },
    ]);
    setNewName("");
    setPendingDup(null);
  };

  const renameSubStage = (id, name) => {
    onChange(
      subStages.map((s) => (s.id === id ? { ...s, name } : s))
    );
  };

  const commitSubStage = (id, name) => {
    const capitalized = capitalizeWords((name || "").trim());
    onChange(
      subStages.map((s) => (s.id === id ? { ...s, name: capitalized } : s))
    );
  };

  const removeSubStage = (id) => {
    onChange(subStages.filter((s) => s.id !== id));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const reordered = [...subStages];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onChange(reordered);
  };

  return (
    <div className="space-y-1.5">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={droppableId}>
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-1"
            >
              {subStages.map((ss, index) => (
                <Draggable key={ss.id} draggableId={ss.id} index={index}>
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
                        value={ss.name || ""}
                        onChange={(e) =>
                          renameSubStage(ss.id, e.target.value)
                        }
                        onBlur={(e) =>
                          commitSubStage(ss.id, e.target.value)
                        }
                        className="h-7 text-xs flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
                        placeholder="Sub-stage name..."
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-600 shrink-0"
                        onClick={() => removeSubStage(ss.id)}
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

      {/* Add new sub-stage */}
      <div className="flex items-center gap-1.5">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSubStage(newName);
            }
          }}
          placeholder="New sub-stage..."
          className="h-7 text-xs flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={() => addSubStage(newName)}
          disabled={!newName.trim()}
        >
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>

      {/* Similar duplicate accept/reject prompt */}
      {pendingDup && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700 flex-1 min-w-0">
            &ldquo;{pendingDup.name}&rdquo; is similar to &ldquo;{pendingDup.duplicate.name}&rdquo;. Add anyway?
          </span>
          <Button
            type="button"
            size="sm"
            className="h-6 text-xs bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            onClick={() => commitAdd(pendingDup.name)}
          >
            Accept
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 text-xs shrink-0"
            onClick={() => setPendingDup(null)}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}