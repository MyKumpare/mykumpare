import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, Trash2, GitCompareArrows, X, Check, Calendar, Layers } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";
import { buildSnapshotPayload, computeWeightedScore } from "./scoringSnapshotUtils";
import ScoringMatrixSnapshotCompare from "./ScoringMatrixSnapshotCompare";

/**
 * Snapshots tab for a ScoringMatrixScore record.
 * Lets the analyst save point-in-time copies of the current scoring matrix
 * (with a label + optional note), list all saved snapshots, and compare any
 * two snapshots side-by-side (or a snapshot against the live score).
 *
 * Props:
 *   score - the current ScoringMatrixScore record
 */
export default function ScoringMatrixSnapshotsTab({ score }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [compareIds, setCompareIds] = useState([]); // [idA, idB] — empty until user picks 2
  const [compareOpen, setCompareOpen] = useState(false);

  const queryKey = ["scoringMatrixSnapshots", score?.id];

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      base44.entities.ScoringMatrixSnapshot.filter({ score_id: score.id }, "-created_date", 200),
    enabled: !!score?.id
  });

  const createMutation = useMutation({
    mutationFn: (payload) => base44.entities.ScoringMatrixSnapshot.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setLabel("");
      setDescription("");
      toast({ title: "Snapshot saved", description: "The current scoring state has been captured." });
    },
    onError: (err) => {
      toast({ title: "Failed to save snapshot", description: err?.message || "Please try again.", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScoringMatrixSnapshot.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Snapshot deleted" });
    },
    onError: (err) => {
      toast({ title: "Failed to delete snapshot", description: err?.message || "Please try again.", variant: "destructive" });
    }
  });

  const handleSave = () => {
    if (!label.trim()) {
      toast({ title: "Label required", description: "Give this snapshot a name (e.g. 'Pre-Team Review').", variant: "destructive" });
      return;
    }
    createMutation.mutate(buildSnapshotPayload(score, { label: label.trim(), description: description.trim() }));
  };

  const liveWeightedFinal = useMemo(
    () => computeWeightedScore(score?.scoring_blocks, "final_score"),
    [score]
  );

  const handleCompare = () => {
    if (compareIds.length !== 2) {
      toast({ title: "Select two snapshots", description: "Pick exactly two snapshots to compare side-by-side.", variant: "destructive" });
      return;
    }
    setCompareOpen(true);
  };

  const toggleComparePick = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // replace oldest
      return [...prev, id];
    });
  };

  const selectedSnapshots = snapshots.filter((s) => compareIds.includes(s.id));
  // Sort by created_date so A is older than B
  const [snapA, snapB] = [...selectedSnapshots].sort(
    (a, b) => new Date(a.created_date) - new Date(b.created_date)
  );

  return (
    <div className="space-y-4">
      {/* Save snapshot panel */}
      <div className="border border-teal-200 rounded-lg p-4 bg-teal-50/40">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-4 h-4 text-teal-600" />
          <h4 className="text-sm font-semibold text-gray-800">Save Snapshot</h4>
          <span className="text-xs text-gray-500">— capture the current scoring state to compare later</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          <div className="md:col-span-1">
            <Label className="text-xs text-gray-600">Label *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Pre-Team Review"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-gray-600">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why are you saving this snapshot? (e.g. before sending to IC)"
              rows={1}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Badge variant="outline" className="text-[10px]">Current status: {score?.status || "draft"}</Badge>
            {liveWeightedFinal != null && (
              <Badge variant="outline" className="text-[10px]">Live weighted final: {liveWeightedFinal}</Badge>
            )}
          </div>
          <Button size="sm" onClick={handleSave} disabled={createMutation.isPending} className="bg-teal-600 hover:bg-teal-700 text-white">
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            Save Snapshot
          </Button>
        </div>
      </div>

      {/* Snapshots list */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-700">Saved Snapshots</h4>
            <span className="text-xs text-gray-400">({snapshots.length})</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCompare}
            disabled={compareIds.length !== 2}
            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
          >
            <GitCompareArrows className="w-3.5 h-3.5" /> Compare ({compareIds.length}/2)
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading snapshots…
          </div>
        ) : snapshots.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            No snapshots saved yet. Save one above to start tracking review versions over time.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {snapshots.map((snap) => {
              const selected = compareIds.includes(snap.id);
              return (
                <div key={snap.id} className={`px-4 py-3 hover:bg-gray-50 transition-colors ${selected ? "bg-indigo-50/50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleComparePick(snap.id)}
                      className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${selected ? "bg-indigo-600 border-indigo-600 text-white" : "border-gray-300 hover:border-indigo-400"}`}
                      title={selected ? "Remove from comparison" : "Add to comparison"}
                    >
                      {selected ? <Check className="w-3.5 h-3.5" /> : null}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">{snap.label}</span>
                        <Badge variant="secondary" className="text-[10px]">v{snap.version_number || 1}</Badge>
                        {snap.status_at_snapshot && (
                          <Badge variant="outline" className="text-[10px]">{snap.status_at_snapshot}</Badge>
                        )}
                      </div>
                      {snap.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{snap.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {snap.created_date ? format(new Date(snap.created_date), "MMM d, yyyy h:mm a") : ""}
                        </span>
                        {snap.phase_summary && <span>· {snap.phase_summary}</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {snap.weighted_final_score != null && (
                        <div className="text-base font-bold text-gray-800 leading-none">
                          {snap.weighted_final_score}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-0.5">weighted final</div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-gray-400 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(snap.id)}
                      disabled={deleteMutation.isPending}
                      title="Delete snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison dialog */}
      {compareOpen && snapA && snapB && (
        <ScoringMatrixSnapshotCompare
          snapA={snapA}
          snapB={snapB}
          liveScore={score}
          onClose={() => setCompareOpen(false)}
        />
      )}
    </div>
  );
}