import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  Employee: "#5D5FEF",
  "Non-Employee": "#F59E0B",
  Unclassified: "#9CA3AF",
};

const UNCLASSIFIED_SENTINEL = "__unclassified__";

const CATEGORIES = [
  { label: "Employees", key: "Employee", valueKey: "employees" },
  { label: "Non-Employees", key: "Non-Employee", valueKey: "nonEmployees" },
  { label: "Unclassified", key: UNCLASSIFIED_SENTINEL, valueKey: "unclassified" },
];

export default function EmployeeStatusChart({
  employees = 0,
  nonEmployees = 0,
  unclassified = 0,
  active = 0,
  inactive = 0,
  activeFilter = null,
  onFilter,
}) {
  const total = employees + nonEmployees + unclassified;
  const data = CATEGORIES.map((c) => ({
    name: c.label,
    value: c.valueKey === "employees" ? employees : c.valueKey === "nonEmployees" ? nonEmployees : unclassified,
    key: c.key,
  })).filter((d) => d.value > 0);

  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  const handleLabelClick = (key) => {
    if (!onFilter) return;
    onFilter(activeFilter === key ? null : key);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
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
                      <Cell key={entry.key} fill={COLORS[entry.key]} />
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
          <p className="text-xs font-medium text-gray-500">Team Distribution</p>
          {CATEGORIES.map((c) => {
            const count = c.valueKey === "employees" ? employees : c.valueKey === "nonEmployees" ? nonEmployees : unclassified;
            const isActive = activeFilter === c.key;
            return (
              <div key={c.key} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleLabelClick(c.key)}
                  disabled={!onFilter}
                  className={`flex items-center gap-1.5 min-w-0 group ${onFilter ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[c.key] }} />
                  <span className={`text-xs truncate ${isActive ? "font-semibold text-gray-900 underline" : "text-gray-600 group-hover:text-gray-900 group-hover:underline"}`}>
                    {c.label}
                  </span>
                </button>
                <span className="text-xs font-semibold text-gray-800 flex-shrink-0">
                  {count} · {pct(count)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Total Contacts</span>
          <span className="text-sm font-semibold text-gray-800">{total}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-500">Active</span>
            <span className="text-xs font-semibold text-gray-800">{active}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-gray-500">Inactive</span>
            <span className="text-xs font-semibold text-gray-800">{inactive}</span>
          </div>
        </div>
      </div>
    </div>
  );
}