import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search, Plus, Settings2, Check } from "lucide-react";
import ContactTagManager from "./ContactTagManager";

// Built-in presets always offered even before the DB library is seeded, so the
// picker is never empty on a fresh install.
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

// Quick-pick tag dropdown backed by the shared ContactTag library. Users pick a
// predefined tag with one click, search to narrow, or type to add a new tag —
// which is persisted to the library for everyone. A "Manage tags" link opens
// the management dialog.
export default function ContactTagPicker({ value, onChange, onClose }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showManager, setShowManager] = useState(false);
  const inputRef = useRef(null);

  const { data: dbTags = [] } = useQuery({
    queryKey: ["contact-tags"],
    queryFn: () => base44.entities.ContactTag.list("name", 500),
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
  const filtered = trimmed
    ? allTags.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
    : allTags;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const select = (tag) => { onChange(tag); setSearch(""); onClose?.(); };
  const addAndSelect = () => {
    const v = trimmed;
    createTag.mutate(v, { onSuccess: () => select(v) });
  };

  return (
    <div className="w-56">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100">
        <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 text-xs bg-transparent outline-none placeholder:text-gray-400 min-w-0"
          placeholder="Search tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canCreate) addAndSelect(); }}
        />
      </div>
      <div className="max-h-44 overflow-y-auto p-1">
        {filtered.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => select(tag)}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs hover:bg-pink-50 text-left"
          >
            {value === tag ? (
              <Check className="w-3.5 h-3.5 text-pink-600 flex-shrink-0" />
            ) : (
              <span className="w-3.5 flex-shrink-0" />
            )}
            <span className={value === tag ? "text-pink-700 font-medium" : "text-gray-700"}>{tag}</span>
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            onClick={addAndSelect}
            className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-pink-600 hover:bg-pink-50 text-left border-t border-gray-100 mt-0.5"
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" /> Add "{trimmed}"
          </button>
        )}
        {filtered.length === 0 && !canCreate && (
          <p className="px-2 py-2 text-xs text-gray-400 italic">No tags found</p>
        )}
      </div>
      <div className="border-t border-gray-100 px-2 py-1.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowManager(true)}
          className="text-[11px] text-gray-400 hover:text-pink-600 flex items-center gap-1"
        >
          <Settings2 className="w-3 h-3" /> Manage tags
        </button>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(""); onClose?.(); }}
            className="text-[11px] text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      {showManager && (
        <ContactTagManager open={showManager} onOpenChange={setShowManager} />
      )}
    </div>
  );
}