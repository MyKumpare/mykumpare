import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { X, Plus, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import AddBenchmarkDialog from "../utility/AddBenchmarkDialog";

// value = [{ id, role }]  where role is "Primary" | "Secondary" | ""
// Legacy support: if value contains plain strings, treat them as { id: str, role: "" }

function normalize(value) {
  if (!Array.isArray(value)) return [];
  return value.map(v => typeof v === "string" ? { id: v, role: "" } : v);
}

const ROLES = ["Primary", "Secondary"];

export default function BenchmarkMultiSelect({ value = [], onChange, isEditing }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addBenchmarkOpen, setAddBenchmarkOpen] = useState(false);
  const [viewingBenchmark, setViewingBenchmark] = useState(null);

  const { data: allBenchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.filter({ deleted_at: { $exists: false } }, "-created_date"),
  });

  const entries = normalize(value);
  const selectedIds = entries.map(e => e.id);

  const selectedBenchmarks = entries
    .map(e => ({ ...e, benchmark: allBenchmarks.find(b => b.id === e.id) }))
    .filter(e => e.benchmark);

  const unselected = allBenchmarks
    .filter(b => !selectedIds.includes(b.id))
    .sort((a, b) => (a.asset_class || "").localeCompare(b.asset_class || "") || a.name.localeCompare(b.name));

  const handleAdd = (id) => {
    if (!selectedIds.includes(id)) {
      onChange([...entries, { id, role: "" }]);
    }
    setDropdownOpen(false);
  };

  const handleRemove = (id) => {
    onChange(entries.filter(e => e.id !== id));
  };

  const handleRoleChange = (id, role) => {
    onChange(entries.map(e => e.id === id ? { ...e, role } : e));
  };

  const roleColor = (role) => {
    if (role === "Primary") return "bg-indigo-600 text-white border-indigo-600";
    if (role === "Secondary") return "bg-indigo-100 text-indigo-700 border-indigo-300";
    return "bg-gray-100 text-gray-500 border-gray-200";
  };

  const roleBadge = (role) => {
    if (role === "Primary") return "bg-indigo-600 text-white";
    if (role === "Secondary") return "bg-indigo-100 text-indigo-700";
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-indigo-500 flex-shrink-0" />
        <Label className="text-sm font-semibold text-gray-800">Benchmarks</Label>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {/* Selected benchmarks with role selector */}
          {selectedBenchmarks.map(({ id, role, benchmark }) => (
            <div key={id} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => setViewingBenchmark(benchmark)}
                className="flex-1 text-left text-sm font-medium text-indigo-700 hover:underline truncate"
              >
                {benchmark.name}
              </button>
              {/* Role toggle buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleChange(id, role === r ? "" : r)}
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                      role === r ? roleColor(r) : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(id)}
                className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Dropdown trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(v => !v)}
              className="flex items-center gap-2 h-9 px-3 w-full rounded-md border border-input bg-white text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              <span className="flex-1 text-left">Add benchmark...</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                {unselected.length > 0 ? (
                  unselected.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleAdd(b.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-gray-800">{b.name}</span>
                      <span className="text-xs text-gray-400">{b.asset_class}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-gray-400 italic">All benchmarks selected</div>
                )}
                <div className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(false); setAddBenchmarkOpen(true); }}
                    className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add new benchmark...
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 rounded-md border bg-gray-50 min-h-9">
          {selectedBenchmarks.length === 0 ? (
            <span className="text-sm text-gray-400 italic">—</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedBenchmarks.map(({ id, role, benchmark }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewingBenchmark(benchmark)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 font-medium hover:bg-indigo-100 transition-colors"
                >
                  {benchmark.name}
                  {role && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${roleBadge(role)}`}>
                      {role}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Close dropdown on outside click */}
      {dropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
      )}

      <AddBenchmarkDialog
        open={addBenchmarkOpen}
        onOpenChange={setAddBenchmarkOpen}
        benchmarks={allBenchmarks}
        editingBenchmark={null}
      />

      <AddBenchmarkDialog
        open={!!viewingBenchmark}
        onOpenChange={(o) => { if (!o) setViewingBenchmark(null); }}
        benchmarks={allBenchmarks}
        editingBenchmark={viewingBenchmark}
      />
    </div>
  );
}