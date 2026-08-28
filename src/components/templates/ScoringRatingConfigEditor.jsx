import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from "lucide-react";

let _optId = 0;
const nextOptId = () => `sro_${Date.now()}_${++_optId}`;

const DEFAULT_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

/**
 * Editor for the overall rating configuration on a Scoring Matrix template.
 * Lets the user enable Pass/Fail (with a threshold) and create/edit/delete rating
 * options (each a label + score range + color) that the system auto-assigns to
 * finalized scoring matrices based on their weighted final score.
 *
 * Props:
 *  - ratingConfig: template.rating_config object
 *  - onChange: (newConfig) => void
 */
export default function ScoringRatingConfigEditor({ ratingConfig, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = ratingConfig || { pass_fail_enabled: false, pass_threshold: 3, rating_enabled: false, rating_options: [] };

  const update = (patch) => onChange({ ...cfg, ...patch });

  const addOption = () => {
    const options = [...(cfg.rating_options || [])];
    options.push({
      id: nextOptId(),
      label: "",
      min_score: 0,
      max_score: 0,
      color: DEFAULT_COLORS[options.length % DEFAULT_COLORS.length]
    });
    update({ rating_options: options });
  };

  const updateOption = (id, patch) => {
    update({ rating_options: (cfg.rating_options || []).map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  };

  const removeOption = (id) => {
    update({ rating_options: (cfg.rating_options || []).filter((o) => o.id !== id) });
  };

  return (
    <div className="border border-cyan-200 rounded-lg bg-cyan-50/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full px-2 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        Overall Rating Configuration
      </button>
      {expanded && (
        <div className="p-2 pt-0 space-y-3">
          <p className="text-[10px] text-gray-500 px-1">
            Define how the system auto-assigns an overall assessment (Pass/Fail and a rating) to a finalized scoring matrix based on its weighted final score.
          </p>

          {/* Pass / Fail */}
          <div className="border border-gray-200 rounded-md p-2 bg-white space-y-2">
            <button
              type="button"
              onClick={() => update({ pass_fail_enabled: !cfg.pass_fail_enabled })}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700"
            >
              {cfg.pass_fail_enabled ? <ToggleRight className="w-4 h-4 text-cyan-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
              Pass / Fail Assessment
            </button>
            {cfg.pass_fail_enabled && (
              <div className="flex items-center gap-2 text-xs pl-6">
                <Label className="text-xs text-gray-600 whitespace-nowrap">Pass threshold (min score):</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={cfg.pass_threshold ?? 3}
                  onChange={(e) => update({ pass_threshold: parseFloat(e.target.value) || 0 })}
                  className="h-7 w-20 text-xs text-center"
                />
                <span className="text-gray-400 text-[10px]">Score ≥ threshold = Pass; below = Fail</span>
              </div>
            )}
          </div>

          {/* Rating options */}
          <div className="border border-gray-200 rounded-md p-2 bg-white space-y-2">
            <button
              type="button"
              onClick={() => update({ rating_enabled: !cfg.rating_enabled })}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700"
            >
              {cfg.rating_enabled ? <ToggleRight className="w-4 h-4 text-cyan-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
              Rating Options (auto-assigned by score range)
            </button>
            {cfg.rating_enabled && (
              <div className="pl-6 space-y-1.5">
                <div className="grid grid-cols-[1.5rem_7rem_4rem_1rem_4rem_1.5rem_1.5rem] gap-1 items-center text-[10px] font-medium text-gray-400 px-1">
                  <span>#</span>
                  <span>Label</span>
                  <span>Min</span>
                  <span></span>
                  <span>Max</span>
                  <span>Color</span>
                  <span></span>
                </div>
                {(cfg.rating_options || []).map((opt, i) => (
                  <div key={opt.id} className="grid grid-cols-[1.5rem_7rem_4rem_1rem_4rem_1.5rem_1.5rem] gap-1 items-center">
                    <span className="text-[10px] text-gray-400">{i + 1}</span>
                    <Input
                      value={opt.label}
                      onChange={(e) => updateOption(opt.id, { label: e.target.value })}
                      className="h-7 text-xs"
                      placeholder="e.g. A, Buy, 5"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      value={opt.min_score}
                      onChange={(e) => updateOption(opt.id, { min_score: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs text-center"
                      placeholder="min"
                    />
                    <span className="text-gray-400 text-[10px] text-center">to</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={opt.max_score}
                      onChange={(e) => updateOption(opt.id, { max_score: parseFloat(e.target.value) || 0 })}
                      className="h-7 text-xs text-center"
                      placeholder="max"
                    />
                    <input
                      type="color"
                      value={opt.color || "#10b981"}
                      onChange={(e) => updateOption(opt.id, { color: e.target.value })}
                      className="w-6 h-7 rounded border border-gray-200 cursor-pointer p-0"
                      title="Rating badge color"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      className="p-1 rounded hover:bg-red-100 text-red-500 justify-self-center"
                      title="Delete rating option"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={addOption} className="text-xs h-7 text-cyan-600">
                  <Plus className="w-3 h-3" /> Add Rating Option
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}