import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Plus, AlertTriangle } from "lucide-react";
import { nameSimilarity } from "./contactTypeSimilarity";

/**
 * Reusable single-value combobox backed by a globally-persisted master list.
 * - Shows all options sorted alphabetically.
 * - Allows searching and adding a new value.
 * - On add, runs fuzzy duplicate detection; if a match exists, prompts the
 *   user to accept (use existing) or reject (add the new one anyway).
 * - New values are persisted via the `onPersist` callback (owner manages the
 *   master entity so options are loaded once and shared across pickers).
 */
export default function MasterOptionPicker({
  value,
  onChange,
  options = [],
  onPersist,
  viewMode = false,
  placeholder = "Select or add...",
  dedupThreshold = 0.8,
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [pendingCustom, setPendingCustom] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setPendingCustom(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions = useMemo(() => [...options].sort((a, b) => a.localeCompare(b)), [options]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOptions;
    const q = search.toLowerCase();
    return allOptions.filter((o) => o.toLowerCase().includes(q));
  }, [allOptions, search]);

  const trimmed = search.trim();
  const canCreate = trimmed && !allOptions.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const findMatches = (val) =>
    allOptions
      .map((o) => ({ name: o, score: nameSimilarity(val, o) }))
      .filter((m) => m.score >= dedupThreshold)
      .sort((a, b) => b.score - a.score);

  const persistNew = (val) => {
    if (allOptions.some((o) => o.toLowerCase() === val.toLowerCase())) return;
    onPersist?.(val);
  };

  const attemptCreate = () => {
    const val = trimmed;
    if (!val || !canCreate) return;
    const matches = findMatches(val);
    if (matches.length > 0) {
      setPendingCustom({ val, matches });
      return;
    }
    confirmCreate(val);
  };

  const confirmCreate = (val) => {
    onChange(val);
    persistNew(val);
    setSearch("");
    setPendingCustom(null);
    setOpen(false);
  };

  if (viewMode) {
    return <div className="text-sm text-gray-900 px-1">{value || <span className="text-gray-400 italic">—</span>}</div>;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-9 flex items-center justify-between px-3 rounded-md border border-input bg-transparent text-sm shadow-sm hover:bg-accent transition-colors"
      >
        <span className={value ? "text-foreground truncate" : "text-muted-foreground"}>{value || placeholder}</span>
        {open ? <ChevronUp className="w-4 h-4 opacity-50 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-white shadow-md">
          <input
            autoFocus
            className="w-full px-3 py-2 text-sm border-b outline-none"
            placeholder="Search or type to add..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (pendingCustom) confirmCreate(pendingCustom.val);
                else attemptCreate();
              }
              if (e.key === "Escape") setPendingCustom(null);
            }}
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.map((o) => (
              <button
                key={o}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 ${value === o ? "bg-indigo-50 text-indigo-700 font-medium" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); onChange(o); setSearch(""); setOpen(false); }}
              >
                {o}
              </button>
            ))}
            {filtered.length === 0 && !canCreate && !pendingCustom && (
              <div className="px-3 py-2 text-xs text-gray-400 italic">No options found</div>
            )}
          </div>
          {pendingCustom ? (
            <div className="border-t border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
              <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Similar {pendingCustom.matches.length > 1 ? "entries" : "entry"} already exist{pendingCustom.matches.length === 1 ? "s" : ""}:
              </p>
              <div className="flex flex-wrap gap-1">
                {pendingCustom.matches.map((m) => (
                  <span key={m.name} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">{m.name}</span>
                ))}
              </div>
              <p className="text-xs text-amber-700">Add "{pendingCustom.val}" anyway?</p>
              <div className="flex gap-2 pt-0.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); confirmCreate(pendingCustom.val); }} className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700">Add anyway</button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setPendingCustom(null); }} className="px-2.5 py-1 rounded-md text-xs font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          ) : (
            canCreate && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); attemptCreate(); }}
                className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 border-t border-gray-100 font-medium"
              >
                <Plus className="w-3 h-3" /> Add "{trimmed}"
              </button>
            )
          )}
          {value && (
            <div className="border-t px-3 py-1.5">
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600"
                onMouseDown={(e) => { e.preventDefault(); onChange(""); setOpen(false); setSearch(""); }}
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}