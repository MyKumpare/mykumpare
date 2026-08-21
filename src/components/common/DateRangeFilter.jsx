import React from "react";
import { Calendar, X } from "lucide-react";

// Compact start/end date range filter for the contact and firm search screens.
// `value` is { start: "", end: "" }; `onChange` receives the new object.
export default function DateRangeFilter({ value, onChange, label = "Date range" }) {
  const { start = "", end = "" } = value || {};
  const hasValue = !!(start || end);

  return (
    <div className="flex items-center gap-1.5">
      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <input
        type="date"
        value={start}
        max={end || undefined}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
        placeholder="Start"
        title={`${label} — start date`}
        className="h-8 w-[7.5rem] text-xs rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-gray-300 focus:outline-none transition-colors px-1.5"
      />
      <span className="text-gray-400 text-xs">–</span>
      <input
        type="date"
        value={end}
        min={start || undefined}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
        placeholder="End"
        title={`${label} — end date`}
        className="h-8 w-[7.5rem] text-xs rounded-lg border border-gray-200 bg-gray-50/50 focus:bg-white focus:border-gray-300 focus:outline-none transition-colors px-1.5"
      />
      {hasValue && (
        <button
          type="button"
          onClick={() => onChange({ start: "", end: "" })}
          className="text-gray-400 hover:text-red-500"
          title="Clear dates"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}