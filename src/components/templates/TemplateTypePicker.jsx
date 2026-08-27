import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Search, Plus, Check, AlertTriangle } from "lucide-react";
import { findSimilarTypeName } from "./templateTypeSimilarity";
import { toast } from "@/components/ui/use-toast";

/**
 * Searchable popover-based select for Template Type.
 * - Lets the user pick an existing type or create a new one.
 * - Duplicate validation: if the entered name is an exact or near-duplicate
 *   of an existing type (Levenshtein similarity ≥ 0.85), the user is shown
 *   a confirmation prompt to Accept (use existing) or Reject (keep editing).
 */
export default function TemplateTypePicker({ value, onChange, placeholder = "Select type..." }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newType, setNewType] = useState("");
  const [duplicateMatch, setDuplicateMatch] = useState(null);

  const { data: types = [] } = useQuery({
    queryKey: ["template_types"],
    queryFn: () => base44.entities.TemplateType.list("-created_date"),
  });

  const existingNames = useMemo(() => types.map((t) => t.name), [types]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return types;
    return types.filter((t) => t.name.toLowerCase().includes(q));
  }, [types, search]);

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.TemplateType.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template_types"] });
    },
  });

  const handleSelect = (name) => {
    onChange(name);
    setSearch("");
    setNewType("");
    setDuplicateMatch(null);
    setOpen(false);
  };

  const handleAddNew = () => {
    const trimmed = newType.trim();
    if (!trimmed) return;

    const match = findSimilarTypeName(trimmed, existingNames);
    if (match) {
      setDuplicateMatch(match);
      return;
    }

    createMutation.mutate(trimmed, {
      onSuccess: (created) => {
        handleSelect(created.name);
        toast({ title: "Template type added", description: `"${created.name}" has been created.` });
      },
      onError: (err) => {
        toast({ title: "Failed to add type", description: err?.message || "Please try again.", variant: "destructive" });
      },
    });
  };

  const handleAcceptDuplicate = () => {
    if (duplicateMatch) handleSelect(duplicateMatch);
  };

  const handleRejectDuplicate = () => {
    setDuplicateMatch(null);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSearch(""); setNewType(""); setDuplicateMatch(null); } }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {value || placeholder}
          <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              autoFocus
              placeholder="Search types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
        </div>

        <div className="max-h-[200px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-400">No types found.</div>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.name)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-gray-50 text-left"
              >
                {t.name}
                {value === t.name && <Check className="w-3.5 h-3.5 text-indigo-500" />}
              </button>
            ))
          )}
        </div>

        <div className="border-t p-2 space-y-1.5">
          {duplicateMatch && (
            <div className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-800">
                  Similar to <strong>"{duplicateMatch}"</strong>. Use it instead?
                </p>
                <div className="flex gap-1.5 mt-1">
                  <Button size="sm" className="h-6 px-2 text-xs" onClick={handleAcceptDuplicate}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleRejectDuplicate}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-1.5">
            <Input
              placeholder="Add new type..."
              value={newType}
              onChange={(e) => {
                setNewType(e.target.value);
                setDuplicateMatch(null);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNew(); } }}
              className="h-8 flex-1"
            />
            <Button size="sm" className="h-8 px-2 gap-1 flex-shrink-0" onClick={handleAddNew} disabled={!newType.trim() || createMutation.isPending}>
              <Plus className="w-3.5 h-3.5" />
              Add
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}