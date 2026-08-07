import React, { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const UNCLASSIFIED = "__unclassified__";

const VIEWS = {
  team: {
    key: "team",
    label: "Employee Status",
    field: "employee_status",
    categories: [
      { label: "Employees", value: "Employee", color: "#5D5FEF" },
      { label: "Non-Employees", value: "Non-Employee", color: "#F59E0B" },
      { label: "Unclassified", value: UNCLASSIFIED, color: "#9CA3AF" },
    ],
  },
  gender: {
    key: "gender",
    label: "Gender",
    field: "gender",
    categories: [
      { label: "Male", value: "Male", color: "#3B82F6" },
      { label: "Female", value: "Female", color: "#EC4899" },
      { label: "Undetermined", value: UNCLASSIFIED, color: "#9CA3AF" },
    ],
  },
  ethnicity: {
    key: "ethnicity",
    label: "Ethnicity",
    field: "ethnicity",
    isArray: true,
    categories: [
      { label: "African American", value: "African American", color: "#7C3AED" },
      { label: "Asian American", value: "Asian American", color: "#F59E0B" },
      { label: "Caucasian", value: "Caucasian", color: "#3B82F6" },
      { label: "Latino American", value: "Latino American", color: "#EC4899" },
      { label: "Native American Indian", value: "Native American Indian", color: "#10B981" },
      { label: "Native Alaskan Indian", value: "Native Alaskan Indian", color: "#06B6D4" },
      { label: "Unclassified", value: UNCLASSIFIED, color: "#9CA3AF" },
    ],
  },
  veteran: {
    key: "veteran",
    label: "Veteran",
    field: "veteran_status",
    categories: [
      { label: "Veteran Owned", value: "Veteran Owned", color: "#059669" },
      { label: "Non-Veteran Owned", value: "Non-Veteran Owned", color: "#F59E0B" },
      { label: "Undetermined", value: UNCLASSIFIED, color: "#9CA3AF" },
    ],
  },
  disability: {
    key: "disability",
    label: "Disability",
    field: "disability_status",
    categories: [
      { label: "Disabled", value: "Disabled", color: "#EF4444" },
      { label: "Non-Disabled", value: "Non-Disabled", color: "#10B981" },
      { label: "Undetermined", value: UNCLASSIFIED, color: "#9CA3AF" },
    ],
  },
};

export default function EmployeeStatusChart({
  contacts = [],
  filterSelected = {},
  onChartFilter,
  activeStatusFilter = null,
  onStatusFilter,
}) {
  const [viewKey, setViewKey] = useState("team");
  const config = VIEWS[viewKey];

  const total = contacts.length;

  const counts = useMemo(() => {
    const result = {};
    for (const cat of config.categories) result[cat.value] = 0;
    for (const c of contacts) {
      const val = c[config.field];
      if (config.isArray) {
        const vals = Array.isArray(val) ? val : [];
        if (vals.length === 0) result[UNCLASSIFIED] += 1;
        else for (const v of vals) if (result[v] !== undefined) result[v] += 1;
      } else if (val && val !== "Undetermined" && result[val] !== undefined) {
        result[val] += 1;
      } else {
        result[UNCLASSIFIED] += 1;
      }
    }
    return result;
  }, [contacts, config]);

  const active = useMemo(
    () => contacts.filter((c) => (c.contact_status || "Active") === "Active").length,
    [contacts]
  );
  const inactive = total - active;

  const data = config.categories
    .map((cat) => ({ name: cat.label, value: counts[cat.value] || 0, key: cat.value, color: cat.color }))
    .filter((d) => d.value > 0);

  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  const fieldSel = filterSelected[config.field];
  const activeFilter =
    fieldSel && fieldSel.size > 0
      ? config.categories.find((cat) => fieldSel.has(cat.value))?.value || null
      : null;

  // When a gender category is selected, compute the ethnicity breakdown of
  // the contacts matching that gender so it can be shown as a secondary view.
  const ethnicityBreakdown = useMemo(() => {
    if (viewKey !== "gender" || !activeFilter) return null;
    const subset = contacts.filter((c) => {
      const val = c[config.field];
      if (activeFilter === UNCLASSIFIED) return !val || val === "Undetermined";
      return val === activeFilter;
    });
    const ethCats = VIEWS.ethnicity.categories;
    const result = {};
    for (const cat of ethCats) result[cat.value] = 0;
    for (const c of subset) {
      const vals = Array.isArray(c.ethnicity) ? c.ethnicity : [];
      if (vals.length === 0) result[UNCLASSIFIED] += 1;
      else for (const v of vals) if (result[v] !== undefined) result[v] += 1;
    }
    return { subsetTotal: subset.length, counts: result };
  }, [contacts, viewKey, activeFilter, config]);

  const handleLabelClick = (value) => {
    if (!onChartFilter) return;
    onChartFilter(config.field, activeFilter === value ? null : value);
  };

  const handleViewChange = (newKey) => {
    if (newKey === viewKey) return;
    // Clear the previous view's filter so stale filters don't persist invisibly.
    const prevField = VIEWS[viewKey].field;
    if (filterSelected[prevField] && onChartFilter) onChartFilter(prevField, null);
    setViewKey(newKey);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      {/* View toggle */}
      <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-lg">
        {Object.values(VIEWS).map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => handleViewChange(v.key)}
            className={`flex-1 text-[11px] font-medium px-1.5 py-1 rounded-md transition-colors whitespace-nowrap ${
              viewKey === v.key ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 flex-shrink-0">
          {total === 0 ? (
            <div className="w-full h-full rounded-full border-4 border-gray-100 flex items-center justify-center">
              <span className="text-[10px] text-gray-400">No data</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} contact${value === 1 ? "" : "s"}`, name]}
                    contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-semibold text-gray-800 leading-none">{total}</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-wide">Total</span>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 space-y-1.5 min-w-0">
          <p className="text-xs font-medium text-gray-500">{config.label}</p>
          <div className="flex items-center gap-2 pb-0.5 border-b border-gray-100">
            <span className="flex-1 min-w-0" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 w-8 text-right">Count</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0 w-10 text-right">% of Total</span>
          </div>
          {config.categories.map((cat) => {
            const count = counts[cat.value] || 0;
            const isActive = activeFilter === cat.value;
            return (
              <div key={cat.value} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleLabelClick(cat.value)}
                  disabled={!onChartFilter}
                  className={`flex items-center gap-1.5 min-w-0 flex-1 group ${onChartFilter ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className={`text-xs truncate ${isActive ? "font-semibold text-gray-900 underline" : "text-gray-600 group-hover:text-gray-900 group-hover:underline"}`}>
                    {cat.label}
                  </span>
                </button>
                <span className="text-xs font-semibold text-gray-800 flex-shrink-0 w-8 text-right">{count}</span>
                <span className="text-xs font-semibold text-gray-800 flex-shrink-0 w-10 text-right">{pct(count)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Secondary ethnicity breakdown shown when a gender category is selected */}
      {ethnicityBreakdown && ethnicityBreakdown.subsetTotal > 0 && (
        <div className="border-t border-gray-100 pt-2.5 space-y-1.5">
          <p className="text-xs font-medium text-gray-500">
            Ethnicity breakdown: {activeFilter === UNCLASSIFIED ? "Undetermined" : activeFilter}
          </p>
          {VIEWS.ethnicity.categories.map((cat) => {
            const count = ethnicityBreakdown.counts[cat.value] || 0;
            if (count === 0) return null;
            const subPct = ethnicityBreakdown.subsetTotal
              ? Math.round((count / ethnicityBreakdown.subsetTotal) * 100)
              : 0;
            return (
              <div key={cat.value} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs text-gray-600 truncate">{cat.label}</span>
                </div>
                <span className="text-xs font-semibold text-gray-800 flex-shrink-0">
                  {count} · {subPct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!onStatusFilter}
          onClick={() => onStatusFilter?.(null)}
          className={`flex items-center gap-1.5 ${onStatusFilter ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
        >
          <span className={`text-xs ${activeStatusFilter === null ? "font-semibold text-gray-900" : "text-gray-500"}`}>Total Contacts</span>
          <span className={`text-sm font-semibold ${activeStatusFilter === null ? "text-indigo-700 underline" : "text-gray-800"}`}>{total}</span>
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!onStatusFilter}
            onClick={() => onStatusFilter?.("Active")}
            className={`flex items-center gap-1.5 ${onStatusFilter ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className={`text-xs ${activeStatusFilter === "Active" ? "font-semibold text-gray-900 underline" : "text-gray-500"}`}>Active</span>
            <span className={`text-xs font-semibold ${activeStatusFilter === "Active" ? "text-emerald-700" : "text-gray-800"}`}>{active}</span>
          </button>
          <button
            type="button"
            disabled={!onStatusFilter}
            onClick={() => onStatusFilter?.("Inactive")}
            className={`flex items-center gap-1.5 ${onStatusFilter ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className={`text-xs ${activeStatusFilter === "Inactive" ? "font-semibold text-gray-900 underline" : "text-gray-500"}`}>Inactive</span>
            <span className={`text-xs font-semibold ${activeStatusFilter === "Inactive" ? "text-red-700" : "text-gray-800"}`}>{inactive}</span>
          </button>
        </div>
      </div>
    </div>
  );
}