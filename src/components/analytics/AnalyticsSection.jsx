import React, { useState } from "react";
import { LineChart, ChevronDown } from "lucide-react";
import AnalysisLaunchModal from "./AnalysisLaunchModal";
import NewAnalysisDialog from "./NewAnalysisDialog";
import ExistingAnalysesDialog from "./ExistingAnalysesDialog";

export default function AnalyticsSection() {
  const [expanded, setExpanded] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [existingOpen, setExistingOpen] = useState(false);

  const handleHeaderClick = () => {
    setLaunchOpen(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      {/* Clickable header */}
      <button
        onClick={handleHeaderClick}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center">
            <LineChart className="w-4 h-4 text-cyan-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-800 tracking-tight">Analytics</h2>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

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
          // future: open the analysis viewer
          console.log("Analysis saved:", analysis);
        }}
      />

      {/* Existing analyses dialog */}
      <ExistingAnalysesDialog
        open={existingOpen}
        onOpenChange={setExistingOpen}
        onSelect={(analysis) => {
          // future: open the analysis viewer/editor
          console.log("Selected analysis:", analysis);
        }}
      />
    </div>
  );
}