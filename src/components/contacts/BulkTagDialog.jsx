import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Check } from "lucide-react";
import { tagColorClass } from "./contactTagColors";

const PRESET_TAGS = [
  "Investor",
  "Board Member",
  "Advisor",
  "Limited Partner",
  "Allocator",
  "Service Provider",
  "Consultant",
  "Mentor",
  "Speaker",
  "Sponsor",
];

// Dialog for assigning tags to a batch of selected contacts at once. Tags are
// picked from the shared ContactTag library (plus presets); a new tag typed in
// the search box is created and added. On apply, the chosen tags are merged
// into each selected contact's existing tags (no removal of current tags).
export default function BulkTagDialog({ open, onOpenChange, selectedCount, onApply }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(() => new Set());

  const { data: dbTags = [] } = useQuery({
    queryKey: ["contact-tags"],
    queryFn: () => base44.entities.ContactTag.list("name", 500),
    enabled: open,
  });

  const allTags = useMemo(() => {
    const map = new Map();
    [...PRESET_TAGS, ...dbTags.map((t) => t.name)].forEach((n) => {
      const key = n.toLowerCase().trim();
      if (!map.has(key)) map.set(key, n);
    });
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }, [dbTags]);

  const createTag = useMutation({
    mutationFn: (name) => base44.entities.ContactTag.create({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-tags"] }),
  });

  const trimmed = search.trim();
  const canCreate = trimmed && !allTags.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const toggle = (t) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });

  const addAndPick = () => {
    const v = trimmed;
    createTag.mutate(v, { onSuccess: () => { toggle(v); setSearch(""); } });
  };

  const handleApply = () => {
    onApply(Array.from(picked));
    setPicked(new Set());
    setSearch("");
  };

  useEffect(() => {
    if (!open) {
      setPicked(new Set());
      setSearch("");
    }
  }, [open]);

  const filtered = trimmed
    ? allTags.filter((t) => t.toLowerCase().includes(trimmed.toLowerCase()))
    : allTags;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add tags to {selectedCount} contact{selectedCount === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500">
          Select tags to add to every selected contact. Tags already on a contact are kept.
        </p>

        {picked.size > 0 && (
          <div className="flex flex-wrap gap-1">
            {Array.from(picked).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggle(t)}
                className={`inline-flex items-center gap-0.5 rounded-full border font-medium px-2 py-0.5 text-xs ${tagColorClass(t)}`}
              >
                {t} <span className="text-[10px] opacity-60">✕</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or create a tag…"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="max-h-56 overflow-y-auto flex flex-wrap gap-1.5 p-1">
          {filtered.map((t) => {
            const active = picked.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggle(t)}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${active ? tagColorClass(t) : "bg-white text-gray-700 border-gray-300 hover:border-pink-400"}`}
              >
                {active && <Check className="w-3 h-3" />} {t}
              </button>
            );
          })}
          {canCreate && (
            <button
              type="button"
              onClick={addAndPick}
              className="inline-flex items-center gap-0.5 rounded-full border border-pink-300 bg-pink-50 text-pink-700 px-2 py-0.5 text-xs font-medium hover:bg-pink-100"
            >
              <Plus className="w-3 h-3" /> "{trimmed}"
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-pink-600 hover:bg-pink-700 text-white"
            onClick={handleApply}
            disabled={picked.size === 0}
          >
            Add {picked.size > 0 ? `${picked.size} tag${picked.size === 1 ? "" : "s"}` : "Tags"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}