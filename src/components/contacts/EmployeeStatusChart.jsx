import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  Employee: "#4f46e5",     // indigo-600
  "Non-Employee": "#f59e0b", // amber-500
};

export default function EmployeeStatusChart({ employees = 0, nonEmployees = 0 }) {
  const total = employees + nonEmployees;
  const data = [
    { name: "Employees", value: employees, key: "Employee" },
    { name: "Non-Employees", value: nonEmployees, key: "Non-Employee" },
  ].filter((d) => d.value > 0);

  const noData = total === 0;
  const employeePct = total ? Math.round((employees / total) * 100) : 0;
  const nonEmployeePct = total ? 100 - employeePct : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-4">
      <div className="relative w-24 h-24 flex-shrink-0">
        {noData ? (
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 flex-shrink-0" />
            <span className="text-xs text-gray-600 truncate">Employees</span>
          </div>
          <span className="text-xs font-semibold text-gray-800 flex-shrink-0">
            {employees} · {employeePct}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="text-xs text-gray-600 truncate">Non-Employees</span>
          </div>
          <span className="text-xs font-semibold text-gray-800 flex-shrink-0">
            {nonEmployees} · {nonEmployeePct}%
          </span>
        </div>
      </div>
    </div>
  );
}