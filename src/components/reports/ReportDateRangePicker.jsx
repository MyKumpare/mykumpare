import React from "react";
import { CalendarClock, CalendarRange, X } from "lucide-react";

// Reusable date range picker with a visual indicator of the available data range.
// `value` is { start, end } in YYYY-MM-DD; `availableRange` is { oldest, newest } | null.
export default function ReportDateRangePicker({ value, onChange, availableRange, label = "Date range" }) {
  const { start = "", end = "" } = value || {};
  const oldest = availableRange?.oldest || null;
  const newest = availableRange?.newest || null;
  const hasRange = !!(oldest && newest);
  const span = hasRange ? new Date(newest + "T00:00:00").getTime() - new Date(oldest + "T00:00:00").getTime() : 0;
  const toTs = (d) => (d ? new Date(d + "T00:00:00").getTime() : null);
  const leftPct = hasRange && start && span > 0 ? Math.max(0, Math.min(100, ((toTs(start) - toTs(oldest)) / span) * 100)) : 0;
  const rightPct = hasRange && end && span > 0 ? Math.max(0, Math.min(100, ((toTs(newest) - toTs(end)) / span) * 100)) : 0;
  const widthPct = Math.max(0, 100 - leftPct - rightPct);
  const hasValue = !!(start || end);
  const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-US") : "—");

  return (
    <div className="space-y-2.5">
      {label && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <CalendarRange className="w-3.5 h-3.5" />
          {label}
        </div>
      )}
      {hasRange && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-gray-500">Oldest:</span>
              <span className="font-semibold text-gray-800">{fmt(oldest)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Newest:</span>
              <span className="font-semibold text-gray-800">{fmt(newest)}</span>
              <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
            </div>
          </div>
          <div className="relative h-2 rounded-full bg-indigo-100 overflow-hidden">
            <div className="absolute h-2 rounded-full bg-indigo-500" style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Start date</label>
          <input type="date" value={start} max={end || undefined}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
            className="h-9 w-full text-sm rounded-md border border-gray-200 bg-white px-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">End date</label>
          <input type="date" value={end} min={start || undefined}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
            className="h-9 w-full text-sm rounded-md border border-gray-200 bg-white px-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button"
          onClick={() => onChange({ ...(value || {}), start: oldest || "", end: newest || "" })}
          disabled={!hasRange}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">
          <CalendarRange className="w-3 h-3" /> Auto-select full range
        </button>
        <button type="button"
          onClick={() => oldest && onChange({ ...(value || {}), start: oldest })}
          disabled={!oldest}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">
          Set start to earliest
        </button>
        <button type="button"
          onClick={() => newest && onChange({ ...(value || {}), end: newest })}
          disabled={!newest}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed">
          Set end to latest
        </button>
        {hasValue && (
          <button type="button" onClick={() => onChange({ start: "", end: "" })}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-gray-400 hover:text-red-500 text-xs font-medium">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}