import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitBranch, AlertTriangle, Check } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";
import { createRescoreFromPrior } from "./rescoreLogic";

/**
 * Dialog to start re-scoring from a prior (closed) scoring.
 * Creates a new ScoringMatrixScore by copying the prior score's structure
 * (blocks, criteria, notes) as a starting baseline, resets all workflow
 * flags, increments the version number, and links back via prior_score_id.
 *
 * Props:
 *   priorScore - the closed ScoringMatrixScore to re-score from
 *   onCreated - callback(newScoreId) after the new score is created
 *   onClose   - callback to close the dialog
 */
export default function RescoreConfirmDialog({ priorScore, onCreated, onClose }) {
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);

  // Fetch the latest version number for this product+template
  const { data: existingScores = [] } = useQuery({
    queryKey: ["scoringMatrixHistory", priorScore?.product_id, priorScore?.template_id],
    queryFn: () =>
      base44.entities.ScoringMatrixScore.filter({
        product_id: priorScore.product_id,
        template_id: priorScore.template_id
      }, "-version_number", 100),
    enabled: !!priorScore?.product_id && !!priorScore?.template_id
  });

  const nextVersion = Math.max(...existingScores.map((s) => s.version_number || 1), priorScore?.version_number || 1) + 1;

  const createRescoreMutation = useMutation({
    mutationFn: () => createRescoreFromPrior(priorScore, existingScores),
    onSuccess: (newScore) => {
      queryClient.invalidateQueries({ queryKey: ["scoringMatrixHistory", priorScore.product_id, priorScore.template_id] });
      queryClient.invalidateQueries({ queryKey: ["scoringMatrixScore", newScore.id] });
      toast({
        title: "Re-scoring started",
        description: `Version v${nextVersion} created from v${priorScore.version_number || 1}. Prior scores carried over as a starting baseline.`
      });
      onCreated(newScore.id);
    },
    onError: (err) => {
      toast({ title: "Failed to start re-scoring", description: err?.message, variant: "destructive" });
    }
  });

  if (!priorScore) return null;

  const priorVersion = priorScore.version_number || 1;
  const priorDate = priorScore.scoring_end_date || priorScore.scoring_start_date || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Start Re-Scoring</h3>
            <p className="text-xs text-gray-500">Create a new scoring version from a prior evaluation</p>
          </div>
        </div>

        {/* Prior score info */}
        <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">v{priorVersion}</Badge>
            <Badge variant="outline" className="text-xs">{priorScore.status}</Badge>
            {priorScore.is_closed && <Badge variant="outline" className="text-xs text-gray-500">Closed</Badge>}
          </div>
          <p className="text-sm font-medium">{priorScore.product_name}</p>
          <p className="text-xs text-gray-500">{priorScore.firm_name}</p>
          {priorDate && (
            <p className="text-xs text-gray-400 mt-1">
              Prior scoring: {format(parseISO(priorDate), "MMM d, yyyy")}
            </p>
          )}
        </div>

        {/* What happens explanation */}
        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-700">This will create <span className="font-semibold">version v{nextVersion}</span> with:</p>
          <ul className="space-y-1.5 text-xs text-gray-600 ml-1">
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>The prior final scores and notes carried over as a <strong>starting baseline</strong> for the primary analyst to adjust.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>All workflow flags reset — the new scoring starts at the primary scoring phase.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>A new scoring start date set to today ({format(new Date(), "MMM d, yyyy")}).</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
              <span>The prior scoring (v{priorVersion}) remains <strong>closed and unchanged</strong> for historical tracking.</span>
            </li>
          </ul>
        </div>

        {/* Warning */}
        <div className="border border-amber-200 rounded-lg p-3 mb-4 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              The prior scoring's scores and notes will be copied as the starting point. Make sure you intend to re-evaluate this manager product before proceeding.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={createRescoreMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => createRescoreMutation.mutate()}
            disabled={createRescoreMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {createRescoreMutation.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating v{nextVersion}...</>
            ) : (
              <><GitBranch className="w-3.5 h-3.5" /> Start Re-Scoring v{nextVersion}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}