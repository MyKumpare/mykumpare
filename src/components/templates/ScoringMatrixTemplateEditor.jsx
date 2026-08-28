import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Sparkles, Loader2, ToggleLeft, ToggleRight, Sigma } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ScoringMatrixRubricAudit from "./ScoringMatrixRubricAudit";
import ScoringRatingConfigEditor from "./ScoringRatingConfigEditor";
import { toast } from "@/components/ui/use-toast";
import { computeEffectiveBlockWeights, hasActiveMultipliers } from "@/components/templates/scoringWeightLogic";

let _blockId = 0;
const nextBlockId = () => `smb_${Date.now()}_${++_blockId}`;
let _critId = 0;
const nextCritId = () => `smc_${Date.now()}_${++_critId}`;

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
      bonus_penalty_range: { min: -1, max: 1 },
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

      {blocks.map((block, bIdx) => (
        <div key={block.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 bg-gray-50 px-2 py-2">
            <button type="button" onClick={() => toggleBlock(block.id)} className="p-0.5 hover:bg-gray-200 rounded">
              {expandedBlocks[block.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            <GripVertical className="w-3.5 h-3.5 text-gray-300" />
            <Input
              value={block.name}
              onChange={(e) => updateBlock(block.id, "name", e.target.value)}
              className="h-7 text-sm font-medium flex-1"
              placeholder="Block name..."
            />
            <div className="flex items-center gap-1 text-xs">
              <Input
                type="number"
                value={block.weight}
                onChange={(e) => updateBlock(block.id, "weight", parseFloat(e.target.value) || 0)}
                className="h-7 w-16 text-sm text-center"
                placeholder="0"
              />
              <span className="text-gray-500">%</span>
            </div>
            {/* Multiplier factor toggle (section level) */}
            <button
              type="button"
              onClick={() => updateBlock(block.id, "multiplier_enabled", !block.multiplier_enabled)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs border ${
                block.multiplier_enabled
                  ? "bg-cyan-50 border-cyan-300 text-cyan-700"
                  : "bg-white border-gray-200 text-gray-400 hover:text-gray-600"
              }`}
              title={block.multiplier_enabled ? "Disable multiplier factor" : "Enable multiplier factor for this section"}
            >
              {block.multiplier_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              ×
            </button>
            {block.multiplier_enabled && (
              <div className="flex items-center gap-1 text-xs">
                <Input
                  type="number"
                  step="0.1"
                  value={block.multiplier == null ? 1 : block.multiplier}
                  onChange={(e) => updateBlock(block.id, "multiplier", parseFloat(e.target.value) || 1)}
                  className="h-7 w-14 text-sm text-center"
                  placeholder="1"
                />
                <span className="text-cyan-700 font-medium whitespace-nowrap" title="Effective weight after multiplier, normalized to 100% total">
                  → {effByBlockId[block.id]?.normalizedPct.toFixed(1)}%
                </span>
              </div>
            )}
            <div className="flex items-center gap-0.5">
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
          {block.multiplier_enabled && (
            <div className="px-2 pb-1.5 text-[10px] text-cyan-600 bg-cyan-50/40">
              Section multiplier active — effective weight {effByBlockId[block.id]?.effectiveWeight.toFixed(1)} ({effByBlockId[block.id]?.normalizedPct.toFixed(1)}% of total). Overall score normalizes all sections to 100%.
            </div>
          )}
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
                  <div className="grid grid-cols-1 gap-1.5 pl-8">
                    {(crit.descriptors || []).map((desc) => (
                      <div key={desc.level} className="flex items-start gap-2">
                        <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          desc.level === 1 ? "bg-red-100 text-red-700" :
                          desc.level === 2 ? "bg-orange-100 text-orange-700" :
                          desc.level === 3 ? "bg-yellow-100 text-yellow-700" :
                          desc.level === 4 ? "bg-lime-100 text-lime-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {desc.level}
                        </span>
                        <Textarea
                          value={desc.text}
                          onChange={(e) => updateDescriptor(block.id, crit.id, desc.level, e.target.value)}
                          className="text-xs min-h-[40px] flex-1"
                          placeholder={`Level ${desc.level} descriptor...`}
                        />
                      </div>
                    ))}
                  </div>

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
                      <div className="mt-1.5 space-y-1.5 bg-indigo-50/30 border border-indigo-100 rounded-md p-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Label className="text-xs text-gray-600 whitespace-nowrap">Range:</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.5"
                              value={crit.bonus_penalty_range?.min ?? -1}
                              onChange={(e) => updateCriterion(block.id, crit.id, "bonus_penalty_range", {
                                ...crit.bonus_penalty_range,
                                min: parseFloat(e.target.value) || 0
                              })}
                              className="h-7 w-16 text-xs text-center"
                              placeholder="min"
                            />
                            <span className="text-gray-400">to</span>
                            <Input
                              type="number"
                              step="0.5"
                              value={crit.bonus_penalty_range?.max ?? 1}
                              onChange={(e) => updateCriterion(block.id, crit.id, "bonus_penalty_range", {
                                ...crit.bonus_penalty_range,
                                max: parseFloat(e.target.value) || 0
                              })}
                              className="h-7 w-16 text-xs text-center"
                              placeholder="max"
                            />
                          </div>
                          <span className="text-gray-400 text-[10px]">(negative = penalty, positive = bonus)</span>
                        </div>
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