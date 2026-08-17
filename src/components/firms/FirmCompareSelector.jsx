import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";

/**
 * Searchable dropdown for picking a firm in the comparison view.
 * `excludeId` disables the firm already chosen for the other column.
 */
export default function FirmCompareSelector({ label, firms = [], value, onChange, excludeId }) {
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

  const selected = firms.find((f) => f.id === value);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return firms
      .filter((f) => !f.deleted_at && (!q || (f.name || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [firms, query]);

  return (
    <div className="flex-1 min-w-0">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="relative mt-1" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-2 h-11 px-3 rounded-xl border border-gray-200 bg-white hover:border-indigo-400 transition-colors"
        >
          {selected?.logo_url ? (
            <img src={selected.logo_url} alt="" className="w-7 h-7 rounded-md object-cover border border-gray-100 flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-semibold flex-shrink-0">
              {selected ? (selected.name || "?").slice(0, 1).toUpperCase() : "?"}
            </div>
          )}
          <span className="flex-1 text-left text-sm font-medium text-gray-800 truncate">
            {selected ? selected.name : "Select a firm…"}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-200 max-h-72 overflow-hidden flex flex-col">
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
                <p className="text-sm text-gray-400 italic text-center py-4">No firms</p>
              ) : (
                filtered.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={f.id === excludeId}
                    onClick={() => {
                      onChange(f.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50 ${
                      f.id === excludeId ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                  >
                    {f.logo_url ? (
                      <img src={f.logo_url} alt="" className="w-6 h-6 rounded object-cover border border-gray-100 flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-gray-100 flex-shrink-0" />
                    )}
                    <span className="truncate">{f.name}</span>
                    {f.id === excludeId && <span className="ml-auto text-[10px] text-gray-400">other</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}