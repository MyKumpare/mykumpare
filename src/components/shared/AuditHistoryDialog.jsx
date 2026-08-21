import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { History } from "lucide-react";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function renderValue(v) {
  if (v == null) return <span className="text-gray-400 italic">empty</span>;
  if (typeof v === "string") {
    if (!v) return <span className="text-gray-400 italic">empty</span>;
    return <span className="break-words">{v}</span>;
  }
  return <span className="break-words">{String(v)}</span>;
}

export default function AuditHistoryDialog({
  open,
  onOpenChange,
  record,
  entityLabel = "Record",
}) {
  const history = Array.isArray(record?.audit_history) ? record.audit_history : [];
  // Newest first
  const sorted = [...history].sort(
    (a, b) => new Date(b.changed_date || 0) - new Date(a.changed_date || 0)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-indigo-500" />
            {entityLabel} History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          {sorted.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">
              No changes have been recorded yet.
            </div>
          ) : (
            <ol className="relative border-l border-gray-200 ml-2 space-y-4 py-2">
              {sorted.map((entry) => (
                <li key={entry.id} className="ml-4">
                  <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {entry.changed_by_name || "Unknown user"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDate(entry.changed_date)}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-gray-800">
                      {entry.field}
                    </span>
                    <span className="text-gray-400"> changed</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-1 gap-1.5 text-xs">
                    <div className="rounded-md bg-red-50 border border-red-100 px-2.5 py-1.5">
                      <span className="font-semibold text-red-600">From: </span>
                      {renderValue(entry.previous_value)}
                    </div>
                    <div className="rounded-md bg-emerald-50 border border-emerald-100 px-2.5 py-1.5">
                      <span className="font-semibold text-emerald-600">To: </span>
                      {renderValue(entry.new_value)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}