import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";
import ActivityTimeline from "@/components/activity/ActivityTimeline";

// Collapsible dashboard section that embeds the centralized Activity Timeline
// inline so users see a chronological history of every interaction across all
// firms without leaving the main dashboard. Respects the global expand/collapse
// toggle like the other dashboard sections.
export default function DashboardTimelineSection({ forceExpanded, onActivityClick }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (forceExpanded !== undefined) setExpanded(forceExpanded);
  }, [forceExpanded]);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full mb-2 px-1 group"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        )}
        <GitBranch className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">
          Activity Timeline
        </span>
        <span className="text-[11px] text-gray-400 font-normal hidden sm:inline">
          Chronological history across all firms
        </span>
      </button>
      {expanded && (
        <div className="pl-2 border-l-2 border-gray-100">
          <ActivityTimeline onActivityClick={onActivityClick} hideHeader />
        </div>
      )}
    </div>
  );
}