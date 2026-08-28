import React, { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Upload, ArrowLeft, Check } from "lucide-react";
import CsvFirmImport from "./CsvFirmImport";

// Wizard step metadata — order matches the CsvFirmImport stage flow.
const STEPS = [
  { key: "upload", label: "Upload" },
  { key: "mapping", label: "Map Columns" },
  { key: "review", label: "Review" },
  { key: "importing", label: "Import" },
  { key: "job_status", label: "Done" },
];

function Stepper({ currentStage }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStage);
  // "results" stage maps to the Done step
  const activeIdx = currentStage === "results" ? STEPS.length - 1 : currentIdx;

  return (
    <div className="flex items-center gap-1 px-1 py-3">
      {STEPS.map((step, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        return (
          <React.Fragment key={step.key}>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-colors ${
                  isDone
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : isActive
                    ? "bg-indigo-50 text-indigo-700 border-indigo-300"
                    : "bg-gray-50 text-gray-400 border-gray-200"
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isActive ? "text-indigo-700" : isDone ? "text-gray-600" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 transition-colors ${
                  i < activeIdx ? "bg-indigo-400" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Firm Import Wizard — a step-by-step dialog that wraps the existing
 * CsvFirmImport flow with a visual stepper so users can see their progress
 * through Upload → Map → Review → Import → Done.
 */
export default function FirmImportWizard({ open, onOpenChange }) {
  const [stage, setStage] = useState("upload");

  const handleStageChange = useCallback((s) => setStage(s), []);

  // When the dialog closes, reset the stage so the next open starts fresh.
  const handleOpenChange = (v) => {
    if (!v) setStage("upload");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-600" />
            Import Firms from Spreadsheet
          </DialogTitle>
        </DialogHeader>

        <Stepper currentStage={stage} />

        <div className="overflow-y-auto flex-1 pr-1 -mr-1">
          <CsvFirmImport onStageChange={handleStageChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
}