import React, { useState, useMemo } from "react";
import { User, X, ChevronDown, Search } from "lucide-react";

function formatName(c) {
  if (!c) return "";
  return [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" ");
}

/**
 * Picker for the "Reports To" reporting relationship field on the contact form.
 * Shows a searchable dropdown of active contacts at the same firm(s), excluding
 * the current contact being edited. Allows clearing the selection.
 *
 * Props:
 *   value       — reports_to_contact_id (string or "")
 *   onChange    — (id) => void
 *   firmIds     — array of firm IDs the current contact belongs to
 *   contacts    — full contact list (to filter from)
 *   excludeId   — current contact's id (to prevent self-reference)
 *   viewMode    — when true, renders a read-only display
 */
export default function ReportsToPicker({ value, onChange, firmIds = [], contacts = [], excludeId, viewMode = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const firmSet = new Set(firmIds);
    return contacts
      .filter((c) => !c.deleted_at && c.id !== excludeId)
      .filter((c) => (c.firm_ids || []).some((fid) => firmSet.has(fid)))
      .filter((c) => (c.contact_status || "Active") === "Active")
      .sort((a, b) => formatName(a).localeCompare(formatName(b)));
  }, [contacts, firmIds, excludeId]);

  const selected = candidates.find((c) => c.id === value) || contacts.find((c) => c.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const q = search.toLowerCase();
    return candidates.filter((c) => {
      const name = formatName(c).toLowerCase();
      const title = (c.title || "").toLowerCase();
      return name.includes(q) || title.includes(q);
    });
  }, [candidates, search]);

  if (viewMode) {
    return (
      <div className="text-sm text-gray-900 px-1">
        {selected ? (
          <span className="inline-flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-400" />
            {formatName(selected)}
            {selected.title && <span className="text-gray-400 text-xs">· {selected.title}</span>}
          </span>
        ) : (
          <span className="text-gray-400 italic">—</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 flex items-center justify-between rounded-md border border-input bg-background text-sm text-gray-900 hover:border-gray-300 transition-colors"
      >
        {selected ? (
          <span className="flex items-center gap-1.5 min-w-0">
            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{formatName(selected)}</span>
            {selected.title && <span className="text-gray-400 text-xs truncate">· {selected.title}</span>}
          </span>
        ) : (
          <span className="text-gray-400">Select manager…</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onChange(""); setOpen(false); } }}
              className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
              title="Clear"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
            <div className="relative p-2 border-b border-gray-100">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
                placeholder="Search by name or title…"
                className="w-full pl-8 pr-7 h-7 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">
                  {candidates.length === 0
                    ? "No active contacts at this firm"
                    : "No matches found"}
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onChange(c.id); setOpen(false); setSearch(""); }}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-indigo-50 transition-colors text-xs ${
                      c.id === value ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {c.photo_url
                        ? <img src={c.photo_url} alt="" className="w-full h-full object-cover" />
                        : <User className="w-3 h-3 text-indigo-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-800 truncate">{formatName(c)}</div>
                      {c.title && <div className="text-gray-400 truncate">{c.title}</div>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}