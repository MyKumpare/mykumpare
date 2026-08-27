import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";

let _blockId = 0;
const nextBlockId = () => `smb_${Date.now()}_${++_blockId}`;
let _critId = 0;
const nextCritId = () => `smc_${Date.now()}_${++_critId}`;

/**
 * Editor for scoring matrix template structure: blocks, criteria, and level descriptors.
 * Allows adding, removing, reordering, and editing all elements.
 */
export default function ScoringMatrixTemplateEditor({ blocks, onChange }) {
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
      descriptors: [1, 2, 3, 4, 5].map((level) => ({ level, text: "" }))
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
                  criteria: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        number: { type: "integer" },
                        name: { type: "string" },
                        category: { type: "string" },
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

  return (
    <div className="space-y-3 border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Scoring Matrix Structure</Label>
        <div className={`text-xs font-medium ${totalWeight === 100 ? "text-green-600" : "text-orange-600"}`}>
          Total Weight: {totalWeight}% {totalWeight !== 100 && "(should be 100%)"}
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
    </div>
  );
}