import React from "react";
import { Filter, Building2, ListTodo } from "lucide-react";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const TASK_STATUSES = ["Not Started", "In-process", "Completed", "Cancelled"];

export default function CalendarFilterSidebar({
  selectedFirmTypes,
  selectedTaskStatuses,
  onToggleFirmType,
  onToggleTaskStatus,
  onClearAll,
  hasActiveFilters,
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900 text-sm">Filters</h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
        {/* Firm Type filter */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Firm Type
            </h4>
          </div>
          <div className="space-y-0.5">
            {FIRM_TYPES.map((type) => {
              const checked = selectedFirmTypes.has(type);
              return (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-md transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleFirmType(type)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-1"
                  />
                  <span className="text-sm text-gray-700">{type}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 px-2 text-[11px] text-gray-400">
            Applies to activities only
          </p>
        </div>

        {/* Task Status filter */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ListTodo className="w-3.5 h-3.5 text-gray-400" />
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Task Status
            </h4>
          </div>
          <div className="space-y-0.5">
            {TASK_STATUSES.map((status) => {
              const checked = selectedTaskStatuses.has(status);
              return (
                <label
                  key={status}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-md transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleTaskStatus(status)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-1"
                  />
                  <span className="text-sm text-gray-700">{status}</span>
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 px-2 text-[11px] text-gray-400">
            Applies to tasks only
          </p>
        </div>
      </div>
    </div>
  );
}