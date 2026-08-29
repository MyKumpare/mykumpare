import React, { useState } from "react";
import { Plus, Trash2, Flag, Check, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

let _milestoneIdCounter = 0;
const nextMilestoneId = () => `ms_${Date.now()}_${++_milestoneIdCounter}`;

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Reusable milestone tracking panel for due diligence records.
 * Lets users add, complete, edit, and delete custom progress milestones
 * independent of the kanban stage workflow.
 *
 * Props:
 *   milestones: [{ id, name, description, target_date, completed_date, completed }]
 *   onChange: (newMilestones) => void
 *   currentUserName: string  — denormalized into created_by_name for new milestones
 */
export default function DdMilestonesPanel({ milestones = [], onChange, currentUserName = "" }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const sorted = [...milestones].sort((a, b) => {
    // Completed milestones sink to the bottom; incomplete ones stay on top
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });
  const completedCount = milestones.filter((m) => m.completed).length;
  const totalCount = milestones.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const ms = {
      id: nextMilestoneId(),
      name,
      description: newDesc.trim() || undefined,
      target_date: newDate || undefined,
      completed: false,
      completed_date: undefined,
      created_date: new Date().toISOString(),
      created_by_name: currentUserName || undefined,
    };
    onChange([...milestones, ms]);
    setNewName("");
    setNewDate("");
    setNewDesc("");
    setAdding(false);
  };

  const handleCancelAdd = () => {
    setNewName("");
    setNewDate("");
    setNewDesc("");
    setAdding(false);
  };

  const toggleComplete = (id) => {
    onChange(
      milestones.map((m) =>
        m.id === id
          ? {
              ...m,
              completed: !m.completed,
              completed_date: !m.completed ? todayStr() : undefined,
            }
          : m
      )
    );
  };

  const handleDelete = (id) => {
    onChange(milestones.filter((m) => m.id !== id));
  };

  const handleEditName = (id, name) => {
    onChange(milestones.map((m) => (m.id === id ? { ...m, name } : m)));
  };

  const handleEditDate = (id, target_date) => {
    onChange(milestones.map((m) => (m.id === id ? { ...m, target_date: target_date || undefined } : m)));
  };

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2.5">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Flag className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-gray-800">Milestones</span>
          {totalCount > 0 && (
            <span className="text-xs text-gray-500 ml-1">
              {completedCount}/{totalCount} completed
            </span>
          )}
        </div>
        {!adding && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100"
            onClick={() => setAdding(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Add Milestone
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Add new milestone form */}
      {adding && (
        <div className="space-y-2 p-2.5 rounded-md bg-white border border-indigo-200">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Milestone Name</Label>
            <Input
              autoFocus
              placeholder="e.g. Initial call completed"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") handleCancelAdd();
              }}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs font-medium text-gray-700">Target Date</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-gray-700">Notes (optional)</Label>
            <Textarea
              placeholder="Add details about this milestone..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="text-sm min-h-[50px] resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancelAdd}>
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleAdd}
              disabled={!newName.trim()}
            >
              <Check className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        </div>
      )}

      {/* Milestone list */}
      {sorted.length === 0 && !adding && (
        <p className="text-xs text-gray-400 italic text-center py-2">
          No milestones yet. Track key progress points beyond the kanban stages.
        </p>
      )}

      {sorted.length > 0 && (
        <div className="space-y-1.5">
          {sorted.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex items-start gap-2 p-2 rounded-md border transition-colors",
                m.completed
                  ? "bg-emerald-50/50 border-emerald-200"
                  : "bg-white border-gray-200 hover:border-indigo-300"
              )}
            >
              {/* Complete toggle */}
              <button
                type="button"
                onClick={() => toggleComplete(m.id)}
                className={cn(
                  "mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors",
                  m.completed
                    ? "bg-emerald-500 border-emerald-500 border"
                    : "bg-white border-gray-300 border hover:border-indigo-400"
                )}
              >
                {m.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </button>

              {/* Milestone content */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => handleEditName(m.id, e.target.value)}
                  className={cn(
                    "w-full bg-transparent text-sm font-medium border-none outline-none px-0 py-0 focus:bg-gray-50 rounded px-1 -mx-1",
                    m.completed ? "text-gray-400 line-through" : "text-gray-800"
                  )}
                />
                {m.description && (
                  <p className="text-xs text-gray-500 px-1 -mx-1">{m.description}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  {m.target_date && (
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      Target: {new Date(m.target_date).toLocaleDateString("en-US")}
                    </span>
                  )}
                  {m.completed && m.completed_date && (
                    <span className="flex items-center gap-0.5 text-emerald-600">
                      <Check className="w-3 h-3" />
                      Done: {new Date(m.completed_date).toLocaleDateString("en-US")}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleDelete(m.id)}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                title="Delete milestone"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}