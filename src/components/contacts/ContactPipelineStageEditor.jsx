import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronUp, ChevronDown, Check, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

/**
 * Dialog for managing contact pipeline stages: add, rename, delete, reorder.
 * Stages are scoped per firm type so each investment entity can have its own
 * allocation workflow. "General (all firm types)" is the shared default pipeline.
 * Changes are persisted immediately to the ContactPipelineStage entity.
 */
export default function ContactPipelineStageEditor({ open, onOpenChange, defaultFirmType = "" }) {
  const queryClient = useQueryClient();
  const [scopeFirmType, setScopeFirmType] = useState(defaultFirmType);

  // Sync the editor's scope to whichever firm type the Kanban is showing when opened.
  useEffect(() => {
    if (open) setScopeFirmType(defaultFirmType);
  }, [open, defaultFirmType]);

  const { data: stages = [] } = useQuery({
    queryKey: ["contact_pipeline_stages"],
    queryFn: () => base44.entities.ContactPipelineStage.list("order", 500),
    enabled: open,
  });

  const scoped = stages
    .filter((s) => (s.firm_type || "") === scopeFirmType)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["contact_pipeline_stages"] });
  const scopeLabel = scopeFirmType || "General (all firm types)";

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const order = scoped.length ? Math.max(...scoped.map((s) => s.order ?? 0)) + 1 : 0;
    try {
      await base44.entities.ContactPipelineStage.create({ name, order, firm_type: scopeFirmType || undefined });
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
    const idx = scoped.findIndex((s) => s.id === stage.id);
    const swap = scoped[idx + dir];
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

        {/* Firm-type scope selector */}
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-600 whitespace-nowrap">Pipeline for:</span>
          <select
            value={scopeFirmType}
            onChange={(e) => setScopeFirmType(e.target.value)}
            className="h-8 text-sm rounded-md border border-gray-200 bg-white px-2 outline-none focus:border-indigo-400 flex-1"
          >
            <option value="">General (all firm types)</option>
            {FIRM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <p className="text-[11px] text-gray-400 -mt-1">
          These stages define the <span className="font-medium text-gray-500">{scopeLabel}</span> workflow. Switch the firm type above to customize a different pipeline.
        </p>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {scoped.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-white">
              <div className="flex flex-col">
                <button onClick={() => handleMove(stage, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move up">
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => handleMove(stage, 1)} disabled={idx === scoped.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Move down">
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
          {scoped.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center py-2">No stages for {scopeLabel} yet. Add your first stage below.</p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={`New stage for ${scopeLabel}…`}
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