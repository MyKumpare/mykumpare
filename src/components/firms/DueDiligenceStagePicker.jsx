import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, Check, Plus, Pencil, Trash2, ArrowUp, ArrowDown, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDueDiligenceStages,
  DD_STAGE_NOT_STARTED,
  formatStageLabel,
} from "./useDueDiligenceStages";

// --- similarity helpers (for duplicate detection when adding a stage) ---
function levenshtein(s1, s2) {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
function areSimilar(a, b) {
  const s1 = (a || "").toLowerCase().trim();
  const s2 = (b || "").toLowerCase().trim();
  if (!s1 || !s2) return false;
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  const dist = levenshtein(s1, s2);
  const max = Math.max(s1.length, s2.length);
  return max > 3 && dist / max < 0.2;
}

// Stage picker dropdown with add / edit / delete / re-order and duplicate
// validation. The selected value stored on the DueDiligence record is the
// stage NAME (or "Not Started"). The "Stage N" number is derived from the
// stage's position in the ordered master list, so re-ordering automatically
// re-numbers every stage with no duplicates possible.
export default function DueDiligenceStagePicker({ value = "", onChange, disabled = false }) {
  const queryClient = useQueryClient();
  const { stages } = useDueDiligenceStages();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [similar, setSimilar] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["due-diligence-stages"] });

  const sorted = useMemo(() => [...stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [stages]);
  const currentLabel = formatStageLabel(value, sorted);
  const isNotStarted = !value || value === DD_STAGE_NOT_STARTED;

  // --- add ---
  const attemptAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const exact = sorted.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (exact) {
      window.alert(`"${exact.name}" already exists. Select it from the list instead.`);
      return;
    }
    const sim = sorted.filter((s) => areSimilar(name, s.name));
    if (sim.length > 0) {
      setSimilar(sim.map((s) => s.name));
      return;
    }
    finalizeAdd(name);
  };
  const finalizeAdd = async (name) => {
    const pos = sorted.length ? Math.max(...sorted.map((s) => s.position ?? 0)) + 1 : 1;
    try {
      await base44.entities.DueDiligenceStage.create({ name, position: pos });
      invalidate();
      onChange(name);
    } catch (e) {
      console.error("Failed to create stage:", e);
    }
    setAdding(false);
    setNewName("");
    setSimilar([]);
    setOpen(false);
  };

  // --- reorder (swap positions of two adjacent stages) ---
  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[j];
    try {
      await base44.entities.DueDiligenceStage.update(a.id, { position: b.position });
      await base44.entities.DueDiligenceStage.update(b.id, { position: a.position });
      invalidate();
    } catch (e) {
      console.error("Failed to reorder stage:", e);
    }
  };

  // --- edit name ---
  const startEdit = (s) => { setEditId(s.id); setEditName(s.name); };
  const saveEdit = async () => {
    const name = editName.trim();
    const rec = sorted.find((s) => s.id === editId);
    if (!rec) { setEditId(null); return; }
    if (!name) { setEditId(null); return; }
    const dup = sorted.find((s) => s.id !== editId && s.name.toLowerCase() === name.toLowerCase());
    if (dup) {
      window.alert(`"${name}" already exists.`);
      return;
    }
    try {
      await base44.entities.DueDiligenceStage.update(editId, { name });
      if (value === rec.name) onChange(name); // keep the selected record in sync
      invalidate();
    } catch (e) {
      console.error("Failed to rename stage:", e);
    }
    setEditId(null);
    setEditName("");
  };

  // --- delete ---
  const confirmDelete = async () => {
    const rec = deleting;
    try {
      await base44.entities.DueDiligenceStage.delete(rec.id);
      if (value === rec.name) onChange(DD_STAGE_NOT_STARTED);
      invalidate();
    } catch (e) {
      console.error("Failed to delete stage:", e);
    }
    setDeleting(null);
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setAdding(false); setSimilar([]); setEditId(null); } }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between h-9 text-sm font-normal"
        >
          <span className={isNotStarted ? "text-gray-400" : "text-gray-900"}>{currentLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        {adding && similar.length === 0 ? (
          // add-new form
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Add New Stage</p>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter stage name..."
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") attemptAdd();
                if (e.key === "Escape") { setAdding(false); setNewName(""); }
              }}
            />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setAdding(false); setNewName(""); }}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!newName.trim()} onClick={attemptAdd}>
                Add Stage
              </Button>
            </div>
          </div>
        ) : similar.length > 0 ? (
          // duplicate-warning: approve adding anyway or reject
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-semibold text-gray-800">Similar stages found</h4>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {similar.map((nm) => (
                <div key={nm} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                  <span className="text-sm text-amber-900 truncate">{nm}</span>
                  <button
                    type="button"
                    className="text-xs text-amber-700 hover:text-amber-900 hover:underline shrink-0 ml-2"
                    onClick={() => { onChange(nm); setSimilar([]); setAdding(false); setNewName(""); setOpen(false); }}
                  >
                    Use this
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600">
              Add <span className="font-semibold">"{newName.trim()}"</span> as a new stage anyway?
            </p>
            <div className="flex gap-2 justify-end pt-1 border-t border-gray-100">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setSimilar([]); }}>
                Cancel &amp; Edit
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => finalizeAdd(newName.trim())}>
                Add Anyway
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* selectable list */}
            <div className="max-h-72 overflow-y-auto py-1">
              {/* Not Started option */}
              <button
                type="button"
                onClick={() => { onChange(DD_STAGE_NOT_STARTED); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Check className={cn("w-3.5 h-3.5 shrink-0", isNotStarted ? "opacity-100 text-indigo-600" : "opacity-0")} />
                <span className="text-gray-500 italic">Not Started</span>
              </button>

              {/* stages in order */}
              {sorted.length === 0 ? (
                <div className="px-3 py-3 text-xs text-gray-400 italic text-center">No stages defined yet.</div>
              ) : (
                sorted.map((s, idx) => {
                  const selected = value === s.name;
                  const isEditingThis = editId === s.id;
                  return (
                    <div key={s.id} className="w-full flex items-center gap-1 px-2 py-1 hover:bg-gray-50">
                      {isEditingThis ? (
                        <Input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") { setEditId(null); setEditName(""); }
                          }}
                          className="h-7 text-sm flex-1"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { onChange(s.name); setOpen(false); }}
                          className={cn("flex-1 flex items-center gap-2 text-sm truncate text-left", selected ? "text-indigo-700" : "text-gray-700")}
                        >
                          <Check className={cn("w-3.5 h-3.5 shrink-0", selected ? "opacity-100 text-indigo-600" : "opacity-0")} />
                          <span className="truncate">Stage {idx + 1} - {s.name}</span>
                        </button>
                      )}
                      {isEditingThis ? (
                        <button type="button" onClick={saveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Save">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <>
                          <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 text-gray-300 hover:text-indigo-600 disabled:opacity-30 rounded" title="Move up">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => move(idx, 1)} disabled={idx === sorted.length - 1} className="p-1 text-gray-300 hover:text-indigo-600 disabled:opacity-30 rounded" title="Move down">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => startEdit(s)} className="p-1 text-gray-300 hover:text-indigo-600 rounded" title="Rename">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button type="button" onClick={() => setDeleting(s)} className="p-1 text-gray-300 hover:text-red-600 rounded" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* add footer */}
            <div className="border-t">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="w-full text-left px-3 py-2 text-xs text-indigo-600 hover:bg-indigo-50 flex items-center gap-1.5 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add new stage
              </button>
            </div>
          </>
        )}

        {/* delete confirmation */}
        {deleting && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-lg">
            <div className="bg-white rounded-xl shadow-xl p-4 w-[90%] max-w-xs mx-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-800">Delete Stage?</h4>
              </div>
              <p className="text-xs text-gray-600 mb-4">
                Delete <span className="font-semibold">{formatStageLabel(deleting.name, sorted)}</span>? Due diligence records currently at this stage will reset to "Not Started".
              </p>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleting(null)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={confirmDelete}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}