import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Plus, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

// Built-in presets always offered even before the DB library is seeded, so the
// picker is never empty on a fresh install.
const PRESET_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
  "Other",
];

/**
 * Single-select dropdown for firm type, backed by the shared FirmType master
 * list. Users pick an existing type, search to narrow, or type to add a new
 * type — which is validated against existing types (case-insensitive) and
 * persisted to the library for everyone.
 */
export default function FirmTypePicker({ value, onChange, disabled = false, placeholder = "Select firm type..." }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  const { data: dbTypes = [] } = useQuery({
    queryKey: ["firm-types"],
    queryFn: () => base44.entities.FirmType.list("name", 500),
  });

  const allTypes = useMemo(() => {
    const map = new Map();
    [...PRESET_TYPES, ...dbTypes.map((t) => t.name)].forEach((n) => {
      const key = n.toLowerCase().trim();
      if (!map.has(key)) map.set(key, n);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [dbTypes]);

  const createType = useMutation({
    mutationFn: (name) => base44.entities.FirmType.create({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm-types"] }),
  });

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const trimmed = search.trim();
  const canCreate = trimmed && !allTypes.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const filtered = trimmed
    ? allTypes.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
    : allTypes;

  const select = (type) => { onChange(type); setSearch(""); setOpen(false); };
  const addAndSelect = () => {
    const v = trimmed;
    createType.mutate(v, {
      onSuccess: () => select(v),
      onError: (err) => {
        toast({ title: "Could not add firm type", description: err?.message || "Please try again.", variant: "destructive" });
      },
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">{value || placeholder}</span>
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
              onKeyDown={(e) => { if (e.key === "Enter" && canCreate) addAndSelect(); }}
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => select(type)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left",
                  value === type && "font-medium"
                )}
              >
                {value === type ? (
                  <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                ) : (
                  <span className="w-3.5 flex-shrink-0" />
                )}
                <span className={value === type ? "text-indigo-700" : "text-gray-700"}>{type}</span>
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={addAndSelect}
                disabled={createType.isPending}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 text-left border-t border-gray-100 mt-0.5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5 flex-shrink-0" /> {createType.isPending ? "Adding..." : `Add "${trimmed}"`}
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <p className="px-2 py-2 text-xs text-muted-foreground">No types found.</p>
            )}
          </div>
          {value && (
            <div className="border-t border-gray-100 px-2 py-1.5">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}