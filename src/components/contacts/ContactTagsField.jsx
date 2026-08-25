import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, Tag } from "lucide-react";
import ContactTagPicker from "./ContactTagPicker";

// Multi-select picker for assigning tags (from the shared ContactTag library)
// to a contact during creation/editing. Reuses the single-select
// ContactTagPicker inside a popover, and surfaces the library's "Manage tags"
// manager from within that picker.
export default function ContactTagsField({ value = [], onChange, viewMode }) {
  const [open, setOpen] = useState(false);

  if (viewMode) {
    if (!value || value.length === 0) {
      return <div className="text-sm px-1 text-gray-400 italic">—</div>;
    }
    return (
      <div className="flex flex-wrap gap-1 px-1">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
            {t}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {(value || []).map((t) => (
        <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="text-pink-400 hover:text-red-500 transition-colors"
            title="Remove tag"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-pink-300 hover:text-pink-600 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add tag
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <ContactTagPicker
            value=""
            onChange={(tag) => {
              if (tag && !(value || []).includes(tag)) onChange([...(value || []), tag]);
            }}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
      {(value || []).length === 0 && (
        <span className="text-xs text-gray-400 italic flex items-center gap-1">
          <Tag className="w-3 h-3" /> No tags assigned
        </span>
      )}
    </div>
  );
}