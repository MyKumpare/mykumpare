import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check, AlertTriangle, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { findClientTypeDuplicates } from "./clientTypeSimilarity";

// Built-in client type presets. "Other" is always available so the
// force-match feature always has a bucket to put the balance into.
export const CLIENT_TYPE_PRESETS = [
  "Public Pension",
  "Corporate Pension",
  "Endowment & Foundation",
  "Insurance",
  "Sovereign Wealth Fund",
  "Family Office",
  "High Net Worth",
  "Sub-Advised",
  "Other",
];

/**
 * Single-select client type picker backed by the ClientType master list.
 * Users can add a new client type inline; similar/exact names trigger an
 * accept-or-reject duplicate prompt before the type is created.
 *
 * Props:
 *  - value: string (selected client type name, or "")
 *  - onChange: (name) => void
 *  - excludeNames: string[]  (names already used in this breakdown — hidden from the list)
 */
export default function ClientTypePicker({ value, onChange, excludeNames = [] }) {
  const [open, setOpen] = useState(false);
  const [optionRows, setOptionRows] = useState([]);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    base44.entities.ClientType.list("-created_date", 500)
      .then((rows) => { if (active) setOptionRows(rows); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Custom types = ClientType records whose name is not a preset.
  const customTypes = useMemo(
    () => optionRows.filter((r) => !CLIENT_TYPE_PRESETS.includes(r.name)).map((r) => r.name),
    [optionRows]
  );

  // Available = presets + custom types, minus those already used elsewhere.
  const availableTypes = useMemo(() => {
    const all = [...CLIENT_TYPE_PRESETS, ...customTypes];
    return all.filter((n) => !excludeNames.includes(n));
  }, [customTypes, excludeNames]);

  const startAddNew = () => {
    const name = newName.trim();
    if (!name) return;
    const allNames = [...CLIENT_TYPE_PRESETS, ...customTypes];
    const matches = findClientTypeDuplicates(name, allNames);
    if (matches.length > 0) {
      setDuplicateMatches({ name, matches });
      return;
    }
    confirmAddNew(name);
  };

  const confirmAddNew = async (name) => {
    setAdding(true);
    try {
      await base44.entities.ClientType.create({ name });
      setOptionRows((prev) => [...prev, { name }]);
      setNewName("");
      setDuplicateMatches(null);
      onChange(name);
    } catch {}
    setAdding(false);
  };

  const acceptDuplicate = () => {
    if (duplicateMatches) confirmAddNew(duplicateMatches.name);
  };

  const rejectDuplicate = () => {
    setDuplicateMatches(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="h-9 flex items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-sm cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        {value ? (
          <span className="font-medium text-gray-800">{value}</span>
        ) : (
          <span className="text-gray-400">Select client type...</span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {availableTypes.map((name) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(name); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs hover:bg-gray-50 text-gray-700"
            >
              {value === name && <Check className="w-3 h-3 text-indigo-500" />}
              <span className={value === name ? "font-medium text-indigo-700" : ""}>{name}</span>
            </button>
          ))}
          {availableTypes.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 italic">No types available</div>
          )}

          <div className="border-t border-gray-100 p-2">
            {!duplicateMatches ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); startAddNew(); } }}
                  placeholder="Add new client type..."
                  className="flex-1 h-8 text-xs px-2 rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); startAddNew(); }}
                  disabled={adding || !newName.trim()}
                  className="flex items-center gap-1 px-2 h-8 rounded-md text-xs bg-indigo-600 text-white disabled:opacity-50"
                >
                  {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <p className="font-medium">Possible duplicate</p>
                    <p>&ldquo;{duplicateMatches.name}&rdquo; may already exist:</p>
                  </div>
                </div>
                <div className="space-y-0.5">
                  {duplicateMatches.matches.map((m, i) => (
                    <div key={i} className="rounded border border-amber-200 bg-white px-2 py-1 text-xs">
                      <span className="font-medium text-gray-800">{m.name}</span>
                      <span className="text-gray-400 ml-2">{Math.round(m.score * 100)}% match</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); rejectDuplicate(); }} className="flex-1 h-7 rounded-md text-xs border border-gray-300 bg-white">Reject</button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); acceptDuplicate(); }} className="flex-1 h-7 rounded-md text-xs bg-indigo-600 text-white">Accept &amp; Add</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}