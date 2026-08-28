import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, StickyNote, RefreshCw, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "primary_scoring", label: "Primary Scoring" },
  { value: "secondary_scoring", label: "Secondary Scoring" },
  { value: "team_review", label: "Team Review" },
  { value: "ic_review", label: "IC Review" },
  { value: "finalized", label: "Finalized" }
];

/**
 * Bulk actions bar for the scoring comparison tables.
 * Appears when one or more scoring records are selected, letting the analyst
 * update the workflow status or assign review notes to several firms at once.
 *
 * Props:
 *   selectedScores - array of { scoreId, firmName } currently selected
 *   onClear        - callback to clear the selection
 *   invalidateKeys - array of react-query keys to invalidate after bulk updates
 */
export default function ScoringBulkActionsBar({ selectedScores, onClear, invalidateKeys = [] }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(null); // "status" | "notes" | null
  const [statusValue, setStatusValue] = useState("");
  const [notesValue, setNotesValue] = useState("");
  const [notesMode, setNotesMode] = useState("replace"); // "replace" | "append"
  const [pending, setPending] = useState(false);

  const count = selectedScores.length;
  if (count === 0) return null;

  const ids = selectedScores.map((s) => s.scoreId);

  const runBulk = async (updates, successMsg) => {
    setPending(true);
    try {
      await base44.entities.ScoringMatrixScore.bulkUpdate(
        ids.map((id) => ({ id, ...updates }))
      );
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      toast({ title: successMsg, description: `Updated ${ids.length} scoring record${ids.length !== 1 ? "s" : ""}.` });
      setMode(null);
      setStatusValue("");
      setNotesValue("");
      onClear?.();
    } catch (err) {
      toast({ title: "Bulk update failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  const handleApplyStatus = () => {
    if (!statusValue) {
      toast({ title: "Select a status", description: "Choose a workflow status to apply.", variant: "destructive" });
      return;
    }
    runBulk({ status: statusValue }, "Status updated");
  };

  const handleApplyNotes = () => {
    if (!notesValue.trim()) {
      toast({ title: "Notes empty", description: "Enter the notes to assign to the selected firms.", variant: "destructive" });
      return;
    }
    if (notesMode === "append") {
      // Append requires per-record read+update; do individual updates.
      setPending(true);
      Promise.all(
        selectedScores.map(async (s) => {
          const existing = s.reviewNotes || "";
          const combined = existing ? `${existing}\n\n${notesValue.trim()}` : notesValue.trim();
          return base44.entities.ScoringMatrixScore.update(s.scoreId, { review_notes: combined });
        })
      )
        .then(() => {
          invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
          toast({ title: "Notes appended", description: `Updated ${selectedScores.length} scoring record${selectedScores.length !== 1 ? "s" : ""}.` });
          setMode(null);
          setNotesValue("");
          onClear?.();
        })
        .catch((err) => {
          toast({ title: "Bulk update failed", description: err?.message || "Please try again.", variant: "destructive" });
        })
        .finally(() => setPending(false));
    } else {
      runBulk({ review_notes: notesValue.trim() }, "Notes assigned");
    }
  };

  return (
    <div className="border border-indigo-300 rounded-lg bg-indigo-50/60 p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-indigo-600 text-white">{count} selected</Badge>
          <span className="text-xs text-gray-500">
            {selectedScores.slice(0, 3).map((s) => s.firmName).join(", ")}
            {count > 3 && ` +${count - 3} more`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={mode === "status" ? "default" : "outline"} onClick={() => setMode(mode === "status" ? null : "status")} disabled={pending}>
            <RefreshCw className="w-3.5 h-3.5" /> Set Status
          </Button>
          <Button size="sm" variant={mode === "notes" ? "default" : "outline"} onClick={() => setMode(mode === "notes" ? null : "notes")} disabled={pending}>
            <StickyNote className="w-3.5 h-3.5" /> Assign Notes
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear} disabled={pending} className="text-gray-500">
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        </div>
      </div>

      {mode === "status" && (
        <div className="flex items-end gap-2 flex-wrap pt-1 border-t border-indigo-200">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-gray-600">Workflow Status</Label>
            <Select value={statusValue} onValueChange={setStatusValue}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose status…" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleApplyStatus} disabled={pending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Apply to {count}
          </Button>
        </div>
      )}

      {mode === "notes" && (
        <div className="space-y-2 pt-1 border-t border-indigo-200">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-gray-600">Notes Mode</Label>
            <Select value={notesMode} onValueChange={setNotesMode}>
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Replace existing</SelectItem>
                <SelectItem value="append">Append to existing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Enter the qualitative feedback to assign to all selected firms…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleApplyNotes} disabled={pending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Apply to {count}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}