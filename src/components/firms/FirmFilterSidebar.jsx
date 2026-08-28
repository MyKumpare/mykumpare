import React, { useState } from "react";
import { ChevronDown, ChevronRight, Building, MapPin, Activity, X } from "lucide-react";

const FIRM_TYPES = [
  "Investment Manager",
  "Allocator",
  "Investment Consultant",
  "Securities Brokerage",
  "Trade Organizations",
];

const REGIONS = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Latin America",
  "Middle East & Africa",
  "Global",
  "Undefined",
];

const ACTIVITY_OPTIONS = [
  { value: "all", label: "All firms" },
  { value: "30", label: "Active (≤ 30 days)" },
  { value: "90", label: "Reviewed (31–90 days)" },
  { value: "stale", label: "Stale (90+ days)" },
];

function FilterGroup({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0 pb-2 mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left py-1 group"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400" />
        )}
        <Icon className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {title}
        </span>
      </button>
      {open && <div className="mt-1.5 pl-1">{children}</div>}
    </div>
  );
}

export default function FirmFilterSidebar({
  selectedTypes,
  onToggleType,
  selectedRegions,
  onToggleRegion,
  activityFilter,
  onActivityChange,
  locationSearch,
  onLocationSearchChange,
  onClearAll,
  counts,
}) {
  const hasActiveFilters =
    selectedTypes.size > 0 ||
    selectedRegions.size > 0 ||
    activityFilter !== "all" ||
    locationSearch.trim();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 md:sticky md:top-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">Filters</span>
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="text-[11px] text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <FilterGroup title="Firm Type" icon={Building}>
        <div className="space-y-0.5">
          {FIRM_TYPES.map((type) => {
            const count = counts?.types?.[type] || 0;
            const checked = selectedTypes.has(type);
            return (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleType(type)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span
                  className={`text-xs flex-1 truncate ${
                    checked ? "text-indigo-700 font-medium" : "text-gray-600"
                  }`}
                >
                  {type}
                </span>
                <span className="text-[10px] text-gray-400">{count}</span>
              </label>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Location" icon={MapPin}>
        <input
          type="text"
          value={locationSearch}
          onChange={(e) => onLocationSearchChange(e.target.value)}
          placeholder="Search location text..."
          className="w-full text-xs px-2 py-1 mb-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <div className="space-y-0.5">
          {REGIONS.map((region) => {
            const count = counts?.regions?.[region] || 0;
            const checked = selectedRegions.has(region);
            return (
              <label
                key={region}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleRegion(region)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span
                  className={`text-xs flex-1 truncate ${
                    checked ? "text-indigo-700 font-medium" : "text-gray-600"
                  }`}
                >
                  {region}
                </span>
                <span className="text-[10px] text-gray-400">{count}</span>
              </label>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Recent Activity" icon={Activity}>
        <div className="space-y-0.5">
          {ACTIVITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
            >
              <input
                type="radio"
                name="activity-filter"
                checked={activityFilter === opt.value}
                onChange={() => onActivityChange(opt.value)}
                className="w-3.5 h-3.5 border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span
                className={`text-xs ${
                  activityFilter === opt.value
                    ? "text-indigo-700 font-medium"
                    : "text-gray-600"
                }`}
              >
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </FilterGroup>
    </div>
  );
}