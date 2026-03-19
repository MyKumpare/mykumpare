import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import ProductBiasesSection from "./ProductBiasesSection";

const SECTIONS = [
  { key: "investment_edge", label: "Investment Edge" },
  { key: "investment_philosophy", label: "Investment Philosophy" },
  { key: "investment_universe", label: "Investment Universe" },
  { key: "investment_process", label: "Investment Process", hasSub: true },
  { key: "market_positioning", label: "Market Positioning", type: "multiselect" },
  { key: "portfolio_expectations", label: "Product Expectations" },
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

function SubsectionBlock({ label, value, onChange, isEditing }) {
  return (
    <div className="space-y-2 pl-4 border-l-2 border-indigo-200">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      {isEditing ? (
        <Textarea
          placeholder={`Enter ${label.toLowerCase()}...`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[100px] text-sm leading-relaxed resize-none"
        />
      ) : (
        <div className="px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-gray-700 min-h-[80px] whitespace-pre-wrap leading-relaxed">
          {value || <span className="text-gray-400 italic">—</span>}
        </div>
      )}
    </div>
  );
}

function RangeSubsectionBlock({ label, minKey, maxKey, unit, isInteger, descriptions, onChange, isEditing }) {
  const minVal = descriptions?.[minKey] ?? "";
  const maxVal = descriptions?.[maxKey] ?? "";
  const inputType = "number";

  return (
    <div className="space-y-1.5 pl-4 border-l-2 border-indigo-200">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-0.5">
          <Label className="text-xs text-gray-500">Min {unit}</Label>
          {isEditing ? (
            <Input
              type={inputType}
              step={isInteger ? "1" : "0.01"}
              placeholder="Min"
              value={minVal}
              onChange={(e) => onChange({ ...descriptions, [minKey]: e.target.value })}
              className="h-8 text-sm"
            />
          ) : (
            <div className="h-8 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
              {formatNum(minVal) !== null ? formatNum(minVal) : <span className="text-gray-400 italic">—</span>}
            </div>
          )}
        </div>
        <span className="text-gray-400 mt-5">–</span>
        <div className="flex-1 space-y-0.5">
          <Label className="text-xs text-gray-500">Max {unit}</Label>
          {isEditing ? (
            <Input
              type={inputType}
              step={isInteger ? "1" : "0.01"}
              placeholder="Max"
              value={maxVal}
              onChange={(e) => onChange({ ...descriptions, [maxKey]: e.target.value })}
              className="h-8 text-sm"
            />
          ) : (
            <div className="h-8 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700">
              {formatNum(maxVal) !== null ? formatNum(maxVal) : <span className="text-gray-400 italic">—</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatNum(val) {
  if (val === "" || val === null || val === undefined) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return Number.isInteger(n) ? n.toString() : n.toFixed(2);
}

function calcRatio(excess, tracking) {
  const e = parseFloat(excess);
  const t = parseFloat(tracking);
  if (!isNaN(e) && !isNaN(t) && t !== 0) return (e / t).toFixed(2);
  return null;
}

function InformationRatioBlock({ descriptions }) {
  const irMin = calcRatio(descriptions?.excess_return_min, descriptions?.tracking_error_min);
  const irMax = calcRatio(descriptions?.excess_return_max, descriptions?.tracking_error_max);

  return (
    <div className="space-y-1.5 pl-4 border-l-2 border-indigo-200">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium text-gray-700">Target Information Ratio Range</Label>
        <span className="text-xs text-gray-400 italic">(auto-calculated)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 space-y-0.5">
          <Label className="text-xs text-gray-500">Min</Label>
          <div className="h-8 px-3 flex items-center rounded-md border bg-gray-100 text-sm text-gray-600">
            {irMin !== null ? irMin : <span className="text-gray-400 italic">—</span>}
          </div>
        </div>
        <span className="text-gray-400 mt-5">–</span>
        <div className="flex-1 space-y-0.5">
          <Label className="text-xs text-gray-500">Max</Label>
          <div className="h-8 px-3 flex items-center rounded-md border bg-gray-100 text-sm text-gray-600">
            {irMax !== null ? irMax : <span className="text-gray-400 italic">—</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductInvestmentDescriptionTab({ descriptions, onChange, isEditing }) {
  const set = (key, val) => onChange({ ...descriptions, [key]: val });

  return (
    <div className="space-y-6 py-2">
      {SECTIONS.map(({ key, label, type, hasSub }) => (
        <div key={key}>
          <SectionBlock
            label={label}
            value={descriptions?.[key] || (type === "multiselect" ? [] : "")}
            onChange={(val) => set(key, val)}
            isEditing={isEditing}
            type={type}
            options={type === "multiselect" ? MARKET_POSITIONING_OPTIONS : undefined}
          />
          
          {hasSub && key === "investment_process" && (
            <div className="space-y-4 mt-4">
              <SubsectionBlock
                label="Buy Discipline"
                value={descriptions?.investment_process_buy_discipline || ""}
                onChange={(val) => set("investment_process_buy_discipline", val)}
                isEditing={isEditing}
              />
              <SubsectionBlock
                label="Sell Discipline"
                value={descriptions?.investment_process_sell_discipline || ""}
                onChange={(val) => set("investment_process_sell_discipline", val)}
                isEditing={isEditing}
              />
            </div>
          )}
          {key === "portfolio_expectations" && (
            <div className="space-y-3 mt-4">
              <RangeSubsectionBlock
                label="Target Tracking Error Range"
                minKey="tracking_error_min"
                maxKey="tracking_error_max"
                unit="%"
                descriptions={descriptions}
                onChange={onChange}
                isEditing={isEditing}
              />
              <RangeSubsectionBlock
                label="Target Excess Return Range"
                minKey="excess_return_min"
                maxKey="excess_return_max"
                unit="%"
                descriptions={descriptions}
                onChange={onChange}
                isEditing={isEditing}
              />
              <InformationRatioBlock descriptions={descriptions} />
              <RangeSubsectionBlock
                label="Number of Holdings Range"
                minKey="holdings_min"
                maxKey="holdings_max"
                unit="No."
                isInteger
                descriptions={descriptions}
                onChange={onChange}
                isEditing={isEditing}
              />
            </div>
          )}
        </div>
      ))}

      {/* Product Biases */}
      <ProductBiasesSection
        biases={descriptions?.product_biases || {}}
        onChange={(val) => set("product_biases", val)}
        isEditing={isEditing}
      />
    </div>
  );
}