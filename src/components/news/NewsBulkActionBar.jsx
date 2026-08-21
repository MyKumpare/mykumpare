import React from "react";
import { X, CheckSquare, UserPlus, Building2, Download, MessageCircle } from "lucide-react";
import NewsBulkTagPopover from "./NewsBulkTagPopover";

// ── Bulk action bar for the news tabs. Shown when multi-select mode is on.
//    Lets the user tag contacts/firms onto every selected article at once. ──
export default function NewsBulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  contacts,
  firms,
  onBulkTagContacts,
  onBulkTagFirms,
  onExportPdf,
  onChat,
}) {
  const contactItems = contacts.map(c => ({
    id: c.id,
    label: [c.first_name, c.last_name].filter(Boolean).join(" ") + (c.title ? ` — ${c.title}` : ""),
  }));
  const firmItems = firms.map(f => ({ id: f.id, label: f.name }));

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl border border-indigo-200 bg-indigo-50/80 backdrop-blur px-3 py-2 shadow-sm">
      <span className="text-xs font-semibold text-indigo-700">
        {selectedCount} of {totalCount} selected
      </span>
      <button type="button" onClick={onSelectAll} className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 disabled:opacity-40" disabled={totalCount === 0}>
        <CheckSquare className="w-3.5 h-3.5" /> Select all
      </button>
      <button type="button" onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 disabled:opacity-40" disabled={selectedCount === 0}>
        <X className="w-3.5 h-3.5" /> Clear
      </button>
      <div className="h-4 w-px bg-indigo-200" />
      <NewsBulkTagPopover items={contactItems} triggerLabel="Tag contacts" triggerIcon={UserPlus} accent="indigo" onApply={onBulkTagContacts} />
      <NewsBulkTagPopover items={firmItems} triggerLabel="Tag firms" triggerIcon={Building2} accent="purple" onApply={onBulkTagFirms} />
      <div className="h-4 w-px bg-indigo-200" />
      <button type="button" onClick={onExportPdf} disabled={selectedCount === 0}
        className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
        <Download className="w-3.5 h-3.5" /> Export PDF
      </button>
      {onChat && (
        <button type="button" onClick={onChat} disabled={selectedCount === 0}
          className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
          <MessageCircle className="w-3.5 h-3.5" /> Chat
        </button>
      )}
    </div>
  );
}