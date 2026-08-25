import React from "react";
import { tagColorClass } from "./contactTagColors";

// Renders a contact's tags as color-coded chips. `max` caps how many chips are
// shown, with a "+N" overflow chip for the rest.
export default function ContactTagChips({ tags, max = 4 }) {
  const list = (tags || []).filter(Boolean);
  if (!list.length) return null;
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <span
          key={t}
          className={`inline-flex items-center rounded-full border font-medium text-[10px] px-1.5 py-0.5 ${tagColorClass(t)}`}
        >
          {t}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-[10px] px-1.5 py-0.5 font-medium">
          +{extra}
        </span>
      )}
    </div>
  );
}