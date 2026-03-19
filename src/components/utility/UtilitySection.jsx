import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

export default function UtilitySection({ deletedCount }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-6">
      {/* Section header */}
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
            Utility
          </span>
        </button>
      </div>

      {/* Utility options */}
      {expanded && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-100">
          <Link
            to="/DeletedRecords"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-colors group"
          >
            <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-800 group-hover:text-gray-900">
                Deleted Records
              </span>
            </div>
            {deletedCount > 0 && (
              <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-full flex-shrink-0">
                {deletedCount}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />
          </Link>
        </div>
      )}
    </div>
  );
}