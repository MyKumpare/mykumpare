import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";
import { Briefcase } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ChartCard, EmptyChart, TYPE_COLORS } from "./execDashboardModules";

/**
 * Allocators by Consultant Role — horizontal bar chart showing how many
 * unique allocator firms are managed by each investment consultant role type
 * (e.g. General Consultant, Asset Class Consultant).
 *
 * Supports three filter modes:
 *   - Allocator: filter to a single allocator firm
 *   - Investment Consultant: filter to a single consultant firm
 *   - Contact: filter to a single contact involved in the consultant relationship
 */
export default function AllocatorsByConsultantRole() {
  const [filterMode, setFilterMode] = useState("none"); // "none" | "allocator" | "consultant" | "contact"
  const [filterValue, setFilterValue] = useState("");

  const { data: consultants = [], isLoading } = useQuery({
    queryKey: ["firm-consultants-exec"],
    queryFn: () => base44.entities.FirmConsultant.list("-created_date", 2000),
  });

  // Build dropdown options for each filter mode
  const allocatorOptions = useMemo(() => {
    const map = new Map();
    for (const c of consultants) {
      if (c.firm_id && c.firm_name) map.set(c.firm_id, c.firm_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [consultants]);

  const consultantFirmOptions = useMemo(() => {
    const map = new Map();
    for (const c of consultants) {
      if (c.consultant_firm_id && c.consultant_firm_name) map.set(c.consultant_firm_id, c.consultant_firm_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [consultants]);

  const contactOptions = useMemo(() => {
    const map = new Map();
    for (const c of consultants) {
      for (const ct of (c.contacts || [])) {
        if (ct.contact_id && ct.contact_name) map.set(ct.contact_id, ct.contact_name);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [consultants]);

  // Filter the consultant records based on the selected filter mode
  const filtered = useMemo(() => {
    if (filterMode === "none" || !filterValue) return consultants;
    if (filterMode === "allocator") return consultants.filter((c) => c.firm_id === filterValue);
    if (filterMode === "consultant") return consultants.filter((c) => c.consultant_firm_id === filterValue);
    if (filterMode === "contact") return consultants.filter((c) => (c.contacts || []).some((ct) => ct.contact_id === filterValue));
    return consultants;
  }, [consultants, filterMode, filterValue]);

  // Count unique allocator firms per consultant role type
  const chartData = useMemo(() => {
    const roleToFirms = {}; // role -> Set(firm_id)
    for (const c of filtered) {
      const roles = c.roles || [];
      if (!roles.length) {
        if (!roleToFirms["No Role Assigned"]) roleToFirms["No Role Assigned"] = new Set();
        roleToFirms["No Role Assigned"].add(c.firm_id);
      } else {
        for (const r of roles) {
          if (!roleToFirms[r]) roleToFirms[r] = new Set();
          roleToFirms[r].add(c.firm_id);
        }
      }
    }
    return Object.entries(roleToFirms)
      .map(([name, set]) => ({ name, value: set.size }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const totalAllocators = useMemo(() => new Set(filtered.map((c) => c.firm_id)).size, [filtered]);

  const handleModeChange = (mode) => {
    setFilterMode(mode);
    setFilterValue("");
  };

  const dropdownOptions =
    filterMode === "allocator" ? allocatorOptions :
    filterMode === "consultant" ? consultantFirmOptions :
    filterMode === "contact" ? contactOptions : [];

  return (
    <ChartCard
      title="Allocators by Consultant Role"
      subtitle={`${totalAllocators} allocator${totalAllocators !== 1 ? "s" : ""} · ${chartData.length} role${chartData.length !== 1 ? "s" : ""}`}
      icon={Briefcase}
      iconColor="text-indigo-600"
    >
      {/* Filter controls */}
      <div className="space-y-2 mb-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {[
            { key: "none", label: "All" },
            { key: "allocator", label: "Allocator" },
            { key: "consultant", label: "Consultant" },
            { key: "contact", label: "Contact" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleModeChange(opt.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterMode === opt.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {filterMode !== "none" && (
          <select
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="w-full h-8 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="">— Select {filterMode === "allocator" ? "an allocator" : filterMode === "consultant" ? "a consultant firm" : "a contact"} —</option>
            {dropdownOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <EmptyChart label="Loading..." />
      ) : chartData.length === 0 ? (
        <EmptyChart label={filterMode !== "none" && !filterValue ? "Select a filter value" : "No consultant data"} />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 44)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={150}
            />
            <Tooltip
              cursor={{ fill: "#f9fafb" }}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
              formatter={(v) => [`${v} allocator${v !== 1 ? "s" : ""}`, "Allocators"]}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24} name="Allocators">
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}