import React, { useMemo } from "react";

/**
 * DdProgressBar — calculates and displays completion progress for a due
 * diligence record based on completed sub-stages across all stages.
 *
 * Progress = (completed sub-stages) / (total sub-stages) * 100.
 * Stages with no sub-stages are counted as one unit (completed or not).
 *
 * @param {object} rec — DueDiligence record with stages[].sub_stages[]
 */
export function getDdProgress(rec) {
  const stages = rec?.stages || [];
  if (stages.length === 0) return { completed: 0, total: 0, pct: 0 };

  let completed = 0;
  let total = 0;

  for (const stage of stages) {
    const subs = stage.sub_stages || [];
    if (subs.length === 0) {
      // Stage with no sub-stages counts as one unit
      total += 1;
      if (stage.completed) completed += 1;
    } else {
      for (const sub of subs) {
        total += 1;
        if (sub.status === "completed") completed += 1;
      }
    }
  }

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, pct };
}

export default function DdProgressBar({ rec, showLabel = true, compact = false }) {
  const { completed, total, pct } = useMemo(() => getDdProgress(rec), [rec]);

  if (total === 0) return null;

  // Color based on progress
  const colorClass =
    pct === 100
      ? "bg-emerald-500"
      : pct >= 66
      ? "bg-indigo-500"
      : pct >= 33
      ? "bg-blue-400"
      : "bg-gray-300";

  const textClass =
    pct === 100
      ? "text-emerald-600"
      : pct >= 66
      ? "text-indigo-600"
      : pct >= 33
      ? "text-blue-500"
      : "text-gray-400";

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold ${textClass}`}>
            {pct === 100 ? "✓ Complete" : `${completed}/${total} steps`}
          </span>
          <span className={`text-[10px] font-bold ${textClass}`}>{pct}%</span>
        </div>
      )}
      <div className={`w-full ${compact ? "h-1" : "h-1.5"} bg-gray-200 rounded-full overflow-hidden`}>
        <div
          className={`h-full ${colorClass} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}