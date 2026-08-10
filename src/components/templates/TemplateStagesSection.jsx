import React, { useState, useEffect } from "react";
import DueDiligenceStagesEditor from "@/components/firms/DueDiligenceStagesEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

let _tid = 0;
const nextId = () => `tstage_${Date.now()}_${++_tid}`;

/**
 * Section shown when "Manager Due Diligence" template type is selected.
 * User enters how many stages they want; the system auto-creates that many
 * blank stages, then the user fills in each Stage Name and can re-arrange
 * via drag-and-drop (handled by DueDiligenceStagesEditor).
 */
export default function TemplateStagesSection({ stages, onChange, sectionLabel = "Stage" }) {
  const [countInput, setCountInput] = useState(stages.length > 0 ? String(stages.length) : "");

  // Sync count input when stages are changed externally (e.g. from file upload extraction)
  useEffect(() => {
    setCountInput(stages.length > 0 ? String(stages.length) : "");
  }, [stages.length]);

  const totalQuestions = stages.reduce((sum, s) => sum + (s.sub_stages?.length || 0), 0);

  const applyCount = (raw) => {
    const n = Math.max(0, Math.min(50, parseInt(raw, 10) || 0));
    setCountInput(raw === "" ? "" : String(n));
    if (n === stages.length) return;
    if (n > stages.length) {
      const additions = Array.from({ length: n - stages.length }, () => ({ id: nextId(), name: "" }));
      onChange([...stages, ...additions]);
    } else {
      onChange(stages.slice(0, n));
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Number of {sectionLabel}s *</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={50}
            value={countInput}
            onChange={(e) => setCountInput(e.target.value)}
            onBlur={(e) => applyCount(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCount(e.target.value); } }}
            placeholder={`Enter number of ${sectionLabel.toLowerCase()}s...`}
            className="h-8 text-sm w-48"
          />
          <span className="text-xs text-gray-500">{stages.length} {sectionLabel.toLowerCase()}{stages.length === 1 ? "" : "s"} created</span>
          <div className="flex items-center gap-2 ml-4">
            <Label className="text-xs font-medium text-gray-700">Number of Questions</Label>
            <span className="text-xs text-gray-500">{totalQuestions} question{totalQuestions === 1 ? "" : "s"}</span>
          </div>
        </div>
      </div>

      {stages.length > 0 && (
        <DueDiligenceStagesEditor
          stages={stages}
          onChange={onChange}
          headerTitle={sectionLabel === "Section" ? "Questionnaire" : "Due Diligence Stages"}
        />
      )}
    </div>
  );
}