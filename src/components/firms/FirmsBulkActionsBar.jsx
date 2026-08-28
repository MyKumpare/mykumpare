import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, CheckCircle2, XCircle, X, Loader2, Building2, DollarSign } from "lucide-react";

const FUNDING_STATUSES = ["Funded", "Terminated"];

/**
 * Bulk action bar for the firm list. Appears when one or more firms are
 * selected. Lets the user set the funding status (Funded / Terminated) or
 * soft-delete the selected firms in one go.
 *
 * Props:
 *   selectedCount  - number of firms currently selected
 *   onClear        - clear the selection
 *   onSetStatus    - (status) => Promise  — bulk-set funding_status
 *   onDelete       - () => Promise        — bulk soft-delete selected firms
 *   busy           - string | null        - which action is in flight
 */
export default function FirmsBulkActionsBar({ selectedCount, onClear, onSetStatus, onDelete, busy }) {
  const [showStatus, setShowStatus] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 shadow-sm">
      <span className="text-sm font-medium text-indigo-800">
        {selectedCount} firm{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="h-4 w-px bg-indigo-200" />

      {/* Set funding status dropdown */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          onClick={() => setShowStatus((s) => !s)}
          disabled={!!busy}
        >
          {busy === "status" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
          Set Funding Status
        </Button>
        {showStatus && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowStatus(false)} />
            <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[170px]">
              {FUNDING_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setShowStatus(false);
                    onSetStatus(status);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 text-gray-700 flex items-center gap-2"
                >
                  {status === "Funded"
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                  {status}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-xs bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={onDelete}
        disabled={!!busy}
      >
        {busy === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Delete
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs ml-auto text-gray-500 hover:text-gray-700"
        onClick={onClear}
        disabled={!!busy}
      >
        <X className="w-3.5 h-3.5" />
        Clear
      </Button>
    </div>
  );
}