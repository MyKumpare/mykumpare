import React from "react";
import { Award, Check } from "lucide-react";
import { computeOverallRating } from "./scoringRatingLogic";

// Format a score value with the assessment's unit of measurement.
function formatScoreValue(value, unit) {
  const u = unit || "none";
  if (u === "%") return `${value}%`;
  if (u === "pts") return `${value} pts`;
  if (u === "x") return `${value}x`;
  if (u === "$") return `$${value}`;
  if (u === "bps") return `${value} bps`;
  return `${value}`;
}

// Human-readable range for a rating option based on its operator + min/max.
function formatRatingRange(opt, unit) {
  const op = opt.operator || "between";
  const v = opt.min_score;
  const max = opt.max_score;
  const fmt = (n) => formatScoreValue(n, unit);
  switch (op) {
    case "gte": return `≥ ${fmt(v)}`;
    case "gt": return `> ${fmt(v)}`;
    case "lte": return `≤ ${fmt(v)}`;
    case "lt": return `< ${fmt(v)}`;
    case "eq": return `= ${fmt(v)}`;
    case "between":
    default: return (max != null && max !== v) ? `${fmt(v)} – ${fmt(max)}` : `≥ ${fmt(v)}`;
  }
}

/**
 * Overall Rating panel — exposes the template's rating options (Pass/Fail and/or
 * Rating Options) with their configured ranges, and highlights the option that
 * the current total weighted score selects. Shown on the scorecard so analysts
 * can see the rating logic and the active result at a glance.
 *
 * Props:
 *  - weightedScore: the block-weighted final score (number or null)
 *  - ratingConfig: template.rating_config
 */
export default function ScoringOverallRatingPanel({ weightedScore, ratingConfig }) {
  const cfg = ratingConfig || {};
  const unit = cfg.unit;
  const overallRating = computeOverallRating(weightedScore, ratingConfig);
  const hasScore = weightedScore != null && !Number.isNaN(weightedScore);

  if (!cfg.pass_fail_enabled && !cfg.rating_enabled) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
      <div className="flex items-center gap-2 mb-2">
        <Award className="w-4 h-4 text-indigo-500" />
        <h4 className="text-sm font-semibold">Overall Rating</h4>
        <span className="text-xs text-gray-500">— rating logic applied to the total score</span>
        {hasScore && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700">
            Score: {formatScoreValue(Number(weightedScore.toFixed(2)), unit)}
          </span>
        )}
      </div>

      {cfg.pass_fail_enabled && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-1">Pass / Fail</div>
          <div className="flex flex-wrap gap-2">
            {["Pass", "Fail"].map((pf) => {
              const selected = hasScore && overallRating.passFail === pf;
              const isPass = pf === "Pass";
              const threshold = cfg.pass_threshold;
              const rangeStr = isPass
                ? (threshold != null ? `≥ ${formatScoreValue(threshold, unit)}` : "")
                : (threshold != null ? `< ${formatScoreValue(threshold, unit)}` : "");
              return (
                <div
                  key={pf}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs ${
                    selected
                      ? isPass
                        ? "border-green-300 bg-green-50 text-green-700"
                        : "border-red-300 bg-red-50 text-red-700"
                      : "border-gray-200 bg-white text-gray-500"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isPass ? "bg-green-500" : "bg-blue-500"}`} />
                  <span className="font-medium">{pf}</span>
                  {rangeStr && <span className="text-gray-400">{rangeStr}</span>}
                  {selected && <Check className="w-3 h-3 ml-0.5" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {cfg.rating_enabled && Array.isArray(cfg.rating_options) && cfg.rating_options.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Rating Options</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {cfg.rating_options.map((opt, i) => {
              const selected = hasScore && overallRating.ratingLabel === opt.label;
              return (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs ${
                    selected ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white text-gray-500"
                  }`}
                  style={selected && opt.color ? { borderColor: opt.color, color: opt.color } : undefined}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: opt.color || "#6b7280" }} />
                  <span className="font-medium">{opt.label || `Option ${i + 1}`}</span>
                  <span className="text-gray-400">{formatRatingRange(opt, unit)}</span>
                  {selected && <Check className="w-3 h-3 ml-auto" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}