import React from "react";
import { AlertTriangle } from "lucide-react";

// Inline live warning shown under the Website / Email / LinkedIn fields in
// AddFirmDialog when the current value matches (exactly or closely) another
// firm already in the system. `conflicts` is the filtered list from
// findFirmFieldConflicts for a single field.
export default function LiveFieldConflictWarning({ conflicts }) {
  if (!conflicts || conflicts.length === 0) return null;
  return (
    <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1">
      <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        {conflicts.length} match{conflicts.length > 1 ? "es" : ""} found — already used by:
      </p>
      <ul className="space-y-0.5">
        {conflicts.map((c, i) => {
          const f = c.existingFirm || {};
          const types = f.firm_types?.length
            ? f.firm_types
            : f.firm_type
            ? [f.firm_type]
            : [];
          return (
            <li key={i} className="text-xs text-gray-700 flex items-start gap-1 flex-wrap">
              <span className="font-medium">{f.name}</span>
              {types.length > 0 && <span className="text-gray-500">— {types.join(", ")}</span>}
              <span className={`ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${c.matchType === "exact" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                {c.matchType === "exact" ? "Exact" : "Similar"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}