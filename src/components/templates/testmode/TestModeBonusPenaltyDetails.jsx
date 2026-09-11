import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Plus, Minus, Info } from "lucide-react";
import { formatScoreValue } from "@/components/templates/testmode/testModeUtils";

/**
 * Shows the full bonus/penalty configuration for every enabled criterion:
 * direction, range/step, the generated dropdown options (levels w/ descriptors),
 * guidance text, and whether an adjustment was applied (with value + justification).
 */
export default function TestModeBonusPenaltyDetails({ blocks, templateCriteria, scoreUnit }) {
  const [expanded, setExpanded] = useState(false);

  const entries = [];
  blocks.forEach((b) => {
    (b.criteria || []).forEach((c) => {
      const tc = templateCriteria[c.id] || c;
      if (!tc.bonus_penalty_enabled) return;
      const direction = tc.bonus_penalty_direction || c.bonus_penalty_direction || "penalty";
      const range = tc.bonus_penalty_range || c.bonus_penalty_range || null;
      const levels = tc.bonus_penalty_levels || c.bonus_penalty_levels || [];
      const guidance = tc.bonus_penalty_guidance || c.bonus_penalty_guidance || "";
      const isActive = !!(c.bonus_penalty_active && c.bonus_penalty_value);
      entries.push({
        criterion: c.name || `#${c.number}`,
        block: b.name,
        direction,
        range,
        levels,
        guidance,
        step: tc.bonus_penalty_step || c.bonus_penalty_step,
        isActive,
        value: c.bonus_penalty_value,
        notes: c.bonus_penalty_notes || c.primary_notes || ""
      });
    });
  });

  if (entries.length === 0) return null;

  const dirStyles = (dir) =>
    dir === "bonus"
      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
      : "bg-rose-50 text-rose-700 border-rose-300";

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Bonus & Penalty Adjustment Options
        <Badge variant="outline" className="text-[10px] ml-1">{entries.length}</Badge>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {entries.map((entry, i) => (
            <div key={i} className="p-3 space-y-2">
              {/* Header row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-800">{entry.criterion}</span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{entry.block}</span>
                <Badge variant="outline" className={`text-[10px] ${dirStyles(entry.direction)}`}>
                  {entry.direction === "bonus" ? <Plus className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                  {entry.direction === "bonus" ? "Bonus" : "Penalty"}
                </Badge>
                {entry.isActive ? (
                  <Badge variant="outline" className={`text-[10px] ${dirStyles(entry.direction)}`}>
                    Applied: {entry.value > 0 ? "+" : ""}{formatScoreValue(entry.value, scoreUnit)}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200">Not applied</Badge>
                )}
              </div>

              {/* Range + step */}
              {entry.range && (entry.range.min != null || entry.range.max != null) && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-500">Range:</span>{" "}
                  {entry.range.min ?? 0} to {entry.range.max ?? 0}
                  {entry.step ? <span className="text-gray-400 ml-1">(step {entry.step})</span> : null}
                </div>
              )}

              {/* Dropdown options (levels) */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Dropdown Options:</div>
                {entry.levels.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {entry.levels.map((lv, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 border ${dirStyles(entry.direction)}`}
                        title={lv.text || undefined}
                      >
                        <span className="font-semibold">{lv.level > 0 ? "+" : ""}{lv.level}</span>
                        {lv.text && <span className="text-gray-500 font-normal">— {lv.text}</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">No levels generated</div>
                )}
              </div>

              {/* Guidance */}
              {entry.guidance && (
                <div className="flex items-start gap-1.5 text-xs text-gray-600 bg-gray-50 rounded p-2">
                  <Info className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />
                  <span><span className="font-medium text-gray-500">Guidance: </span>{entry.guidance}</span>
                </div>
              )}

              {/* Justification (if applied) */}
              {entry.isActive && entry.notes && (
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-500">Justification: </span>{entry.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}