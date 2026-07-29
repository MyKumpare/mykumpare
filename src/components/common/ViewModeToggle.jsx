import React from "react";
import { List, LayoutGrid, Columns3 } from "lucide-react";

const MODES = [
  { value: "list", icon: List, label: "List view" },
  { value: "card", icon: LayoutGrid, label: "Card view" },
  { value: "kanban", icon: Columns3, label: "Kanban view" },
];

export default function ViewModeToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
      {MODES.map(({ value: modeValue, icon: Icon, label }) => (
        <button
          key={modeValue}
          type="button"
          onClick={() => onChange(modeValue)}
          title={label}
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
            value === modeValue
              ? "bg-white text-gray-800 shadow-sm"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}