import React, { useState, useRef, useEffect } from "react";
import { Tag, ChevronDown, X, Settings2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * VideoTagMultiSelect — multi-select dropdown for assigning VideoTag records to a video.
 * Tags are displayed in sort_order. Includes a button to open the tag manager.
 *
 * Props:
 *   tags — array of VideoTag records (already sorted)
 *   selectedIds — array of selected tag IDs
 *   onChange — (newSelectedIds) => void
 *   onOpenManager — () => void  (opens the tag manager dialog)
 */
export default function VideoTagMultiSelect({ tags = [], selectedIds = [], onChange, onOpenManager }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const filtered = tags.filter((t) =>
    (t.name || "").toLowerCase().includes(search.toLowerCase().trim())
  );

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id));

  return (
    <div className="relative" ref={containerRef}>
      <label className="text-xs font-medium text-gray-600 mb-1 block">Tags</label>
      <div
        className="min-h-[38px] w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 flex flex-wrap items-center gap-1 cursor-pointer hover:border-gray-400"
        onClick={() => setOpen(!open)}
      >
        {selectedTags.length === 0 ? (
          <span className="text-sm text-gray-400 px-1">Select tags...</span>
        ) : (
          selectedTags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: t.color || "#6366f1" }}
              onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
            >
              {t.name}
              <X className="w-3 h-3" />
            </span>
          ))
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenManager(); }}
            className="text-gray-400 hover:text-indigo-600 p-0.5"
            title="Manage tags"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags..."
              className="w-full h-7 px-2 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                {search ? "No matching tags" : "No tags yet — open the tag manager to add some"}
              </p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-left"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: t.color || "#6366f1" }}
                  />
                  <span className="text-xs text-gray-700 flex-1">{t.name}</span>
                  {selectedIds.includes(t.id) && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}