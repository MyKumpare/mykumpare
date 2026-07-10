import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";

export default function ReportsSection({ forceExpanded = false }) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = forceExpanded || expanded;

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 mb-3 group"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-blue-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
        )}
        <span className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
          Reports
        </span>
        <FileText className="w-4 h-4 text-blue-400" />
      </button>
      {isOpen && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-6 text-center">
          <FileText className="w-8 h-8 text-blue-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 italic">
            Reports coming soon
          </p>
        </div>
      )}
    </div>
  );
}