import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronUp, ChevronDown, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

/**
 * Dialog for managing contact pipeline stages: add, rename, delete, reorder.
 * Changes are persisted immediately to the ContactPipelineStage entity.
 */
export default function ContactPipelineStageEditor({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const { data: stages = [] } = useQuery({
    queryKey: ["contact_pipeline_stages"],
    queryFn: () => base44.entities.ContactPipelineStage.list("order", 500),
    enabled: open,
  });
  const sorted = [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["contact_pipeline_stages"] });

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const order = sorted.length ? Math.max(...sorted.map((s) => s.order ?? 0)) + 1 : 0;
    try {
      await base44.entities.ContactPipelineStage.create({ name, order });
      setNewName("");
      invalidate();
    } catch (e) {
      toast({ title: "Failed to add stage", description: e?.message, variant: "destructive" });
    }
  };

  const handleRename = async (stage) => {
    const name = editValue.trim();
    if (!name || name === stage.name) { setEditingId(null); return; }
    try {
      await base44.entities.ContactPipelineStage.update(stage.id, { name });
      setEditingId(null);
      invalidate();
    } catch (e) {
      toast({ title: "Failed to rename stage", description: e?.message, variant: "destructive" });
    }
  };

  const handleDelete = async (stage) => {
    try {
      await base44.entities.ContactPipelineStage.delete(stage.id);
      invalidate();
    } catch (e) {
      toast({ title: "Failed to delete stage", description: e?.message, variant: "destructive" });
    }
  };

  const handleMove = async (stage, dir) => {
    const idx = sorted.findIndex((s) => s.id === stage.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    try {
      await base44.entities.ContactPipelineStage.bulkUpdate([
        { id: stage.id, order: swap.order },
        { id: swap.id, order: stage.order },
      ]);
      invalidate();
    } catch (e) {
      toast({ title: "Failed to reorder stage", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Pipeline Stages</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {sorted.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-white">
              <div className="flex flex-col">
                <button onClick={() => handleMove(stage, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move up">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => handleMove(stage, 1)} disabled={idx === sorted.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move down">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              {editingId === stage.id ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(stage)}
                    className="h-8 text-sm flex-1"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRename(stage)} title="Save">
                    <Check className="w-4 h-4 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)} title="Cancel">
                    <X className="w-4 h-4 text-gray-500" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-800 flex-1 truncate">{stage.name}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingId(stage.id); setEditValue(stage.name); }}>
                    Rename
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(stage)} title="Delete">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center py-2">No stages yet. Add your first stage below.</p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="New stage name…"
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" onClick={handleAdd} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}