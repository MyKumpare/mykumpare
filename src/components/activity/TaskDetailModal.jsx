import React from "react";
import { X, LayoutList, Calendar, User, Building2, Clock, AlertCircle, CheckCircle2, XCircle, Paperclip, Link2, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const STATUS_STYLES = {
  "Not Started": { color: "text-gray-500",  bg: "bg-gray-100",  icon: Clock },
  "In-process":  { color: "text-blue-600",  bg: "bg-blue-50",   icon: AlertCircle },
  "Completed":   { color: "text-green-600", bg: "bg-green-50",  icon: CheckCircle2 },
  "Cancelled":   { color: "text-red-500",   bg: "bg-red-50",    icon: XCircle },
};

function fmt(dateStr) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr + "T00:00:00"), "MMMM d, yyyy"); } catch { return dateStr; }
}

export default function TaskDetailModal({ open, task, onClose, onOpenContact }) {
  if (!open || !task) return null;

  const s = STATUS_STYLES[task.status] || STATUS_STYLES["Not Started"];
  const StatusIcon = s.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-orange-600" />
            Follow-up Task Detail
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Status + Due date */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${s.bg} ${s.color}`}>
              <StatusIcon className="w-3 h-3" /> {task.status}
            </span>
            <span className="text-sm text-gray-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Due {fmt(task.due_date)}
            </span>
            {task.completion_date && (
              <span className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Completed {fmt(task.completion_date)}
              </span>
            )}
          </div>

          {/* Task Description */}
          {task.task_description && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Task Description</p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="text-sm text-gray-700 leading-relaxed quill-preview"
                  dangerouslySetInnerHTML={{ __html: task.task_description }} />
              </div>
            </div>
          )}

          {/* Creator */}
          {task.originator_contact_name && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Created By</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700 flex-shrink-0">
                  {(task.originator_contact_name || "?")[0]}
                </div>
                <p className="text-sm font-semibold text-gray-800">{task.originator_contact_name}</p>
              </div>
            </div>
          )}

          {/* Assigned To */}
          {task.assigned_to_contact_name && (
            <div className="rounded-xl border border-indigo-50 bg-indigo-50/50 p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assigned To</p>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                  {(task.assigned_to_contact_name || "?")[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{task.assigned_to_contact_name}</p>
                  {task.assigned_to_firm_name && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {task.assigned_to_firm_name}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {task.notes && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="text-sm text-gray-700 leading-relaxed quill-preview"
                  dangerouslySetInnerHTML={{ __html: task.notes }} />
              </div>
            </div>
          )}

          {/* Linked Activity */}
          {task.activity_label && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Linked Activity</p>
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl">
                <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{task.activity_label}</span>
              </div>
            </div>
          )}

          {/* Attachments */}
          {task.attachments?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> Attachments
              </p>
              <div className="space-y-1">
                {task.attachments.map(att => (
                  <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors">
                    <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          <button type="button" onClick={onClose}
            className="w-full h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}