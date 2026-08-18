import React, { useState } from "react";
import { FileBarChart, ChevronRight, ChevronDown } from "lucide-react";

/**
 * Reporting navigation section.
 * Renders Reporting as a parent row with Analytics and Reports as nested
 * expandable sub-items (passed as children), mirroring the header "Reporting"
 * icon's submenu. Children stay mounted (just hidden when collapsed) so
 * their modals (e.g. the Analytics launch modal) remain functional.
 */
export default function ReportingNavSection({ totalAnalyses = 0, forceExpanded, children }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded !== undefined ? forceExpanded : expanded;

  return (
    <div className="mb-6">
      {/* Parent row: Reporting */}
      <div className="flex items-center justify-between mb-1 px-1">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 group"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded
            ? <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            : <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
          }
          <FileBarChart className="w-4 h-4 text-cyan-600" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">Reporting</span>
          <span className="text-xs text-gray-400 font-normal">({totalAnalyses})</span>
        </button>
      </div>

      {/* Nested sub-items — kept mounted, hidden when collapsed */}
      <div className={`ml-6 mt-1 border-l border-gray-200 pl-3 ${isExpanded ? "" : "hidden"}`}>
        {children}
      </div>
    </div>
  );
}