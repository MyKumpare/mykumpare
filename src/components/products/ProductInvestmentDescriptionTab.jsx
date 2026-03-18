import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const SECTIONS = [
  { key: "investment_edge", label: "Investment Edge" },
  { key: "investment_philosophy", label: "Investment Philosophy" },
  { key: "investment_universe", label: "Investment Universe" },
  { key: "investment_process", label: "Investment Process", hasSub: true },
  { key: "market_positioning", label: "Market Positioning", type: "multiselect" },
  { key: "portfolio_expectations", label: "Portfolio Expectations" },
];

const MARKET_POSITIONING_OPTIONS = [
  "Recovery Cycle",
  "Mid Cycle",
  "Late Cycle",
  "Recession Cycle",
];

function SectionBlock({ label, value, onChange, isEditing, type, options }) {
  if (type === "multiselect") {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-1 rounded-full bg-indigo-500 flex-shrink-0" />
          <Label className="text-sm font-semibold text-gray-800">{label}</Label>
        </div>
        <div className="space-y-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer hover:opacity-80">
              <Checkbox
                checked={selectedValues.includes(opt)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selectedValues, opt]);
                  } else {
                    onChange(selectedValues.filter(v => v !== opt));
                  }
                }}
                disabled={!isEditing}
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
        {!isEditing && selectedValues.length === 0 && (
          <div className="text-sm text-gray-400 italic">—</div>
        )}
      </div>
    );
  }

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