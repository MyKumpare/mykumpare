import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Award, Star, Loader2 } from "lucide-react";
import { computeOverallRating } from "@/components/templates/scoringRatingLogic";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300",
};

function InlineScoreCell({ value, onChange, disabled }) {
  return (
    <Select value={value?.toString() || ""} onValueChange={(v) => onChange(parseInt(v))} disabled={disabled}>
      <SelectTrigger className="h-8 w-16 text-xs">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {[1, 2, 3, 4, 5].map((n) => (
          <SelectItem key={n} value={n.toString()}>
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold border ${SCORE_COLORS[n]}`}>{n}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Compute the block-weighted average for a given score field.
// Bonus/penalty adjustments are applied only to the final_score field (mirrors the scorecard logic).
function computeWeightedScoreNum(blocks, scoreField) {
  let total = 0;
  let totalWeight = 0;
  (blocks || []).forEach((block) => {
    const blockWeight = (block.weight || 0) / 100;
    (block.criteria || []).forEach((crit) => {
      let s = crit[scoreField];
      if (s != null) {
        if (scoreField === "final_score" && crit.bonus_penalty_active && crit.bonus_penalty_value) {
          s = Math.max(1, Math.min(5, s + crit.bonus_penalty_value));
        }
        total += s * blockWeight;
        totalWeight += blockWeight;
      }
    });
  });
  return totalWeight > 0 ? total / totalWeight : null;
}

/**
 * Pre-finalize guard.
 *  1. Lists every criterion still missing a score for the active phase and lets the
 *     analyst score it inline.
 *  2. Once every criterion has a score, shows the weighted score + overall Pass/Fail
 *     and rating label preview before the analyst confirms the save.
 *
 * Props:
 *  - open, onClose
 *  - blocks: scoring_blocks from the live score record
 *  - scoreField: "primary_score" | "adjusted_primary_score" | "final_score"
 *  - label: human phase label ("Primary" | "Adjusted Primary" | "Final")
 *  - template: scoring matrix template (for rating_config)
 *  - updateCriterion(blockId, critId, updates): persist an inline score change
 *  - onConfirm: called once the analyst confirms (all items scored)
 *  - isPending: whether a save is in flight (disables inline selectors)
 */
export default function FinalizeGuardDialog({
  open, onClose, blocks, scoreField, label, template, updateCriterion, onConfirm, isPending,
}) {
  const allCriteria = React.useMemo(() => {
    const list = [];
    (blocks || []).forEach((block) => {
      (block.criteria || []).forEach((crit) => {
        list.push({ blockId: block.id, blockName: block.name, crit });
      });
    });
    return list;
  }, [blocks]);

  const unscored = allCriteria.filter(({ crit }) => crit[scoreField] == null);
  const allScored = unscored.length === 0;

  const weightedNum = computeWeightedScoreNum(blocks, scoreField);
  const rating = computeOverallRating(weightedNum, template?.rating_config);
  const ratingConfig = template?.rating_config;
  const hasRatingConfig = !!(ratingConfig && (ratingConfig.pass_fail_enabled || ratingConfig.rating_enabled));

  const handleScore = (blockId, critId, value) => {
    updateCriterion(blockId, critId, { [scoreField]: value });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {allScored ? (
              <CheckCircle2 className="w-4.5 h-4.5 text-green-600" />
            ) : (
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
            )}
            Finalize {label} Scores
          </DialogTitle>
          <DialogDescription>
            {allScored
              ? "Every criterion has a score. Review the overall result below before saving."
              : `${unscored.length} ${unscored.length === 1 ? "criterion still needs" : "criteria still need"} a ${label.toLowerCase()} score. Score them here, then confirm.`}
          </DialogDescription>
        </DialogHeader>

        {/* Unscored items — inline scoring */}
        {!allScored && (
          <div className="border border-amber-200 rounded-lg overflow-hidden">
            <div className="bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 border-b border-amber-200">
              {unscored.length} unscored {unscored.length === 1 ? "item" : "items"}
            </div>
            <div className="max-h-[40vh] overflow-y-auto divide-y divide-gray-100">
              {unscored.map(({ blockId, blockName, crit }) => (
                <div key={crit.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{crit.name || `#${crit.number}`}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {crit.category ? `${crit.category} · ` : ""}{blockName}
                    </p>
                  </div>
                  <InlineScoreCell
                    value={crit[scoreField]}
                    onChange={(v) => handleScore(blockId, crit.id, v)}
                    disabled={isPending}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overall rating preview — shown once everything is scored */}
        {allScored && (
          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Weighted {label} Score</span>
              <span className="text-xl font-bold text-gray-900">
                {weightedNum != null ? weightedNum.toFixed(2) : "—"}
              </span>
            </div>
            {hasRatingConfig && (
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-200">
                {ratingConfig.pass_fail_enabled && (
                  <Badge
                    variant="outline"
                    className={`text-xs flex items-center gap-1 ${rating.passFail === "Pass" ? "border-green-300 text-green-700 bg-green-50" : rating.passFail === "Fail" ? "border-red-300 text-red-700 bg-red-50" : "text-gray-400"}`}
                  >
                    <Award className="w-3 h-3" />
                    {rating.passFail || "—"}
                  </Badge>
                )}
                {ratingConfig.rating_enabled && (
                  <Badge
                    variant="outline"
                    className="text-xs flex items-center gap-1"
                    style={rating.ratingColor ? { borderColor: rating.ratingColor, color: rating.ratingColor, backgroundColor: `${rating.ratingColor}15` } : undefined}
                  >
                    <Star className="w-3 h-3" />
                    {rating.ratingLabel || "—"}
                  </Badge>
                )}
                {!ratingConfig.pass_fail_enabled && !ratingConfig.rating_enabled && (
                  <span className="text-xs text-gray-400">No rating configuration on this template.</span>
                )}
              </div>
            )}
            {!hasRatingConfig && (
              <p className="text-xs text-gray-400">
                This template has no overall rating configuration, so only the weighted score is shown.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} disabled={!allScored || isPending}>
            {isPending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
            ) : allScored ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> Confirm &amp; Save</>
            ) : (
              "Score all items to continue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}