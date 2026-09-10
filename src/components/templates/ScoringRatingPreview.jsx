import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeOverallRating } from "./scoringRatingLogic";

/**
 * Live preview of the Pass/Fail + rating label for a sample score, using the
 * current (unsaved) rating config and operator rules. Lets the user verify the
 * logic before saving the template.
 *
 * Props:
 *  - ratingConfig: current rating_config object (live, unsaved)
 */
export default function ScoringRatingPreview({ ratingConfig }) {
  const [sample, setSample] = useState(75);

  const cfg = ratingConfig || {};
  const unit = cfg.unit && cfg.unit !== "none" ? cfg.unit : "";
  const { passFail, ratingLabel, ratingColor } = computeOverallRating(sample, ratingConfig);

  const hasAnything = cfg.pass_fail_enabled || cfg.rating_enabled;
  if (!hasAnything) return null;

  return (
    <div className="border border-cyan-200 rounded-md p-2 bg-cyan-50/40 space-y-2">
      <div className="flex items-center gap-2 text-xs px-1">
        <Label className="text-xs text-cyan-800 whitespace-nowrap font-semibold">Live preview:</Label>
        <span className="text-gray-500 text-[10px]">Test a score</span>
        <Input
          type="number"
          step="0.1"
          value={sample}
          onChange={(e) => setSample(parseFloat(e.target.value) || 0)}
          className="h-7 w-20 text-xs text-center"
        />
        {unit && <span className="text-gray-500 text-xs font-medium">{unit}</span>}
      </div>
      <div className="flex items-center gap-3 px-1 text-xs">
        {cfg.pass_fail_enabled && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Pass/Fail:</span>
            {passFail ? (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                style={{ background: passFail === "Pass" ? "#10b981" : "#ef4444" }}
              >
                {passFail}
              </span>
            ) : (
              <span className="text-gray-400 text-[10px]">—</span>
            )}
          </div>
        )}
        {cfg.rating_enabled && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Rating:</span>
            {ratingLabel ? (
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                style={{ background: ratingColor || "#6b7280" }}
              >
                {ratingLabel}
              </span>
            ) : (
              <span className="text-gray-400 text-[10px]">No match</span>
            )}
          </div>
        )}
      </div>
      {!passFail && !ratingLabel && (cfg.pass_fail_enabled || cfg.rating_enabled) && (
        <p className="text-[10px] text-amber-600 px-1">
          No result — check that your thresholds/operators match the sample score.
        </p>
      )}
    </div>
  );
}