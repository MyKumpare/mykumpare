import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import {
  REGIONAL_BIAS_OPTIONS,
  WEIGHT_OPTIONS,
  GICS_SECTORS,
  GICS_INDUSTRIES,
  ALL_COUNTRIES,
} from "./biasData";

// ── Shared: Searchable multi-select with add-custom + weight + percentage per item ──

function BiasRow({ item, onChange, onRemove, isEditing }) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-1.5 px-2 rounded-md border border-indigo-100 bg-indigo-50/40">
      <span className="text-sm font-medium text-gray-800 flex-1 min-w-[100px]">{item.name}</span>
      {isEditing ? (
        <>
          <select
            value={item.weight || ""}
            onChange={(e) => onChange({ ...item, weight: e.target.value })}
            className="h-8 text-sm rounded-md border border-input bg-background px-2 py-1 text-gray-700"
          >
            <option value="">Weight...</option>
            {WEIGHT_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">±</span>
            <Input
              type="number"
              min="0"
              step="0.1"
              placeholder="0.0"
              value={item.pct ?? ""}
              onChange={(e) => onChange({ ...item, pct: e.target.value })}
              className="h-8 w-20 text-sm"
            />
            <span className="text-xs text-gray-500">%</span>
          </div>
          <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <div className="flex items-center gap-3">
          {item.weight && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">{item.weight}</span>}
          {item.pct !== "" && item.pct !== undefined && item.pct !== null && (
            <span className="text-xs text-gray-600">±{parseFloat(item.pct).toFixed(2)}%</span>
          )}
        </div>
      )}
    </div>
  );
}

function BiasSubsection({ label, allOptions, items, onChange, isEditing, isMultiSelect = true }) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const selectedNames = items.map((i) => i.name);
  const filtered = allOptions.filter(
    (o) => o.toLowerCase().includes(search.toLowerCase()) && !selectedNames.includes(o)
  );

  const addItem = (name) => {
    if (selectedNames.includes(name)) return;
    onChange([...items, { name, weight: "", pct: "" }]);
    setSearch("");
    setShowDropdown(false);
    setCustomInput("");
  };

  const updateItem = (idx, updated) => {
    const next = [...items];
    next[idx] = updated;
    onChange(next);
  };

  const removeItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const handleAddCustom = () => {
    const val = customInput.trim();
    if (val && !selectedNames.includes(val)) {
      addItem(val);
    }
  };

  return (
    <div className="space-y-2 pl-4 border-l-2 border-indigo-200">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>

      {/* Selected items */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <BiasRow
              key={idx}
              item={item}
              onChange={(updated) => updateItem(idx, updated)}
              onRemove={() => removeItem(idx)}
              isEditing={isEditing}
            />
          ))}
        </div>
      )}

      {isEditing && (
        <div className="relative">
          <div className="flex gap-2">
            <Input
              placeholder={`Search ${label}...`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              className="h-8 text-sm flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2 gap-1 text-xs"
              onClick={() => setShowDropdown((v) => !v)}
            >
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>

          {showDropdown && (
            <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
              {filtered.length > 0 ? (
                filtered.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 text-gray-700"
                    onMouseDown={() => addItem(opt)}
                  >
                    {opt}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-400">No matches found</div>
              )}
              {/* Custom add */}
              <div className="border-t px-2 py-1.5 flex gap-1.5">
                <Input
                  placeholder="Add custom..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCustom(); } }}
                  className="h-7 text-xs flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onMouseDown={handleAddCustom}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Click outside to close */}
          {showDropdown && (
            <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          )}
        </div>
      )}

      {!isEditing && items.length === 0 && (
        <div className="text-sm text-gray-400 italic">—</div>
      )}
    </div>
  );
}

function CashLevelBlock({ value, onChange, isEditing }) {
  return (
    <div className="space-y-1.5 pl-4 border-l-2 border-indigo-200">
      <Label className="text-sm font-medium text-gray-700">Cash Level</Label>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-500">±</span>
          <Input
            type="number"
            min="0"
            step="0.1"
            placeholder="0.0"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-24 text-sm"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      ) : (
        <div className="h-8 px-3 flex items-center rounded-md border bg-gray-50 text-sm text-gray-700 w-32">
          {value !== "" && value !== null && value !== undefined
            ? `±${parseFloat(value).toFixed(2)}%`
            : <span className="text-gray-400 italic">—</span>}
        </div>
      )}
    </div>
  );
}

export default function ProductBiasesSection({ biases = {}, onChange, isEditing }) {
  const set = (key, val) => onChange({ ...biases, [key]: val });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-indigo-500 flex-shrink-0" />
        <Label className="text-sm font-semibold text-gray-800">Product Biases</Label>
      </div>
      <div className="space-y-4 mt-2">
        <BiasSubsection
          label="Regional Bias"
          allOptions={REGIONAL_BIAS_OPTIONS}
          items={biases.regional || []}
          onChange={(val) => set("regional", val)}
          isEditing={isEditing}
        />
        <BiasSubsection
          label="Country"
          allOptions={ALL_COUNTRIES}
          items={biases.country || []}
          onChange={(val) => set("country", val)}
          isEditing={isEditing}
        />
        <BiasSubsection
          label="Sector"
          allOptions={GICS_SECTORS}
          items={biases.sector || []}
          onChange={(val) => set("sector", val)}
          isEditing={isEditing}
        />
        <BiasSubsection
          label="Industry"
          allOptions={GICS_INDUSTRIES}
          items={biases.industry || []}
          onChange={(val) => set("industry", val)}
          isEditing={isEditing}
        />
        <CashLevelBlock
          value={biases.cash_level ?? ""}
          onChange={(val) => set("cash_level", val)}
          isEditing={isEditing}
        />
      </div>
    </div>
  );
}