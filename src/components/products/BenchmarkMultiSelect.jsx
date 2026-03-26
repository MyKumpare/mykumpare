import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Plus, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import AddBenchmarkDialog from "../utility/AddBenchmarkDialog";

export default function BenchmarkMultiSelect({ value = [], onChange, isEditing }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [addBenchmarkOpen, setAddBenchmarkOpen] = useState(false);

  const { data: allBenchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date"),
  });

  const selectedIds = Array.isArray(value) ? value : [];
  const selectedBenchmarks = selectedIds
    .map(id => allBenchmarks.find(b => b.id === id))
    .filter(Boolean);
  const unselected = allBenchmarks
    .filter(b => !selectedIds.includes(b.id))
    .sort((a, b) => (a.asset_class || "").localeCompare(b.asset_class || "") || a.name.localeCompare(b.name));

  const handleAdd = (id) => {
    if (!selectedIds.includes(id)) {
      onChange([...selectedIds, id]);
    }
    setDropdownOpen(false);
  };

  const handleRemove = (id) => {
    onChange(selectedIds.filter(i => i !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-indigo-500 flex-shrink-0" />
        <Label className="text-sm font-semibold text-gray-800">Benchmarks</Label>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          {/* Selected badges */}
          {selectedBenchmarks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedBenchmarks.map(b => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 font-medium"
                >
                  {b.name}
                  <button
                    type="button"
                    onClick={() => handleRemove(b.id)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

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
              {selectedBenchmarks.map(b => (
                <span
                  key={b.id}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-xs text-indigo-700 font-medium"
                >
                  {b.name}
                </span>
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
    </div>
  );
}