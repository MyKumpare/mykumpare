import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";

// Lets the user explicitly choose which existing firm a CSV row should merge
// into. Detected duplicate matches are shown first as suggestions; a search
// box lists every other existing firm so the user can override the auto-detected
// target (e.g. merge "Acuitas Investments, LLC" into a differently-named firm).
export default function MergeTargetPicker({ duplicates = [], allFirms = [], onPick }) {
  const [query, setQuery] = useState("");
  const suggestedIds = useMemo(
    () => new Set(duplicates.map((d) => d.firm?.id).filter(Boolean)),
    [duplicates]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = (allFirms || []).filter((f) => !suggestedIds.has(f.id));
    if (!q) return base.slice(0, 50);
    return base.filter((f) => (f.name || "").toLowerCase().includes(q)).slice(0, 50);
  }, [query, allFirms, suggestedIds]);

  return (
    <div className="mt-2 pt-2 border-t border-teal-100 space-y-2">
      <p className="text-[11px] text-gray-500">Choose a firm to merge into:</p>

      {duplicates.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Suggested</p>
          {duplicates.map((d, di) => (
            <button
              key={di}
              onClick={() => onPick(d.firm.id)}
              className="w-full text-left px-2 py-1.5 text-xs rounded-md border border-teal-200 bg-teal-50/50 hover:bg-teal-50"
            >
              <strong className="text-gray-800">{d.name}</strong>
              <span className="text-gray-400"> — {d.reasons.join(", ")}</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all firms to merge into…"
          className="w-full pl-7 pr-2 py-1.5 text-xs rounded-md border border-gray-200 focus:border-teal-300 focus:outline-none"
        />
      </div>

      <div className="max-h-40 overflow-y-auto rounded-md border border-gray-100 divide-y divide-gray-50">
        {filtered.length === 0 ? (
          <p className="px-2 py-2 text-[11px] text-gray-400">No firms found.</p>
        ) : (
          filtered.map((f) => (
            <button
              key={f.id}
              onClick={() => onPick(f.id)}
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-teal-50"
            >
              <span className="text-gray-800 font-medium">{f.name}</span>
              <span className="text-gray-400"> · {(f.firm_types || []).join(", ")}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}