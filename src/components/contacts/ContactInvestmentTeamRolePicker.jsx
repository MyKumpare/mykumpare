import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X, Users } from "lucide-react";
import InvestmentTeamRolePicker from "../products/InvestmentTeamRolePicker";

// Multi-select picker for assigning investment team roles (from the shared
// InvestmentTeamRole library) to a contact during creation/editing. Reuses
// the existing single-select InvestmentTeamRolePicker inside a popover, and
// surfaces the library's "Manage roles" manager from within that picker.
export default function ContactInvestmentTeamRolePicker({ value = [], onChange, viewMode }) {
  const [open, setOpen] = useState(false);

  if (viewMode) {
    if (!value || value.length === 0) {
      return <div className="text-sm px-1 text-gray-400 italic">—</div>;
    }
    return (
      <div className="flex flex-wrap gap-1 px-1">
        {value.map((r) => (
          <span key={r} className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            {r}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {(value || []).map((r) => (
        <span key={r} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
          {r}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== r))}
            className="text-indigo-400 hover:text-red-500 transition-colors"
            title="Remove role"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add role
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <InvestmentTeamRolePicker
            value=""
            onChange={(role) => {
              if (role && !(value || []).includes(role)) onChange([...(value || []), role]);
            }}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
      {(value || []).length === 0 && (
        <span className="text-xs text-gray-400 italic flex items-center gap-1">
          <Users className="w-3 h-3" /> No investment team roles assigned
        </span>
      )}
    </div>
  );
}