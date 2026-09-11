import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, X, ToggleLeft, ToggleRight, Info } from "lucide-react";

const SCORE_COLORS = {
  1: "bg-red-100 text-red-700 border-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300",
  4: "bg-lime-100 text-lime-700 border-lime-300",
  5: "bg-green-100 text-green-700 border-green-300"
};

// Custom SelectItem that keeps the trigger clean (just the number) while the
// dropdown shows the full descriptor text as a visual sibling.
function DescriptorSelectItem({ value, scoreNumber, descriptorText }) {
  const colorKey = Math.max(1, Math.min(5, scoreNumber));
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex w-full cursor-default select-none items-start rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold border shrink-0 ${SCORE_COLORS[colorKey]}`}>{scoreNumber}</span>
      </SelectPrimitive.ItemText>
      {descriptorText && (
        <span className="text-[11px] text-gray-600 leading-snug flex-1 ml-2 whitespace-normal self-center">
          {descriptorText}
        </span>
      )}
    </SelectPrimitive.Item>
  );
}

/**
 * Score selection cell — supports both "levels" mode (descriptor-based dropdown)
 * and "single" mode (numeric range dropdown). When combineBonusPenalty is true,
 * the dropdown also includes the bonus/penalty adjustment options below a
 * separator, so the user picks ONE value from the combined list. Selecting a
 * standard level sets the score and deactivates bonus/penalty; selecting a
 * bonus/penalty value activates the adjustment on top of the current base score.
 */
export function TestScoreCell({
  score, onChange, disabled, placeholder = "—",
  descriptors, scoringMode, singleMin, singleMax,
  combineBonusPenalty, criterion, bonusPenaltyConfig, onCombinedChange
}) {
  const [showGuidance, setShowGuidance] = useState(false);
  const hasDesc = Array.isArray(descriptors) && descriptors.some((d) => d && d.text);
  const descFor = (n) => (hasDesc ? descriptors.find((d) => d.level === n)?.text : null);
  const selectedDesc = score != null ? descFor(score) : null;

  // Build bonus/penalty options from template config
  const bpOptions = useMemo(() => {
    if (!combineBonusPenalty || !bonusPenaltyConfig?.enabled) return [];
    const direction = bonusPenaltyConfig.direction || "penalty";
    const range = bonusPenaltyConfig.range || { min: -1, max: 1 };
    const step = Number.isFinite(bonusPenaltyConfig.step) ? bonusPenaltyConfig.step : 1;
    const genLevels = bonusPenaltyConfig.levels;
    if (Array.isArray(genLevels) && genLevels.length > 0) {
      return genLevels.map((l) => ({ level: Number(l.level), text: l.text || "" })).filter((o) => Number.isFinite(o.level));
    }
    const opts = [];
    const st = step > 0 ? step : 1;
    if (direction === "bonus") {
      const max = Number.isFinite(range.max) ? range.max : 0;
      for (let n = st; n <= max + 1e-9; n += st) opts.push({ level: Number(n.toFixed(4)), text: "" });
    } else {
      const min = Number.isFinite(range.min) ? range.min : 0;
      for (let n = -st; n >= min - 1e-9; n -= st) opts.push({ level: Number(n.toFixed(4)), text: "" });
    }
    return opts;
  }, [combineBonusPenalty, bonusPenaltyConfig]);

  const isBPActive = combineBonusPenalty && criterion?.bonus_penalty_active;
  const bpValue = criterion?.bonus_penalty_value;
  const bpDirection = bonusPenaltyConfig?.direction || "penalty";
  const guidance = bonusPenaltyConfig?.guidance || "";

  // Encoded value: std:N for standard levels, bp:N for bonus/penalty
  const currentValue = isBPActive ? `bp:${bpValue}` : score != null ? `std:${score}` : "";

  const handleCombinedChange = (encoded) => {
    if (!onCombinedChange) return;
    if (encoded.startsWith("std:")) {
      const v = scoringMode === "single" ? parseFloat(encoded.slice(4)) : parseInt(encoded.slice(4));
      onCombinedChange({ primary_score: v, bonus_penalty_active: false, bonus_penalty_value: null });
    } else if (encoded.startsWith("bp:")) {
      const v = Number(encoded.slice(3));
      const updates = { bonus_penalty_active: true, bonus_penalty_value: v };
      // Default base score to midpoint if none set yet
      if (score == null) {
        if (scoringMode === "single") {
          const min = Number.isFinite(singleMin) ? singleMin : 0;
          const max = Number.isFinite(singleMax) ? singleMax : 100;
          updates.primary_score = Math.round((min + max) / 2);
        } else {
          const levels = (descriptors || []).map((d) => d.level).filter(Number.isFinite);
          if (levels.length > 0) updates.primary_score = levels[Math.floor(levels.length / 2)];
        }
      }
      onCombinedChange(updates);
    }
  };

  // Standard options
  const descLevels = (Array.isArray(descriptors) && descriptors.length > 0)
    ? descriptors.map((d) => d.level).filter((n) => Number.isFinite(n))
    : [1, 2, 3, 4, 5];

  const singleOptions = [];
  if (scoringMode === "single") {
    const min = Number.isFinite(singleMin) ? singleMin : 0;
    const max = Number.isFinite(singleMax) ? singleMax : 100;
    for (let n = min; n <= max; n++) singleOptions.push(n);
  }

  const handleValueChange = combineBonusPenalty
    ? handleCombinedChange
    : (v) => onChange(scoringMode === "single" ? parseFloat(v) : parseInt(v));

  const selectValue = combineBonusPenalty ? currentValue : (score != null ? score.toString() : "");
  const showWide = hasDesc || (combineBonusPenalty && bpOptions.some((o) => o.text));

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <Select value={selectValue} onValueChange={handleValueChange} disabled={disabled}>
            <SelectTrigger className={`h-8 w-full text-xs ${isBPActive ? (bpDirection === "bonus" ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50") : ""}`}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className={showWide ? "min-w-[320px] max-w-[420px]" : "max-h-72"}>
              {/* Standard scoring options */}
              {scoringMode === "single"
                ? singleOptions.map((n) => (
                  <SelectPrimitive.Item
                    key={combineBonusPenalty ? `std:${n}` : n.toString()}
                    value={combineBonusPenalty ? `std:${n}` : n.toString()}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-xs outline-none focus:bg-accent focus:text-accent-foreground"
                  >
                    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                      <SelectPrimitive.ItemIndicator><Check className="h-4 w-4" /></SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText>{n}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))
                : descLevels.map((n) => (
                  <DescriptorSelectItem
                    key={combineBonusPenalty ? `std:${n}` : n.toString()}
                    value={combineBonusPenalty ? `std:${n}` : n.toString()}
                    scoreNumber={n}
                    descriptorText={descFor(n)}
                  />
                ))
              }
              {/* Bonus/penalty options — combined into the same dropdown */}
              {combineBonusPenalty && bpOptions.length > 0 && (
                <>
                  <div className="my-1 border-t border-gray-200" />
                  <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {bpDirection === "bonus" ? "Bonus Options" : "Penalty Options"}
                  </div>
                  {bpOptions.map((o) => (
                    <SelectPrimitive.Item
                      key={`bp:${o.level}`}
                      value={`bp:${o.level}`}
                      className="relative flex w-full cursor-default select-none items-start rounded-sm py-1.5 pl-2 pr-8 text-xs outline-none focus:bg-accent focus:text-accent-foreground"
                    >
                      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator><Check className="h-4 w-4" /></SelectPrimitive.ItemIndicator>
                      </span>
                      <SelectPrimitive.ItemText>
                        <span className={`font-medium ${o.level > 0 ? "text-green-700" : "text-red-700"}`}>
                          {o.level > 0 ? `+${o.level}` : o.level}
                        </span>
                      </SelectPrimitive.ItemText>
                      {o.text && <span className="text-[11px] text-gray-600 leading-snug flex-1 ml-2 whitespace-normal self-center">{o.text}</span>}
                    </SelectPrimitive.Item>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        {combineBonusPenalty && guidance && (
          <button type="button" onClick={() => setShowGuidance(!showGuidance)} className="p-0.5 text-gray-400 hover:text-indigo-600 shrink-0" title="Show bonus/penalty guidance">
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {selectedDesc && !isBPActive && (
        <p className="text-[11px] text-gray-600 leading-relaxed text-left w-full whitespace-normal px-0.5 mt-0.5" title={selectedDesc}>
          {selectedDesc}
        </p>
      )}
      {isBPActive && (
        <p className="text-[11px] leading-relaxed text-left w-full px-0.5 mt-0.5">
          <span className={`font-medium ${bpDirection === "bonus" ? "text-green-700" : "text-red-700"}`}>
            {bpDirection === "bonus" ? "+ Bonus" : "− Penalty"}: {bpValue > 0 ? "+" : ""}{bpValue}
          </span>
        </p>
      )}
      {showGuidance && guidance && (
        <div className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded p-1.5">
          {guidance}
        </div>
      )}
    </div>
  );
}

/**
 * Bonus/penalty adjustment cell — always visible alongside scoring.
 * Reads the template-defined config (denormalized onto the mock criterion)
 * and the analyst's active toggle + selected value.
 */
export function TestBonusPenaltyCell({ criterion, disabled, onUpdate }) {
  const [showGuidance, setShowGuidance] = useState(false);

  const direction = criterion?.bonus_penalty_direction || "penalty";
  const range = criterion?.bonus_penalty_range || { min: -1, max: 1 };
  const step = Number.isFinite(criterion?.bonus_penalty_step) ? criterion.bonus_penalty_step : 1;
  const genLevels = criterion?.bonus_penalty_levels;

  const options = useMemo(() => {
    if (Array.isArray(genLevels) && genLevels.length > 0) {
      return genLevels
        .map((l) => ({ level: Number(l.level), text: l.text || "" }))
        .filter((o) => Number.isFinite(o.level));
    }
    const opts = [];
    const st = step > 0 ? step : 1;
    if (direction === "bonus") {
      const max = Number.isFinite(range.max) ? range.max : 0;
      for (let n = st; n <= max + 1e-9; n += st) opts.push({ level: Number(n.toFixed(4)), text: "" });
    } else {
      const min = Number.isFinite(range.min) ? range.min : 0;
      for (let n = -st; n >= min - 1e-9; n -= st) opts.push({ level: Number(n.toFixed(4)), text: "" });
    }
    return opts;
  }, [genLevels, direction, range.min, range.max, step]);

  if (!criterion?.bonus_penalty_enabled) return null;

  const isActive = criterion.bonus_penalty_active;
  const value = criterion.bonus_penalty_value;
  const guidance = criterion.bonus_penalty_guidance || "";

  const handleToggle = () => {
    if (disabled) return;
    onUpdate({ bonus_penalty_active: !isActive, bonus_penalty_value: !isActive ? (options[0]?.level ?? 0) : value });
  };
  const handleValueChange = (v) => onUpdate({ bonus_penalty_value: Number(v) });

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`p-0.5 rounded text-xs ${isActive ? "text-indigo-600 bg-indigo-50 border border-indigo-200" : "text-gray-400 border border-gray-200"} ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-100"}`}
          title={isActive ? "Deactivate bonus/penalty" : "Activate bonus/penalty"}
        >
          {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        </button>
        {isActive && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-0.5">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${direction === "bonus" ? "bg-green-100 border-green-400 text-green-700" : "bg-red-100 border-red-400 text-red-700"}`}
                title={direction === "bonus" ? "Bonus adjustment (positive)" : "Penalty adjustment (negative)"}
              >
                {direction === "bonus" ? "+ Bonus" : "− Penalty"}
              </span>
            </div>
            {options.length > 0 && (
              <Select value={String(value ?? "")} onValueChange={handleValueChange} disabled={disabled}>
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className={options.some((o) => o.text) ? "min-w-[260px] max-w-[360px]" : "max-h-60"}>
                  {options.map((o) => (
                    <SelectPrimitive.Item
                      key={o.level}
                      value={String(o.level)}
                      className="relative flex w-full cursor-default select-none items-start rounded-sm py-1.5 pl-2 pr-8 text-xs outline-none focus:bg-accent focus:text-accent-foreground"
                    >
                      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <Check className="h-4 w-4" />
                        </SelectPrimitive.ItemIndicator>
                      </span>
                      <SelectPrimitive.ItemText>
                        <span className="font-medium">{o.level > 0 ? `+${o.level}` : o.level}</span>
                      </SelectPrimitive.ItemText>
                      {o.text && <span className="text-[11px] text-gray-600 leading-snug flex-1 ml-2 whitespace-normal self-center">{o.text}</span>}
                    </SelectPrimitive.Item>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowGuidance(!showGuidance)}
          className="p-0.5 text-gray-400 hover:text-indigo-600"
          title="Show guidance"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
      {showGuidance && guidance && (
        <div className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded p-1.5 max-w-[200px] mt-0.5">
          {guidance}
        </div>
      )}
      {isActive && value != null && (
        <div className="text-[10px] font-medium mt-0.5" style={{ color: (value || 0) > 0 ? "#166534" : (value || 0) < 0 ? "#991b1b" : "#6b7280" }}>
          {(value || 0) > 0 ? "+" : ""}{value || 0}
        </div>
      )}
    </div>
  );
}

/** Deviation cell — shows the score difference between two phases. */
export function TestDeviationCell({ baseScore, compareScore }) {
  if (compareScore == null || baseScore == null) return <span className="text-xs text-gray-300">—</span>;
  const diff = compareScore - baseScore;
  if (diff === 0) return <span className="text-xs text-gray-500">{compareScore}</span>;
  const intensity = Math.min(Math.abs(diff) / 4, 1);
  const bg = diff > 0 ? `rgba(34, 197, 94, ${0.15 + intensity * 0.35})` : `rgba(239, 68, 68, ${0.15 + intensity * 0.35})`;
  const text = diff > 0 ? "text-green-800" : "text-red-800";
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${text}`} style={{ background: bg }}>
      {compareScore} ({diff > 0 ? "+" : ""}{diff})
    </span>
  );
}

/** Notes cell — per-phase notes with inline editing. */
export function TestNotesCell({ criterion, showTeam, showIC, showFinal, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");

  const activeNotes = criterion.final_notes || criterion.adjusted_primary_notes || criterion.ic_notes || criterion.team_notes || criterion.primary_notes || "";
  const notesLabel = showFinal ? "Final Notes" : showIC ? "IC Notes" : showTeam ? "Team Notes" : "Primary Notes";
  const notesField = showFinal ? "final_notes" : showIC ? "ic_notes" : showTeam ? "team_notes" : "primary_notes";

  if (editing) {
    return (
      <div className="space-y-1">
        <Textarea
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="text-xs min-h-[60px]"
          placeholder={`Justify your ${notesLabel.toLowerCase()}...`}
          defaultValue={activeNotes}
        />
        <div className="flex gap-1">
          <Button size="sm" className="h-6 text-xs" onClick={() => { onUpdate({ [notesField]: notes }); setEditing(false); }}>Save</Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="cursor-pointer hover:bg-gray-100 rounded p-1 min-h-[40px]" onClick={() => { setNotes(activeNotes); setEditing(true); }}>
      {activeNotes ? (
        <span className="text-xs text-gray-600">{activeNotes}</span>
      ) : (
        <span className="text-xs text-gray-300 italic">Add {notesLabel.toLowerCase()}...</span>
      )}
    </div>
  );
}