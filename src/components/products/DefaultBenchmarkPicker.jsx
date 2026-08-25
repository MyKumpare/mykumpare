import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Plus, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { findNameDuplicates, SIMILARITY_THRESHOLD } from "@/components/shared/nameSimilarity";

/**
 * Default (primary) benchmark picker backed by the Benchmark master list.
 * Lets the user pick an existing benchmark or type a new one. When a typed
 * name near-matches an existing benchmark, a warning surfaces so the user
 * can merge (use the existing) instead of creating a duplicate. New
 * benchmarks are created with the product's asset class (or "Equity" fallback).
 *
 * value = { id, name }; onChange({ id, name }).
 */
export default function DefaultBenchmarkPicker({ value, onChange, isEditing, assetClass, placeholder = "Select default benchmark..." }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  const { data: benchmarks = [] } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: () => base44.entities.Benchmark.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.Benchmark.create({
      name,
      asset_class: assetClass || "Equity",
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["benchmarks"] }),
  });

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const valueName = value?.name || "";
  const options = benchmarks.filter((b) => !b.deleted_at);
  const filtered = options
    .filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.asset_class || "").localeCompare(b.asset_class || "") || a.name.localeCompare(b.name));
  const exactExists = options.some((b) => b.name.toLowerCase() === search.trim().toLowerCase());
  const canAdd = search.trim() && !exactExists;
  const nearMatches = canAdd ? findNameDuplicates(search.trim(), options, SIMILARITY_THRESHOLD) : [];

  const select = (bench) => { onChange({ id: bench.id, name: bench.name }); setSearch(""); setOpen(false); };
  const addAndSelect = async () => {
    const v = search.trim();
    try {
      const created = await createMutation.mutateAsync(v);
      onChange({ id: created.id, name: created.name });
    } catch (e) { /* may already exist */ }
    setSearch(""); setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {!isEditing ? (
        <div className="h-9 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
          {valueName || <span className="text-gray-400">—</span>}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => { setOpen((o) => !o); setSearch(""); }}
            className={cn(
              "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring",
              !valueName && "text-muted-foreground"
            )}
          >
            <span className="truncate">{valueName || placeholder}</span>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
              <div className="p-1.5 border-b">
                <input
                  autoFocus
                  className="w-full text-sm px-2 py-1 outline-none bg-transparent placeholder:text-muted-foreground"
                  placeholder="Search or type to add..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canAdd && nearMatches.length === 0) addAndSelect(); }}
                />
              </div>

              {nearMatches.length > 0 && (
                <div className="m-1.5 rounded-md bg-amber-50 border border-amber-200 p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5" /> Similar benchmark already exists
                  </div>
                  {nearMatches.map((m) => {
                    const bench = options.find((b) => b.id === m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 flex-1 truncate">{m.name}</span>
                        <button
                          type="button"
                          onClick={() => select(bench)}
                          className="text-xs px-2 py-0.5 rounded-md bg-amber-600 text-white hover:bg-amber-700"
                        >
                          Use existing
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto p-1">
                {filtered.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => select(b)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent",
                      value?.id === b.id && "font-medium"
                    )}
                  >
                    {value?.id === b.id ? <Check className="h-3.5 w-3.5 text-indigo-600" /> : <span className="w-3.5" />}
                    <span className="flex-1 text-left truncate">{b.name}</span>
                    <span className="text-xs text-gray-400">{b.asset_class}</span>
                  </button>
                ))}
                {canAdd && nearMatches.length === 0 && (
                  <button
                    type="button"
                    onClick={addAndSelect}
                    disabled={createMutation.isPending}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add "{search.trim()}"
                  </button>
                )}
                {filtered.length === 0 && !canAdd && (
                  <p className="px-2 py-2 text-xs text-muted-foreground">No benchmarks found.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}