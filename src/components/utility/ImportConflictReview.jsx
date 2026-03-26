import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";

function fmt(val) {
  if (val === null || val === undefined || val === "") return "—";
  const n = Number(val);
  return `${n >= 0 ? "+" : ""}${n.toFixed(4)}%`;
}

// conflict: { date, existing_value, incoming_value }
// accepted: Set of date strings the user wants to accept
export default function ImportConflictReview({ conflicts, newRows, errors, onConfirm, onCancel }) {
  const [accepted, setAccepted] = useState(new Set(conflicts.map(c => c.date)));

  const toggle = (date) => {
    setAccepted(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  const toggleAll = (val) => {
    setAccepted(val ? new Set(conflicts.map(c => c.date)) : new Set());
  };

  const allOn = accepted.size === conflicts.length;
  const allOff = accepted.size === 0;

  return (
    <div className="space-y-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-orange-800">
            {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} detected
          </p>
          <p className="text-xs text-orange-600 mt-0.5">
            The following months already have data. Choose which incoming values to accept (overwrite) or reject (keep existing).
          </p>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex gap-2 text-xs">
        <button onClick={() => toggleAll(true)} disabled={allOn} className="text-indigo-600 hover:underline disabled:opacity-40">Accept all</button>
        <span className="text-gray-300">|</span>
        <button onClick={() => toggleAll(false)} disabled={allOff} className="text-gray-500 hover:underline disabled:opacity-40">Reject all</button>
      </div>

      {/* Conflict rows */}
      <div className="border rounded bg-white divide-y divide-gray-100 max-h-52 overflow-y-auto">
        <div className="grid grid-cols-4 gap-2 px-3 py-1.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>Month</span>
          <span className="text-right">In System</span>
          <span className="text-right">Incoming</span>
          <span className="text-right">Action</span>
        </div>
        {conflicts.map(c => {
          const isAccepted = accepted.has(c.date);
          const existingColor = c.existing_value >= 0 ? "text-green-700" : "text-red-600";
          const incomingColor = c.incoming_value >= 0 ? "text-green-700" : "text-red-600";
          return (
            <div key={c.date} className={`grid grid-cols-4 gap-2 px-3 py-2 text-xs items-center ${isAccepted ? "bg-orange-50" : ""}`}>
              <span className="font-mono text-gray-700">{format(parseISO(c.date), "MMM yyyy")}</span>
              <span className={`text-right font-mono ${existingColor}`}>{fmt(c.existing_value)}</span>
              <span className={`text-right font-mono font-medium ${incomingColor}`}>{fmt(c.incoming_value)}</span>
              <div className="flex justify-end">
                <button
                  onClick={() => toggle(c.date)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                    isAccepted
                      ? "bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200"
                      : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {isAccepted ? "Overwrite" : "Keep"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Non-conflicting new rows summary */}
      {newRows.length > 0 && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          {newRows.length} new month{newRows.length !== 1 ? "s" : ""} will be added without conflict.
        </p>
      )}

      {/* Parse errors */}
      {errors.length > 0 && (
        <ul className="text-xs text-yellow-700 list-disc ml-4 space-y-0.5">
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
          onClick={() => onConfirm(accepted)}
        >
          Apply Import
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}