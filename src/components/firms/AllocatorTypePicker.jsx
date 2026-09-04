import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";

// Built-in presets always offered even before the DB library is seeded, so the
// picker is never empty on a fresh install.
const PRESET_TYPES = [
  "Public Funds",
  "Endowment",
  "Family Offices",
  "RIAs",
];

/**
 * Multi-select dropdown for allocator types, backed by the shared AllocatorType
 * master list. Users pick existing types, search to narrow, or type to add a new
 * type — which is validated against existing types (case-insensitive) and
 * persisted to the library for everyone. Existing types can be renamed or
 * deleted inline. Duplicate names are blocked before creation.
 */
export default function AllocatorTypePicker({ value = [], onChange, disabled = false, placeholder = "Select allocator types..." }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const ref = useRef(null);

  const { data: dbTypes = [] } = useQuery({
    queryKey: ["allocator-types"],
    queryFn: () => base44.entities.AllocatorType.list("name", 500),
  });

  const allTypes = useMemo(() => {
    const map = new Map();
    [...PRESET_TYPES, ...dbTypes.map((t) => t.name)].forEach((n) => {
      const key = n.toLowerCase().trim();
      if (!map.has(key)) map.set(key, n);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [dbTypes]);

  // Map of lowercased name -> db record (for rename/delete operations).
  const dbByName = useMemo(() => {
    const m = new Map();
    dbTypes.forEach((t) => m.set(t.name.toLowerCase().trim(), t));
    return m;
  }, [dbTypes]);

  const createType = useMutation({
    mutationFn: (name) => base44.entities.AllocatorType.create({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allocator-types"] }),
    onError: (err) => {
      toast({ title: "Could not add allocator type", description: err?.message || "It may already exist.", variant: "destructive" });
    },
  });

  const updateType = useMutation({
    mutationFn: ({ id, name }) => base44.entities.AllocatorType.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allocator-types"] });
      // If the renamed type was selected, reflect the new name in the selection.
      const prev = editingName;
      // editingId holds the record being renamed; we re-resolve below.
    },
    onError: (err) => {
      toast({ title: "Could not rename allocator type", description: err?.message || "It may already exist.", variant: "destructive" });
    },
  });

  const deleteType = useMutation({
    mutationFn: (id) => base44.entities.AllocatorType.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["allocator-types"] }),
    onError: (err) => {
      toast({ title: "Could not delete allocator type", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const trimmed = search.trim();
  const canCreate = trimmed && !allTypes.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const toggle = (type) => {
    const lower = type.toLowerCase();
    if (value.some((v) => v.toLowerCase() === lower)) {
      onChange(value.filter((v) => v.toLowerCase() !== lower));
    } else {
      onChange([...value, type]);
    }
  };

  const addAndSelect = () => {
    const v = trimmed;
    if (!v) return;
    // Guard against duplicates (case-insensitive) before persisting.
    if (allTypes.some((o) => o.toLowerCase() === v.toLowerCase())) {
      toast({ title: "Already exists", description: `"${v}" is already an allocator type.`, variant: "destructive" });
      return;
    }
    createType.mutate(v, {
      onSuccess: () => {
        toggle(v);
        setSearch("");
      },
    });
  };

  const startEdit = (rec, currentName) => {
    setEditingId(rec.id);
    setEditingName(currentName);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const v = editingName.trim();
    if (!v) {
      setEditingId(null);
      return;
    }
    // Block duplicate rename (case-insensitive), excluding the record being edited.
    const dup = allTypes.find((o) => o.toLowerCase() === v.toLowerCase() && (dbByName.get(o.toLowerCase())?.id !== editingId));
    if (dup) {
      toast({ title: "Already exists", description: `"${v}" is already an allocator type.`, variant: "destructive" });
      return;
    }
    const rec = dbTypes.find((t) => t.id === editingId);
    const prevName = rec?.name;
    updateType.mutate({ id: editingId, name: v }, {
      onSuccess: () => {
        // Reflect the rename in the current selection if it was selected.
        if (prevName && value.some((s) => s.toLowerCase() === prevName.toLowerCase())) {
          onChange(value.map((s) => s.toLowerCase() === prevName.toLowerCase() ? v : s));
        }
        setEditingId(null);
        setEditingName("");
      },
    });
  };

  const removeType = (rec, name) => {
    deleteType.mutate(rec.id, {
      onSuccess: () => {
        // Remove from current selection if selected.
        if (value.some((s) => s.toLowerCase() === name.toLowerCase())) {
          onChange(value.filter((s) => s.toLowerCase() !== name.toLowerCase()));
        }
      },
    });
  };

  const filtered = trimmed
    ? allTypes.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
    : allTypes;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setSearch(""); setEditingId(null); }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50",
          value.length === 0 && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {value.length > 0
            ? `${value.length} selected: ${value.join(", ")}`
            : placeholder}
        </span>
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
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((type) => {
              const rec = dbByName.get(type.toLowerCase());
              const selected = value.some((v) => v.toLowerCase() === type.toLowerCase());
              const isEditing = editingId === rec?.id;
              return (
                <div key={type} className="group flex w-full items-center gap-1 rounded-sm px-1 py-1 hover:bg-accent">
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        autoFocus
                        className="flex-1 text-sm px-1.5 py-1 outline-none border border-indigo-300 rounded"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") { setEditingId(null); setEditingName(""); }
                        }}
                      />
                      <button
                        type="button"
                        onClick={commitEdit}
                        className="text-green-600 hover:text-green-700 px-1"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingId(null); setEditingName(""); }}
                        className="text-gray-400 hover:text-gray-600 px-1"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggle(type)}
                        className={cn(
                          "flex flex-1 items-center gap-2 rounded-sm px-1.5 py-1 text-sm text-left",
                          selected && "font-medium"
                        )}
                      >
                        {selected ? (
                          <Check className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                        ) : (
                          <span className="w-3.5 flex-shrink-0" />
                        )}
                        <span className={selected ? "text-indigo-700" : "text-gray-700"}>{type}</span>
                      </button>
                      {rec && (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => startEdit(rec, type)}
                            className="text-gray-400 hover:text-indigo-600 px-1"
                            title="Rename"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeType(rec, type)}
                            className="text-gray-400 hover:text-red-600 px-1"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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
          {value.length > 0 && (
            <div className="border-t border-gray-100 px-2 py-1.5">
              <button
                type="button"
                onClick={() => { onChange([]); }}
                className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}