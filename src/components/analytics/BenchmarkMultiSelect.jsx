import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

const ym = (d) => (d ? d.slice(0, 7) : "");
const formatMDY = (ymStr) => {
  if (!ymStr) return "";
  const [year, month] = ymStr.split("-");
  return `${month}/01/${year}`;
};

/**
 * Multi-select benchmark dropdown.
 * Props:
 *   benchmarks        – full list of Benchmark records
 *   selectedIds       – string[]
 *   onChange          – (newIds: string[]) => void
 *   productBenchmarks – product.inv_desc_benchmarks (array of { id, role })
 *                       used to display Primary / Secondary role badges
 */
export default function BenchmarkMultiSelect({ benchmarks, selectedIds = [], onChange, productBenchmarks = [] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Build a role-map from product setup
  const roleMap = {};
  (productBenchmarks ?? []).forEach((pb) => {
    if (pb && typeof pb === "object" && pb.id) roleMap[pb.id] = pb.role ?? null;
  });

  const filtered = benchmarks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  const remove = (id, e) => {
    e.stopPropagation();
    onChange(selectedIds.filter((x) => x !== id));
  };

  const roleBadge = (id) => {
    const role = roleMap[id];
    if (!role) return null;
    const isPrimary = role === "Primary";
    return (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${isPrimary ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
        {role}
      </span>
    );
  };

  // Get period for a benchmark
  const getBenchmarkPeriod = (bm) => {
    const mr = (bm?.monthly_returns ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (mr.length === 0) return null;
    return { start: ym(mr[0].date), end: ym(mr[mr.length - 1].date) };
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <div
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className="min-h-[32px] w-full flex flex-wrap items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white hover:border-indigo-400 cursor-pointer transition-colors"
      >
        {selectedIds.length === 0 ? (
          <span className="text-gray-400">None</span>
        ) : (
          selectedIds.map((id) => {
            const bm = benchmarks.find((b) => b.id === id);
            return (
              <span key={id} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md px-1.5 py-0.5">
                <span className="truncate max-w-[120px]">{bm?.name ?? id}</span>
                {roleBadge(id)}
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => remove(id, e)}
                  className="text-indigo-400 hover:text-indigo-700 ml-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })
        )}
        <ChevronDown className={`w-3 h-3 text-gray-400 ml-auto flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[9999] top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden min-w-[220px]">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search benchmarks…"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">No benchmarks found</p>
            ) : (
              filtered.map((b) => {
                const checked = selectedIds.includes(b.id);
                const role = roleMap[b.id];
                const period = getBenchmarkPeriod(b);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(b.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${checked ? "bg-indigo-50" : ""}`}
                  >
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${checked ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                      {checked && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className={`truncate ${checked ? "text-indigo-700 font-medium" : "text-gray-700"}`}>{b.name}</span>
                      {period && (
                        <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatMDY(period.start)} – {formatMDY(period.end)}
                        </span>
                      )}
                    </div>
                    {role && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${role === "Primary" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {role}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}