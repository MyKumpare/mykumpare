import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History, FileText, User, ArrowRight } from "lucide-react";

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Read-only dialog showing the version history of a single RFP/RFI record.
 * Entries are displayed newest-first so the most recent update is on top.
 */
export default function RfpRfiVersionHistoryDialog({ open, onClose, record }) {
  const history = (record?.version_history || []).slice().reverse();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Version History
          </DialogTitle>
          {record?.title && (
            <p className="text-xs text-gray-500 -mt-1 truncate">
              {record.title}
            </p>
          )}
        </DialogHeader>

        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <History className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-400 italic">
              No version history yet. Updates to this RFP/RFI will be tracked here.
            </p>
          </div>
        ) : (
          <ol className="space-y-2.5">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-gray-200 bg-white p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold shrink-0">
                      v{entry.version_number}
                    </span>
                    <span className="text-xs font-semibold text-gray-700 truncate">
                      {entry.field_label || entry.field}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">
                    {fmtDateTime(entry.changed_date)}
                  </span>
                </div>

                <div className="flex items-start gap-1.5 text-xs pl-7">
                  <div className="min-w-0 flex-1">
                    {entry.field === "file_url" ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                        {entry.previous_value ? (
                          <a
                            href={entry.previous_value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 hover:underline truncate max-w-[180px]"
                          >
                            previous draft
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">no file</span>
                        )}
                        <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                        {entry.new_value ? (
                          <a
                            href={entry.new_value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate max-w-[180px]"
                          >
                            new draft
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">removed</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="text-gray-500 bg-gray-50 rounded px-1.5 py-0.5 border border-gray-100 break-words">
                          {entry.previous_value || <span className="italic text-gray-400">empty</span>}
                        </span>
                        <ArrowRight className="w-3 h-3 text-gray-400 shrink-0 mt-1" />
                        <span className="text-gray-800 bg-primary/5 rounded px-1.5 py-0.5 border border-primary/10 break-words">
                          {entry.new_value || <span className="italic text-gray-400">empty</span>}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {entry.changed_by_name && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 pl-7">
                    <User className="w-2.5 h-2.5" />
                    {entry.changed_by_name}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}