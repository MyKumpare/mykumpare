import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Plus } from "lucide-react";

const MAX_FIRMS = 6;

/**
 * Multi-select firm picker for the comparison view.
 * Shows selected firms as removable chips and a searchable dropdown to add more.
 */
export default function FirmMultiSelector({ firms = [], selectedIds = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return firms
      .filter(
        (f) =>
          !f.deleted_at &&
          !selectedIds.includes(f.id) &&
          (!q || (f.name || "").toLowerCase().includes(q))
      )
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [firms, query, selectedIds]);

  const selectedFirms = selectedIds
    .map((id) => firms.find((f) => f.id === id))
    .filter(Boolean);

  const addFirm = (id) => {
    if (selectedIds.length >= MAX_FIRMS) return;
    onChange([...selectedIds, id]);
    setQuery("");
  };

  const removeFirm = (id) => {
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Selected Firms ({selectedIds.length}/{MAX_FIRMS})
        </span>
      </div>

      {selectedFirms.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedFirms.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200"
            >
              {f.logo_url ? (
                <img
                  src={f.logo_url}
                  alt=""
                  className="w-5 h-5 rounded object-cover"
                />
              ) : (
                <div className="w-5 h-5 rounded bg-indigo-200 flex items-center justify-center text-[10px] font-semibold text-indigo-700">
                  {(f.name || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-indigo-800 truncate max-w-[160px]">
                {f.name}
              </span>
              <button
                onClick={() => removeFirm(f.id)}
                className="text-indigo-400 hover:text-indigo-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedIds.length < MAX_FIRMS && (
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 h-10 px-3 rounded-xl border border-gray-200 bg-white hover:border-indigo-400 transition-colors text-sm text-gray-500"
          >
            <Plus className="w-4 h-4 text-indigo-500" />
            Add a firm to compare…
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {open && (
            <div className="absolute z-30 mt-1 w-full max-w-md bg-white rounded-xl shadow-xl border border-gray-200 max-h-72 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-gray-100 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search firms…"
                  className="w-full h-8 pl-8 pr-3 text-sm rounded-lg border border-gray-200 outline-none focus:border-indigo-400 bg-gray-50"
                />
              </div>
              <div className="overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 italic text-center py-4">
                    No firms found
                  </p>
                ) : (
                  filtered.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addFirm(f.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50"
                    >
                      {f.logo_url ? (
                        <img
                          src={f.logo_url}
                          alt=""
                          className="w-6 h-6 rounded object-cover border border-gray-100 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-gray-100 flex-shrink-0" />
                      )}
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}