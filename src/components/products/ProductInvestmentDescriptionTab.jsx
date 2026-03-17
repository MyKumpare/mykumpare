import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const SECTIONS = [
  { key: "investment_philosophy", label: "Investment Philosophy" },
  { key: "investment_process", label: "Investment Process" },
];

function SectionBlock({ label, value, onChange, isEditing }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-indigo-500 flex-shrink-0" />
        <Label className="text-sm font-semibold text-gray-800">{label}</Label>
      </div>
      {isEditing ? (
        <Textarea
          placeholder={`Enter ${label.toLowerCase()}...`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px] text-sm leading-relaxed resize-none"
        />
      ) : (
        <div className="px-3 py-3 rounded-md border bg-gray-50 text-sm text-gray-700 min-h-[80px] whitespace-pre-wrap leading-relaxed">
          {value || <span className="text-gray-400 italic">—</span>}
        </div>
      )}
    </div>
  );
}

export default function ProductInvestmentDescriptionTab({ descriptions, onChange, isEditing }) {
  const set = (key, val) => onChange({ ...descriptions, [key]: val });

  return (
    <div className="space-y-6 py-2">
      {SECTIONS.map(({ key, label }) => (
        <SectionBlock
          key={key}
          label={label}
          value={descriptions?.[key] || ""}
          onChange={(val) => set(key, val)}
          isEditing={isEditing}
        />
      ))}
    </div>
  );
}