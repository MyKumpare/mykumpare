import React from "react";
import { Check, X, FileText, ListTree, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Read-only preview of an AI-generated template structure (scoring matrix
 * blocks or process-template stages) shown before the user applies it to
 * their template. Lets the user review the structure and decide whether to
 * accept or discard it.
 *
 * Props:
 *   structure  — { type: "scoring" | "process", blocks?, stages? }
 *   onApply    — () => void   (accept the structure and load it into the editor)
 *   onDiscard  — () => void   (reject the structure and start over)
 */
export default function TemplateStructurePreview({ structure, onApply, onDiscard }) {
  if (!structure) return null;
  const isScoring = structure.type === "scoring";
  const blocks = structure.blocks || [];
  const stages = structure.stages || [];

  const totalWeight = blocks.reduce((sum, b) => sum + (b.weight || 0), 0);

  return (
    <div className="border-2 border-emerald-300 rounded-lg p-3 bg-emerald-50/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
          {isScoring ? <Layers className="w-4 h-4" /> : <ListTree className="w-4 h-4" />}
          Preview — Generated Structure
        </div>
        <span className="text-[11px] text-gray-500 font-normal">
          Review before applying to your template
        </span>
      </div>

      <div className="max-h-[280px] overflow-y-auto rounded-md border border-emerald-200 bg-white">
        {isScoring ? (
          <div className="p-3 space-y-3">
            {blocks.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No blocks generated.</p>
            )}
            {blocks.map((block, bIdx) => (
              <div key={bIdx} className="border border-gray-200 rounded-md overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5">
                  <span className="text-sm font-semibold text-gray-800">
                    {bIdx + 1}. {block.name || "(unnamed block)"}
                  </span>
                  <span className="text-xs font-medium text-gray-500">{block.weight || 0}%</span>
                </div>
                <div className="p-2 space-y-1.5">
                  {(block.criteria || []).map((crit, cIdx) => (
                    <div key={cIdx} className="pl-3 border-l-2 border-emerald-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">#{crit.number || cIdx + 1}</span>
                        <span className="text-xs font-medium text-gray-700">{crit.name || "(unnamed criterion)"}</span>
                        {crit.category && (
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {crit.category}
                          </span>
                        )}
                      </div>
                      {(crit.descriptors || []).length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {crit.descriptors.map((desc) => (
                            <div key={desc.level} className="flex items-start gap-1.5 pl-1">
                              <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                desc.level === 1 ? "bg-red-100 text-red-700" :
                                desc.level === 2 ? "bg-orange-100 text-orange-700" :
                                desc.level === 3 ? "bg-yellow-100 text-yellow-700" :
                                desc.level === 4 ? "bg-lime-100 text-lime-700" :
                                "bg-green-100 text-green-700"
                              }`}>
                                {desc.level}
                              </span>
                              <span className="text-[11px] text-gray-600 leading-snug">{desc.text || "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {(block.criteria || []).length === 0 && (
                    <p className="text-[11px] text-gray-400 pl-3">No criteria in this block.</p>
                  )}
                </div>
              </div>
            ))}
            {blocks.length > 0 && (
              <div className={`text-xs font-medium text-center pt-1 ${totalWeight === 100 ? "text-green-600" : "text-orange-600"}`}>
                Total Weight: {totalWeight}% {totalWeight !== 100 && "(should be 100%)"}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {stages.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No sections generated.</p>
            )}
            {stages.map((stage, sIdx) => (
              <div key={sIdx} className="border border-gray-200 rounded-md overflow-hidden">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800">
                    {sIdx + 1}. {stage.name || "(unnamed section)"}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {(stage.sub_stages || []).length} item{(stage.sub_stages || []).length !== 1 ? "s" : ""}
                  </span>
                </div>
                {(stage.sub_stages || []).length > 0 && (
                  <ul className="p-2 pl-5 space-y-1">
                    {stage.sub_stages.map((ss, ssIdx) => (
                      <li key={ssIdx} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="text-gray-300 mt-0.5">•</span>
                        <span>{ss.name || "(unnamed)"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onApply}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Check className="w-3.5 h-3.5" /> Apply to Template
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDiscard}
          className="border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          <X className="w-3.5 h-3.5" /> Discard
        </Button>
      </div>
    </div>
  );
}