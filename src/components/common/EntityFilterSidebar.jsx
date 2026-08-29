import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ListFilter,
  X,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { useFilterSidebarPrefs } from "./useFilterSidebarPrefs";

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

/**
 * Reusable, customizable filter sidebar.
 *
 * Props:
 * - sectionKey: string — used for localStorage persistence of hidden groups
 * - groups: array of group configs:
 *   { key, label, icon, type: "checkbox"|"radio"|"search", hasSearch?, options?: [{value, label}], placeholder? }
 * - values: object mapping group keys to their current values (Set for checkbox, string for radio/search)
 * - onChange: (key, value) => void
 * - counts: object mapping group keys to { optionValue: count }
 * - onClearAll: () => void
 * - hasActiveFilters: boolean
 */
export default function EntityFilterSidebar({
  sectionKey,
  groups = [],
  values = {},
  onChange,
  counts = {},
  onClearAll,
  hasActiveFilters = false,
}) {
  const [showCustomize, setShowCustomize] = useState(false);
  const { hiddenGroups, toggleGroup, setHiddenGroups } =
    useFilterSidebarPrefs(sectionKey);

  const visibleGroups = groups.filter((g) => {
    if (hiddenGroups.has(g.key)) return false;
    if ((g.type === "checkbox" || g.type === "radio") && (!g.options || g.options.length === 0)) return false;
    return true;
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 md:sticky md:top-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomize((v) => !v)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              showCustomize
                ? "bg-[#6610F2] text-white"
                : "bg-[#6610F2]/10 text-[#6610F2] hover:bg-[#6610F2]/20"
            }`}
            title="Customize which filters to show"
          >
            <ListFilter className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700">Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="text-[11px] text-[#6610F2] hover:text-[#6610F2]/80 flex items-center gap-0.5 font-medium"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Customize panel */}
      {showCustomize && (
        <div className="mb-3 p-2.5 rounded-lg bg-[#F8F9FA] border border-gray-200">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold text-[#6C757D] uppercase tracking-wide">
              Show / Hide Filters
            </p>
            {hiddenGroups.size > 0 && (
              <button
                onClick={() => setHiddenGroups(new Set())}
                className="text-[11px] text-[#6610F2] hover:text-[#6610F2]/80 font-medium"
              >
                Show all
              </button>
            )}
          </div>
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {groups.map((g) => {
              const hidden = hiddenGroups.has(g.key);
              return (
                <label
                  key={g.key}
                  className="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-1 py-0.5"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.key)}
                    className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                      !hidden
                        ? "bg-[#3B71CA] border-[#3B71CA] border"
                        : "bg-white border-gray-300 border hover:border-gray-400"
                    }`}
                  >
                    {!hidden && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </button>
                  <span className="text-xs text-[#343A40] flex-1 truncate">
                    {g.label}
                  </span>
                  {hidden ? (
                    <EyeOff className="w-3.5 h-3.5 text-gray-300" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-[#198754]" />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter groups */}
      {visibleGroups.map((group) => {
        const groupCounts = counts[group.key];
        return (
          <FilterGroup
            key={group.key}
            title={group.label}
            icon={group.icon}
            defaultOpen={group.defaultOpen}
          >
            {/* Search-only group */}
            {group.type === "search" && (
              <input
                type="text"
                value={values[group.key] || ""}
                onChange={(e) => onChange(group.key, e.target.value)}
                placeholder={group.placeholder || "Search..."}
                className="w-full text-xs px-2 py-1 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            )}

            {/* Checkbox/radio group with optional search */}
            {(group.type === "checkbox" || group.type === "radio") && (
              <>
                {group.hasSearch && (
                  <input
                    type="text"
                    value={values[`${group.key}_search`] || ""}
                    onChange={(e) =>
                      onChange(`${group.key}_search`, e.target.value)
                    }
                    placeholder={group.searchPlaceholder || "Search..."}
                    className="w-full text-xs px-2 py-1 mb-2 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                )}
                <div className="space-y-0.5">
                  {group.options.map((opt) => {
                    const count = groupCounts?.[opt.value] || 0;
                    const checked =
                      group.type === "checkbox"
                        ? (values[group.key] || new Set()).has(opt.value)
                        : values[group.key] === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                      >
                        <input
                          type={group.type === "checkbox" ? "checkbox" : "radio"}
                          name={
                            group.type === "radio" ? group.key : undefined
                          }
                          checked={checked}
                          onChange={() => {
                            if (group.type === "checkbox") {
                              const current = new Set(values[group.key] || []);
                              if (current.has(opt.value)) current.delete(opt.value);
                              else current.add(opt.value);
                              onChange(group.key, current);
                            } else {
                              onChange(group.key, opt.value);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span
                          className={`text-xs flex-1 truncate ${
                            checked
                              ? "text-indigo-700 font-medium"
                              : "text-gray-600"
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {count}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </FilterGroup>
        );
      })}

      {visibleGroups.length === 0 && (
        <p className="text-xs text-gray-400 italic text-center py-4">
          No filters visible. Click the gear icon to customize.
        </p>
      )}
    </div>
  );
}