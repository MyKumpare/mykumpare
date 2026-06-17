import React, { useState, useEffect } from "react";
import { LineChart, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnalysisLaunchModal from "./AnalysisLaunchModal";
import NewAnalysisDialog from "./NewAnalysisDialog";
import ExistingAnalysesDialog from "./ExistingAnalysesDialog";

export default function AnalyticsSection({ openLaunch, onLaunchOpenChange, totalAnalyses = 0, forceExpanded, editingAnalysis, onEditAnalysisChange }) {
  const [expanded, setExpanded] = useState(false);
  const launchOpen = openLaunch ?? false;
  const setLaunchOpen = onLaunchOpenChange ?? (() => {});
  const [newOpen, setNewOpen] = useState(false);
  const [existingOpen, setExistingOpen] = useState(false);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  return (
    <div className="mb-6">
      {/* Section header - uniform layout */}
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          )}
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
            Analytics
          </span>
          <span className="text-xs text-gray-400 font-normal">({totalAnalyses})</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 gap-1 text-xs"
          onClick={() => setNewOpen(true)}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Analysis
        </Button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100">
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
          setExistingOpen(false);
          if (onEditAnalysisChange) onEditAnalysisChange(analysis);
        }}
      />
    </div>
  );
}