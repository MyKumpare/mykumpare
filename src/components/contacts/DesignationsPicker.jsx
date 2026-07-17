import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

const DEFAULT_DESIGNATIONS = [
  "CFA", "CFP", "CPA", "MBA", "PhD", "MD", "JD", "CAIA", "FRM", "PMP",
  "CIMA", "CIPM", "CMT", "ChFC", "CLU", "CPWA", "RIA",
  "Esq.", "Series 7", "Series 65", "Series 66"
];

export default function DesignationsPicker({ value = [], onChange, viewMode }) {
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // Deduplicate the incoming value case-insensitively, keeping the first
  // occurrence's casing (cleans up any legacy duplicates stored in the DB).
  const dedupedValue = (() => {
    const seen = new Set();
    const out = [];
    for (const d of value) {
      const key = String(d).toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(d); }
    }
    return out;
  })();

  // Merge defaults with any custom ones already saved (case-insensitive)
  const allOptions = (() => {
    const seen = new Set(DEFAULT_DESIGNATIONS.map((d) => d.toLowerCase()));
    const merged = [...DEFAULT_DESIGNATIONS];
    for (const d of dedupedValue) {
      const key = d.toLowerCase();
      if (!seen.has(key)) { seen.add(key); merged.push(d); }
    }
    return merged.sort();
  })();
  const selectedLower = new Set(dedupedValue.map((d) => d.toLowerCase()));
  const filtered = allOptions.filter(d =>
    d.toLowerCase().includes(search.toLowerCase()) && !selectedLower.has(d.toLowerCase())
  );

  const addDesignation = (d) => {
    if (!selectedLower.has(d.toLowerCase())) onChange([...dedupedValue, d]);
    setSearch("");
    setShowPicker(false);
  };

  const addCustom = () => {
    const trimmed = search.trim();
    if (!trimmed || selectedLower.has(trimmed.toLowerCase())) return;
    onChange([...dedupedValue, trimmed]);
    setSearch("");
    setShowPicker(false);
  };

  const remove = (d) => onChange(dedupedValue.filter(x => x !== d));

  if (viewMode) {
    return (
      <div className="flex flex-wrap gap-1.5 px-1">
        {dedupedValue.length === 0
          ? <span className="text-sm text-gray-400 italic">—</span>
          : dedupedValue.map(d => (
            <span key={d} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {d}
            </span>
          ))
        }
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dedupedValue.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {dedupedValue.map(d => (
            <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {d}
              <button type="button" onClick={() => remove(d)} className="hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {!showPicker ? (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 rounded-md px-3 py-1.5 hover:bg-indigo-50 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Designation
        </button>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Input
            autoFocus
            placeholder="Search or type new..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); filtered.length > 0 ? addDesignation(filtered[0]) : addCustom(); } if (e.key === "Escape") setShowPicker(false); }}
            className="h-8 border-0 border-b rounded-none text-sm"
          />
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 && !search.trim() ? (
              <div className="text-xs text-gray-400 italic text-center py-3">All designations selected</div>
            ) : (
              filtered.map(d => (
                <button key={d} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors" onClick={() => addDesignation(d)}>
                  {d}
                </button>
              ))
            )}
            {search.trim() && !allOptions.find(d => d.toLowerCase() === search.trim().toLowerCase()) && (
              <button type="button" className="w-full text-left px-3 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 border-t flex items-center gap-1" onClick={addCustom}>
                <Plus className="w-3.5 h-3.5" /> Add "{search.trim()}"
              </button>
            )}
          </div>
          <div className="border-t px-2 py-1.5">
            <button type="button" onClick={() => { setShowPicker(false); setSearch(""); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}