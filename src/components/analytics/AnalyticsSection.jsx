import React, { useState } from "react";
import { LineChart, ChevronDown, ChevronUp, Plus } from "lucide-react";
import AnalysisLaunchModal from "./AnalysisLaunchModal";
import NewAnalysisDialog from "./NewAnalysisDialog";
import ExistingAnalysesDialog from "./ExistingAnalysesDialog";

export default function AnalyticsSection({ openLaunch, onLaunchOpenChange }) {
  const [expanded, setExpanded] = useState(false);
  const launchOpen = openLaunch ?? false;
  const setLaunchOpen = onLaunchOpenChange ?? (() => {});
  const [newOpen, setNewOpen] = useState(false);
  const [existingOpen, setExistingOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0">
            <LineChart className="w-4 h-4 text-cyan-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-800 tracking-tight">Analytics</h2>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 ml-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
          )}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-4 space-y-2">
          <button
            onClick={() => setNewOpen(true)}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-400 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Analysis
          </button>
          <button
            onClick={() => setExistingOpen(true)}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <LineChart className="w-4 h-4" />
            View Existing Analyses
          </button>
        </div>
      )}

      {/* Launch choice modal */}
      <AnalysisLaunchModal
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        onNew={() => { setLaunchOpen(false); setNewOpen(true); }}
        onViewExisting={() => { setLaunchOpen(false); setExistingOpen(true); }}
      />

      {/* New analysis dialog */}
      <NewAnalysisDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onSaved={(analysis) => {
          console.log("Analysis saved:", analysis);
        }}
      />

      {/* Existing analyses dialog */}
      <ExistingAnalysesDialog
        open={existingOpen}
        onOpenChange={setExistingOpen}
        onSelect={(analysis) => {
          console.log("Selected analysis:", analysis);
        }}
      />
    </div>
  );
}