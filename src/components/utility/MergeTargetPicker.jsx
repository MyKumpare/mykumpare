import React, { useState, useMemo } from "react";
import { Search, ArrowLeft } from "lucide-react";

// Lets the user explicitly choose which existing firm a CSV row should merge
// into. Detected duplicate matches are shown first as suggestions; a search
// box lists every other existing firm so the user can override the auto-detected
// target (e.g. merge "Acuitas Investments, LLC" into a differently-named firm).
//
// After picking a target, if the target's name differs from the imported firm's
// name, the user chooses which name to keep on the merged record. onPick is
// called with (firmId, chosenName) where chosenName is the imported name when
// the user chose it, or null to keep the existing name unchanged.
export default function MergeTargetPicker({ duplicates = [], allFirms = [], importedName = "", onPick }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // { id, name }
  const [nameChoice, setNameChoice] = useState("existing"); // "existing" | "imported"

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

  const namesDiffer = !!(selected && importedName && selected.name && selected.name !== importedName);

  const pickTarget = (id, name) => {
    setSelected({ id, name });
    setNameChoice("existing");
  };

  const confirm = () => {
    const chosenName = namesDiffer && nameChoice === "imported" ? importedName : null;
    onPick(selected.id, chosenName);
  };

  if (selected) {
    return (
      <div className="mt-2 pt-2 border-t border-teal-100 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-500">Merge into <strong className="text-gray-800">{selected.name}</strong></p>
          <button onClick={() => setSelected(null)} className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Change
          </button>
        </div>
        {namesDiffer ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-gray-500">Which name should be saved on the merged record?</p>
            <label className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border cursor-pointer ${nameChoice === "existing" ? "border-teal-300 bg-teal-50/50" : "border-gray-200"}`}>
              <input type="radio" checked={nameChoice === "existing"} onChange={() => setNameChoice("existing")} />
              <span className="text-gray-700">Keep existing: <strong>{selected.name}</strong></span>
            </label>
            <label className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border cursor-pointer ${nameChoice === "imported" ? "border-teal-300 bg-teal-50/50" : "border-gray-200"}`}>
              <input type="radio" checked={nameChoice === "imported"} onChange={() => setNameChoice("imported")} />
              <span className="text-gray-700">Use imported: <strong>{importedName}</strong></span>
            </label>
            <button onClick={confirm} className="w-full px-2 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700">Confirm merge</button>
          </div>
        ) : (
          <button onClick={confirm} className="w-full px-2 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700">Confirm merge</button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-teal-100 space-y-2">
      <p className="text-[11px] text-gray-500">Choose a firm to merge into:</p>

      {duplicates.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Suggested</p>
          {duplicates.map((d, di) => (
            <button
              key={di}
              onClick={() => pickTarget(d.firm.id, d.name)}
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
              onClick={() => pickTarget(f.id, f.name)}
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