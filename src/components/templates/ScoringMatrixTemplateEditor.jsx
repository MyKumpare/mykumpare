import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Sparkles, Loader2, ToggleLeft, ToggleRight, Sigma } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ScoringMatrixRubricAudit from "./ScoringMatrixRubricAudit";
import ScoringRatingConfigEditor from "./ScoringRatingConfigEditor";
import ScoringLevelRangeGenerator from "./ScoringLevelRangeGenerator";
import { toast } from "@/components/ui/use-toast";
import { computeEffectiveBlockWeights, hasActiveMultipliers } from "@/components/templates/scoringWeightLogic";

let _blockId = 0;
const nextBlockId = () => `smb_${Date.now()}_${++_blockId}`;
let _critId = 0;
const nextCritId = () => `smc_${Date.now()}_${++_critId}`;

// Compute the total score range for a single criterion (includes bonus/penalty adjustment).
// - single mode: uses single_score_min / single_score_max
// - levels mode: uses the min/max descriptor levels (defaults to 1-5)
function getCriterionRange(crit) {
  if (!crit) return null;
  let min, max;
  if (crit.scoring_mode === "single") {
    min = Number.isFinite(crit.single_score_min) ? crit.single_score_min : 0;
    max = Number.isFinite(crit.single_score_max) ? crit.single_score_max : 100;
  } else {
    const descs = crit.descriptors;
    if (Array.isArray(descs) && descs.length > 0) {
      const levels = descs.map((d) => d.level).filter((n) => Number.isFinite(n));
      if (levels.length > 0) { min = Math.min(...levels); max = Math.max(...levels); }
      else { min = 1; max = 5; }
    } else { min = 1; max = 5; }
  }
  // Fold in bonus/penalty adjustment so this reflects the total possible score, not just the base scoring range.
  // Direction-aware: penalty only lowers the min (max stays at the base scoring max);
  // bonus only raises the max (min stays at the base scoring min).
  if (crit.bonus_penalty_enabled && crit.bonus_penalty_range) {
    const bpMin = Number.isFinite(crit.bonus_penalty_range.min) ? crit.bonus_penalty_range.min : 0;
    const bpMax = Number.isFinite(crit.bonus_penalty_range.max) ? crit.bonus_penalty_range.max : 0;
    if (crit.bonus_penalty_direction === "bonus") {
      if (bpMax > 0) max += bpMax;
    } else {
      if (bpMin < 0) min += bpMin;
    }
  }
  return { min, max };
}

// Compute the total score range for a section = sum of its criteria's total ranges
function getBlockRange(block) {
  const ranges = (block.criteria || []).map(getCriterionRange).filter(Boolean);
  if (ranges.length === 0) return null;
  return {
    min: ranges.reduce((s, r) => s + r.min, 0),
    max: ranges.reduce((s, r) => s + r.max, 0)
  };
}

// Build the selectable adjustment levels for a bonus/penalty criterion from its
// direction, range, and step. Bonus → positive values (step → max); penalty →
// negative values (min → -step). 0 is excluded (it represents "no adjustment").
function buildBonusPenaltyLevels(direction, range, step) {
  const st = Number.isFinite(step) && step > 0 ? Number(step) : 1;
  const levels = [];
  if (direction === "bonus") {
    const max = Number.isFinite(range?.max) ? Number(range.max) : 0;
    for (let n = st; n <= max + 1e-9; n += st) levels.push({ level: Number(n.toFixed(4)), text: "" });
  } else {
    const min = Number.isFinite(range?.min) ? Number(range.min) : 0;
    for (let n = -st; n >= min - 1e-9; n -= st) levels.push({ level: Number(n.toFixed(4)), text: "" });
  }
  return levels;
}

// Format a score value with the assessment's unit of measurement.
// unit values: "none" | "%" | "pts" | "x" | "$" | "bps"
function formatScoreValue(value, unit) {
  const u = unit || "none";
  if (u === "%") return `${value}%`;
  if (u === "pts") return `${value} pts`;
  if (u === "x") return `${value}x`;
  if (u === "$") return `$${value}`;
  if (u === "bps") return `${value} bps`;
  return `${value}`;
}

function RangeBadge({ range, unit, className = "" }) {
  if (!range) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-0.5 whitespace-nowrap ${className}`}>
      <span className="text-[9px] uppercase tracking-wide text-gray-400">Range</span>
      <span>{formatScoreValue(range.min, unit)} to {formatScoreValue(range.max, unit)}</span>
    </span>
  );
}

// Shared grid layout for the section header, each section row, and the total row,
// so every column lines up exactly. Columns: expand/drag | name | weight | range | actions.
const SECTION_GRID = "grid items-center gap-2 grid-cols-[36px_1fr_84px_140px_68px]";

/**
 * Editor for scoring matrix template structure: blocks, criteria, and level descriptors.
 * Allows adding, removing, reordering, and editing all elements.
 */
export default function ScoringMatrixTemplateEditor({ blocks, onChange, templateId, templateName, ratingConfig, onRatingConfigChange }) {
  const [expandedBlocks, setExpandedBlocks] = useState({});
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const toggleBlock = (id) => setExpandedBlocks((p) => ({ ...p, [id]: !p[id] }));

  const addBlock = () => {
    const newBlock = {
      id: nextBlockId(),
      name: "New Block",
      weight: 0,
      criteria: []
    };
    onChange([...blocks, newBlock]);
    setExpandedBlocks((p) => ({ ...p, [newBlock.id]: true }));
  };

  const updateBlock = (id, field, value) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const removeBlock = (id) => {
    onChange(blocks.filter((b) => b.id !== id));
  };

  const moveBlock = (id, dir) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
    onChange(newBlocks);
  };

  const addCriterion = (blockId) => {
    const block = blocks.find((b) => b.id === blockId);
    const newCrit = {
      id: nextCritId(),
      number: (block?.criteria?.length || 0) + 1,
      name: "New Criterion",
      category: "",
      descriptors: [1, 2, 3, 4, 5].map((level) => ({ level, text: "" })),
      bonus_penalty_enabled: false,
      bonus_penalty_direction: "penalty",
      bonus_penalty_range: { min: -1, max: 1 },
      bonus_penalty_step: 0,
      bonus_penalty_levels: [],
      bonus_penalty_guidance: ""
    };
    onChange(blocks.map((b) => (b.id === blockId ? { ...b, criteria: [...(b.criteria || []), newCrit] } : b)));
  };

  const updateCriterion = (blockId, critId, field, value) => {
    onChange(blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        criteria: (b.criteria || []).map((c) => (c.id === critId ? { ...c, [field]: value } : c))
      };
    }));
  };

  const removeCriterion = (blockId, critId) => {
    onChange(blocks.map((b) => {
      if (b.id !== blockId) return b;
      return { ...b, criteria: (b.criteria || []).filter((c) => c.id !== critId) };
    }));
  };

  const moveCriterion = (blockId, critId, dir) => {
    onChange(blocks.map((b) => {
      if (b.id !== blockId) return b;
      const criteria = [...(b.criteria || [])];
      const idx = criteria.findIndex((c) => c.id === critId);
      if (idx < 0) return b;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= criteria.length) return b;
      [criteria[idx], criteria[newIdx]] = [criteria[newIdx], criteria[idx]];
      return { ...b, criteria };
    }));
  };

  const updateDescriptor = (blockId, critId, level, text) => {
    onChange(blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        criteria: (b.criteria || []).map((c) => {
          if (c.id !== critId) return c;
          return {
            ...c,
            descriptors: (c.descriptors || []).map((d) => (d.level === level ? { ...d, text } : d))
          };
        })
      };
    }));
  };

  const setDescriptors = (blockId, critId, newDescriptors) => {
    onChange(blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        criteria: (b.criteria || []).map((c) => (c.id === critId ? { ...c, descriptors: newDescriptors } : c))
      };
    }));
  };

  const deleteDescriptor = (blockId, critId, level) => {
    onChange(blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        criteria: (b.criteria || []).map((c) =>
          c.id === critId ? { ...c, descriptors: (c.descriptors || []).filter((d) => d.level !== level) } : c)
      };
    }));
  };

  const updateDescriptorLevel = (blockId, critId, oldLevel, newLevel) => {
    onChange(blocks.map((b) => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        criteria: (b.criteria || []).map((c) => {
          if (c.id !== critId) return c;
          return { ...c, descriptors: (c.descriptors || []).map((d) => (d.level === oldLevel ? { ...d, level: newLevel } : d)) };
        })
      };
    }));
  };

  const handleAiModify = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are helping modify a scoring matrix template structure. Here is the current structure as JSON:\n\n${JSON.stringify(blocks, null, 2)}\n\nThe user wants to make this modification: "${aiPrompt}"\n\nApply the requested changes and return the COMPLETE modified structure as JSON with the same schema. Keep all existing IDs the same unless adding new items (generate new IDs for new items). Return only the JSON, no explanation.`,
        response_json_schema: {
          type: "object",
          properties: {
            blocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  weight: { type: "number" },
                  multiplier_enabled: { type: "boolean" },
                  multiplier: { type: "number" },
                  criteria: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        number: { type: "integer" },
                        name: { type: "string" },
                        category: { type: "string" },
                        multiplier_enabled: { type: "boolean" },
                        multiplier: { type: "number" },
                        descriptors: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              level: { type: "integer" },
                              text: { type: "string" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      if (response.blocks) {
        onChange(response.blocks);
        setAiPrompt("");
        toast({ title: "AI modification applied", description: "Template structure updated." });
      }
    } catch (err) {
      toast({ title: "AI modification failed", description: err?.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const totalWeight = blocks.reduce((sum, b) => sum + (b.weight || 0), 0);
  const totalRange = blocks.reduce((acc, b) => {
    const r = getBlockRange(b);
    if (r) { acc.min += r.min; acc.max += r.max; }
    return acc;
  }, { min: 0, max: 0 });
  const hasAnyRange = blocks.some((b) => getBlockRange(b) != null);
  const multipliersActive = hasActiveMultipliers(blocks);
  const effectiveWeights = computeEffectiveBlockWeights(blocks);
  const effByBlockId = Object.fromEntries(effectiveWeights.map((b) => [b.id, b]));

  return (
    <div className="space-y-3 border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Scoring Matrix Structure</Label>
        <div className="flex items-center gap-3">
          {multipliersActive && (
            <div className="text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded px-1.5 py-0.5 flex items-center gap-1">
              <Sigma className="w-3 h-3" />
              Effective Total: 100% <span className="text-cyan-500 font-normal">(normalized)</span>
            </div>
          )}
          <div className={`text-xs font-medium ${totalWeight === 100 ? "text-green-600" : "text-orange-600"}`}>
            Total Weight: {totalWeight}% {totalWeight !== 100 && "(should be 100%)"}
          </div>
        </div>
      </div>

      {/* Unit of measurement for this assessment */}
      <div className="flex items-center gap-2 text-xs border border-gray-200 rounded-md p-2 bg-gray-50/50">
        <Label className="text-xs font-medium text-gray-700 whitespace-nowrap">Unit of measurement:</Label>
        <select
          value={(ratingConfig && ratingConfig.unit) || "none"}
          onChange={(e) => onRatingConfigChange({ ...(ratingConfig || {}), unit: e.target.value })}
          className="h-7 text-xs rounded-md border border-gray-200 bg-white px-2 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          title="Unit of measure for all scores in this assessment"
        >
          <option value="none">No unit (raw score)</option>
          <option value="%">Percentage (%)</option>
          <option value="pts">Points (pts)</option>
          <option value="x">Multiplier (x)</option>
          <option value="$">Currency ($)</option>
          <option value="bps">Basis points (bps)</option>
        </select>
        <span className="text-gray-400 text-[10px]">
          {(ratingConfig && ratingConfig.unit) === "%" ? "Scores and thresholds are in percent" :
           (ratingConfig && ratingConfig.unit) === "pts" ? "Scores and thresholds are in points" :
           (ratingConfig && ratingConfig.unit) === "x" ? "Scores and thresholds are multipliers" :
           (ratingConfig && ratingConfig.unit) === "$" ? "Scores and thresholds are currency amounts" :
           (ratingConfig && ratingConfig.unit) === "bps" ? "Scores and thresholds are in basis points" :
           "Scores are raw values with no unit"}
        </span>
      </div>

      {/* AI Modification Assistant */}
      <div className="border border-purple-200 rounded-lg p-2 bg-purple-50/30 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-purple-800">
          <Sparkles className="w-3.5 h-3.5" /> AI Assistant — Modify Template
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. 'Add a new block called Risk Management with 15% weight' or 'Rename criterion 3 to Portfolio Construction'"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="text-xs h-8"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAiModify}
            disabled={aiLoading || !aiPrompt.trim()}
            className="border-purple-300 text-purple-700 hover:bg-purple-50 h-8"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Apply
          </Button>
        </div>
      </div>

      {blocks.length === 0 && (
        <div className="text-center py-4 text-xs text-gray-400">
          No scoring blocks yet. Click "Add Block" to start, or use the AI Document Analysis above to generate from a document.
        </div>
      )}

      {blocks.length > 0 && (
        <div className={`${SECTION_GRID} px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-200`}>
          <span />
          <span>Section Name</span>
          <span className="text-center" title="Section weight">Weight %</span>
          <span className="text-center" title="Total score range across this section's criteria">Total Score Range</span>
          <span className="text-center" title="Reorder / delete">Actions</span>
        </div>
      )}

      {blocks.map((block, bIdx) => (
        <div key={block.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className={`${SECTION_GRID} bg-gray-50 px-2 py-2`}>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => toggleBlock(block.id)} className="p-0.5 hover:bg-gray-200 rounded">
                {expandedBlocks[block.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              <GripVertical className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <Input
              value={block.name}
              onChange={(e) => updateBlock(block.id, "name", e.target.value)}
              className="h-7 text-sm font-medium"
              placeholder="Block name..."
            />
            <div className="flex items-center justify-center gap-1 text-xs">
              <Input
                type="number"
                value={block.weight}
                onChange={(e) => updateBlock(block.id, "weight", parseFloat(e.target.value) || 0)}
                className="h-7 w-16 text-sm text-center"
                placeholder="0"
              />
              <span className="text-gray-500">%</span>
            </div>
            <div className="flex justify-center">
              <RangeBadge range={getBlockRange(block)} unit={(ratingConfig && ratingConfig.unit) || "none"} title="Total score range for this section (sum of its criteria)" />
            </div>
            <div className="flex items-center justify-center gap-0.5">
              <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={bIdx === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-xs">
                ↑
              </button>
              <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={bIdx === blocks.length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-xs">
                ↓
              </button>
              <button type="button" onClick={() => removeBlock(block.id)} className="p-1 rounded hover:bg-red-100 text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {expandedBlocks[block.id] && (
            <div className="p-2 space-y-2">
              {(block.criteria || []).map((crit, cIdx) => (
                <div key={crit.id} className="border border-gray-100 rounded-md p-2 space-y-2 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-6">#{crit.number || cIdx + 1}</span>
                    <Input
                      value={crit.name}
                      onChange={(e) => updateCriterion(block.id, crit.id, "name", e.target.value)}
                      className="h-7 text-xs flex-1"
                      placeholder="Criterion name..."
                    />
                    <Input
                      value={crit.category || ""}
                      onChange={(e) => updateCriterion(block.id, crit.id, "category", e.target.value)}
                      className="h-7 text-xs w-40"
                      placeholder="Category..."
                    />
                    <RangeBadge range={getCriterionRange(crit)} unit={(ratingConfig && ratingConfig.unit) || "none"} title="Total score range for this criterion (includes bonus/penalty)" />
                    {/* Multiplier factor toggle (sub-section / criterion level) */}
                    <button
                      type="button"
                      onClick={() => updateCriterion(block.id, crit.id, "multiplier_enabled", !crit.multiplier_enabled)}
                      className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-xs border ${
                        crit.multiplier_enabled
                          ? "bg-cyan-50 border-cyan-300 text-cyan-700"
                          : "bg-white border-gray-200 text-gray-400 hover:text-gray-600"
                      }`}
                      title={crit.multiplier_enabled ? "Disable criterion multiplier" : "Enable multiplier factor for this sub-section (weights it within its block)"}
                    >
                      {crit.multiplier_enabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      ×
                    </button>
                    {crit.multiplier_enabled && (
                      <Input
                        type="number"
                        step="0.1"
                        value={crit.multiplier == null ? 1 : crit.multiplier}
                        onChange={(e) => updateCriterion(block.id, crit.id, "multiplier", parseFloat(e.target.value) || 1)}
                        className="h-7 w-14 text-xs text-center"
                        placeholder="1"
                        title="Multiplier weighting this criterion within its block (1 = equal weight)"
                      />
                    )}
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => moveCriterion(block.id, crit.id, -1)} disabled={cIdx === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-xs">
                        ↑
                      </button>
                      <button type="button" onClick={() => moveCriterion(block.id, crit.id, 1)} disabled={cIdx === (block.criteria || []).length - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-xs">
                        ↓
                      </button>
                      <button type="button" onClick={() => removeCriterion(block.id, crit.id)} className="p-1 rounded hover:bg-red-100 text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="pl-8 flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] text-gray-500 font-medium">Scoring:</span>
                    <button
                      type="button"
                      onClick={() => updateCriterion(block.id, crit.id, "scoring_mode", "levels")}
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        (crit.scoring_mode || "levels") === "levels"
                          ? "bg-cyan-50 border-cyan-300 text-cyan-700 font-medium"
                          : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Levels
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCriterion(block.id, crit.id, "scoring_mode", "single")}
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        crit.scoring_mode === "single"
                          ? "bg-violet-50 border-violet-300 text-violet-700 font-medium"
                          : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Single Score
                    </button>
                  </div>
                  {crit.scoring_mode === "single" ? (
                    <div className="pl-8 flex items-center gap-2 bg-violet-50/30 border border-violet-100 rounded-md p-2">
                      <Label className="text-xs text-gray-600 whitespace-nowrap">Score range:</Label>
                      <Input
                        type="number"
                        value={crit.single_score_min ?? 0}
                        onChange={(e) => updateCriterion(block.id, crit.id, "single_score_min", parseFloat(e.target.value) || 0)}
                        className="h-7 w-16 text-xs text-center"
                        placeholder="min"
                      />
                      <span className="text-gray-400 text-xs">to</span>
                      <Input
                        type="number"
                        value={crit.single_score_max ?? 100}
                        onChange={(e) => updateCriterion(block.id, crit.id, "single_score_max", parseFloat(e.target.value) || 0)}
                        className="h-7 w-16 text-xs text-center"
                        placeholder="max"
                      />
                      <span className="text-[10px] text-gray-400">
                        (analyst picks one value from a dropdown of {Math.max(0, Math.round((crit.single_score_max ?? 100) - (crit.single_score_min ?? 0)))} options)
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="pl-8">
                        <ScoringLevelRangeGenerator
                          descriptors={crit.descriptors || []}
                          onGenerate={(newDescriptors) => setDescriptors(block.id, crit.id, newDescriptors)}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 pl-8">
                        {(crit.descriptors || []).map((desc) => (
                          <div key={desc.level} className="flex items-start gap-2 group">
                            <Input
                              type="number"
                              value={desc.level}
                              onChange={(e) => updateDescriptorLevel(block.id, crit.id, desc.level, parseFloat(e.target.value))}
                              className={`text-xs font-bold w-14 h-7 text-center flex-shrink-0 px-1 ${
                                desc.level === 1 ? "bg-red-50 text-red-700 border-red-200" :
                                desc.level === 2 ? "bg-orange-50 text-orange-700 border-orange-200" :
                                desc.level === 3 ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                                desc.level === 4 ? "bg-lime-50 text-lime-700 border-lime-200" :
                                "bg-green-50 text-green-700 border-green-200"
                              }`}
                            />
                            <Textarea
                              value={desc.text}
                              onChange={(e) => updateDescriptor(block.id, crit.id, desc.level, e.target.value)}
                              className="text-xs min-h-[40px] flex-1"
                              placeholder={`Level ${desc.level} descriptor...`}
                            />
                            <button
                              type="button"
                              onClick={() => deleteDescriptor(block.id, crit.id, desc.level)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600 flex-shrink-0 mt-1"
                              title="Delete level"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Bonus / Penalty configuration */}
                  <div className="pl-8 border-t border-gray-100 pt-2 mt-1">
                    <button
                      type="button"
                      onClick={() => updateCriterion(block.id, crit.id, "bonus_penalty_enabled", !crit.bonus_penalty_enabled)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
                    >
                      {crit.bonus_penalty_enabled ? (
                        <ToggleRight className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                      )}
                      Bonus / Penalty Adjustment
                    </button>
                    {crit.bonus_penalty_enabled && (
                      <div className="mt-1.5 space-y-2 bg-indigo-50/30 border border-indigo-100 rounded-md p-2">
                        {/* Direction selector — mutually exclusive: Bonus OR Penalty */}
                        <div className="flex items-center gap-2 text-xs">
                          <Label className="text-xs text-gray-600 whitespace-nowrap">Type:</Label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateCriterion(block.id, crit.id, "bonus_penalty_direction", "bonus")}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${crit.bonus_penalty_direction === "bonus" ? "bg-green-100 border-green-400 text-green-700" : "bg-white border-gray-200 text-gray-500 hover:text-green-700 hover:border-green-300"}`}
                              title="Bonus — positive adjustment added to the score"
                            >
                              + Bonus
                            </button>
                            <button
                              type="button"
                              onClick={() => updateCriterion(block.id, crit.id, "bonus_penalty_direction", "penalty")}
                              className={`px-2 py-0.5 rounded text-[11px] font-medium border ${crit.bonus_penalty_direction === "penalty" ? "bg-red-100 border-red-400 text-red-700" : "bg-white border-gray-200 text-gray-500 hover:text-red-700 hover:border-red-300"}`}
                              title="Penalty — negative adjustment subtracted from the score"
                            >
                              − Penalty
                            </button>
                          </div>
                          <span className="text-gray-400 text-[10px]">
                            {crit.bonus_penalty_direction === "bonus" ? "(positive values added to the score)" : "(negative values subtracted from the score)"}
                          </span>
                        </div>

                        {/* Direction-aware range + step + generate */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Label className="text-xs text-gray-600 whitespace-nowrap">Range:</Label>
                          {crit.bonus_penalty_direction === "penalty" ? (
                            <>
                              <Input
                                type="number"
                                step="0.5"
                                value={crit.bonus_penalty_range?.min ?? -1}
                                onChange={(e) => updateCriterion(block.id, crit.id, "bonus_penalty_range", {
                                  ...crit.bonus_penalty_range,
                                  min: parseFloat(e.target.value) || 0,
                                  max: 0
                                })}
                                className="h-7 w-16 text-xs text-center"
                                placeholder="min"
                              />
                              <span className="text-gray-400">to</span>
                              <Input
                                type="number"
                                value={0}
                                disabled
                                className="h-7 w-16 text-xs text-center bg-gray-50 text-gray-400"
                                placeholder="max"
                              />
                            </>
                          ) : (
                            <>
                              <Input
                                type="number"
                                value={0}
                                disabled
                                className="h-7 w-16 text-xs text-center bg-gray-50 text-gray-400"
                                placeholder="min"
                              />
                              <span className="text-gray-400">to</span>
                              <Input
                                type="number"
                                step="0.5"
                                value={crit.bonus_penalty_range?.max ?? 1}
                                onChange={(e) => updateCriterion(block.id, crit.id, "bonus_penalty_range", {
                                  ...crit.bonus_penalty_range,
                                  min: 0,
                                  max: parseFloat(e.target.value) || 0
                                })}
                                className="h-7 w-16 text-xs text-center"
                                placeholder="max"
                              />
                            </>
                          )}
                          <span className="text-gray-400">every</span>
                          <Input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={crit.bonus_penalty_step ?? 0}
                            onChange={(e) => updateCriterion(block.id, crit.id, "bonus_penalty_step", parseFloat(e.target.value) || 0)}
                            className="h-7 w-14 text-xs text-center"
                            placeholder="step"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const levels = buildBonusPenaltyLevels(crit.bonus_penalty_direction, crit.bonus_penalty_range, crit.bonus_penalty_step);
                              updateCriterion(block.id, crit.id, "bonus_penalty_levels", levels);
                              if (levels.length === 0) toast({ title: "No levels generated", description: "Increase the range or decrease the step.", variant: "destructive" });
                              else toast({ title: `Generated ${levels.length} level${levels.length === 1 ? "" : "s"}`, description: `${crit.bonus_penalty_direction === "bonus" ? "0 → " + (crit.bonus_penalty_range?.max ?? 0) : (crit.bonus_penalty_range?.min ?? 0) + " → 0"} every ${crit.bonus_penalty_step ?? 1}.` });
                            }}
                            className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                          >
                            <Sparkles className="w-3 h-3" /> Generate levels
                          </Button>
                        </div>

                        {/* Generated levels — editable descriptor text per value */}
                        {Array.isArray(crit.bonus_penalty_levels) && crit.bonus_penalty_levels.length > 0 && (
                          <div className="space-y-1 bg-white/60 border border-indigo-100 rounded p-1.5">
                            <span className="text-[10px] uppercase tracking-wide text-gray-400">Adjustment levels</span>
                            {crit.bonus_penalty_levels.map((lvl, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center justify-center w-12 text-[11px] font-semibold rounded px-1 py-0.5 ${lvl.level > 0 ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`} title={lvl.level > 0 ? "Bonus" : "Penalty"}>
                                  {lvl.level > 0 ? "+" : ""}{lvl.level}
                                </span>
                                <Input
                                  value={lvl.text || ""}
                                  onChange={(e) => updateCriterion(block.id, crit.id, "bonus_penalty_levels", crit.bonus_penalty_levels.map((l, i) => i === idx ? { ...l, text: e.target.value } : l))}
                                  className="h-7 flex-1 text-xs"
                                  placeholder={`Descriptor for ${lvl.level > 0 ? "+" : ""}${lvl.level} (optional)`}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateCriterion(block.id, crit.id, "bonus_penalty_levels", crit.bonus_penalty_levels.filter((_, i) => i !== idx))}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                  title="Remove level"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <Textarea
                          value={crit.bonus_penalty_guidance || ""}
                          onChange={(e) => updateCriterion(block.id, crit.id, "bonus_penalty_guidance", e.target.value)}
                          className="text-xs min-h-[40px]"
                          placeholder="Guidance for the analyst: when to apply the bonus/penalty and how it factors into the total score (e.g. 'Apply a +0.5 bonus for exceptional ESG integration beyond the score level; apply a -0.5 penalty if the manager lacks documented process. The adjustment is added to the final score before computing the weighted total.')"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => addCriterion(block.id)} className="text-xs h-7 text-cyan-600">
                <Plus className="w-3 h-3" /> Add Criterion
              </Button>
            </div>
          )}
        </div>
      ))}
      {blocks.length > 0 && (
        <div className={`${SECTION_GRID} px-2 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold`}>
          <span />
          <span className="text-gray-600">Total</span>
          <span className={`text-center ${totalWeight === 100 ? "text-green-600" : "text-orange-600"}`} title="Sum of all section weights">
            {totalWeight}%
          </span>
          <span className="flex justify-center" title="Total score range across all sections">
            {hasAnyRange ? <RangeBadge range={totalRange} unit={(ratingConfig && ratingConfig.unit) || "none"} /> : <span className="text-gray-400 font-normal">—</span>}
          </span>
          <span />
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={addBlock} className="w-full text-xs">
        <Plus className="w-3.5 h-3.5" /> Add Block
      </Button>

      {/* Overall rating configuration — Pass/Fail threshold + auto-assigned rating options */}
      <ScoringRatingConfigEditor ratingConfig={ratingConfig} onChange={onRatingConfigChange} />

      {/* AI Rubric Audit — analyzes the rubric for bias, redundancy, and improvements */}
      <ScoringMatrixRubricAudit blocks={blocks} onChange={onChange} templateId={templateId} templateName={templateName} />
    </div>
  );
}