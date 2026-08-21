import React, { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Default quick-add tags always offered in the picker
export const DEFAULT_CONTENT_TAGS = ["Newsletter", "Research Paper"];

const TAG_COLORS = [
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-sky-50 text-sky-700 border-sky-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
];

function colorForTag(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

/**
 * Displays a news article's content tags as badges and lets the user add/remove tags.
 * Props:
 *   tags: string[]               — current tags on the article
 *   onChange: (next: string[]) => Promise<void> | void  — called with the new tag list
 *   align?: "start" | "center" | "end"
 */
export default function NewsContentTags({ tags = [], onChange, align = "start" }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const current = Array.isArray(tags) ? tags : [];

  const addTag = async (tag) => {
    const clean = (tag || "").trim();
    if (!clean) return;
    if (current.some(t => t.toLowerCase() === clean.toLowerCase())) return;
    const next = [...current, clean];
    setDraft("");
    await onChange?.(next);
  };

  const removeTag = async (tag) => {
    const next = current.filter(t => t !== tag);
    await onChange?.(next);
  };

  const suggestions = DEFAULT_CONTENT_TAGS.filter(
    d => !current.some(t => t.toLowerCase() === d.toLowerCase())
  );

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {current.map(tag => (
        <span
          key={tag}
          className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colorForTag(tag)}`}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:opacity-70"
            title={`Remove ${tag}`}
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            title="Add tag"
          >
            <Plus className="w-2.5 h-2.5" /> Tag
          </button>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-56 p-2">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Quick add</p>
            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="text-[11px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic">Default tags already added</p>
            )}

            <div className="h-px bg-gray-100" />

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Custom tag</p>
            <form
              onSubmit={(e) => { e.preventDefault(); addTag(draft); }}
              className="flex items-center gap-1"
            >
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Type a new tag..."
                className="flex-1 h-7 text-xs px-2 rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="h-7 px-2 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </form>

            {current.length > 0 && (
              <>
                <div className="h-px bg-gray-100" />
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Current</p>
                <div className="flex flex-wrap gap-1">
                  {current.map(tag => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${colorForTag(tag)}`}
                    >
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="hover:opacity-70">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}