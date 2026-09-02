import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function AnalystAssignmentChart({ xponanceContacts, assignmentCounts }) {
  const chartData = useMemo(() => {
    return xponanceContacts
      .map((c) => {
        const counts = assignmentCounts[c.id] || { primary: 0, secondary: 0 };
        const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown";
        return {
          name: name.length > 15 ? name.split(" ").map((n) => n[0]).join("") + " " + c.last_name : name,
          fullName: [c.salutation, c.first_name, c.middle_name, c.last_name, c.suffix].filter(Boolean).join(" "),
          Primary: counts.primary,
          Secondary: counts.secondary,
          Total: counts.primary + counts.secondary,
        };
      })
      .filter((d) => d.Total > 0)
      .sort((a, b) => b.Total - a.Total);
  }, [xponanceContacts, assignmentCounts]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400 italic">
        No analyst assignments yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 36 + 60)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: "#374151" }} />
        <Tooltip
          formatter={(value, name) => [value, name]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Primary" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
        <Bar dataKey="Secondary" stackId="a" fill="#a78bfa" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}