import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";
import { Network } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ChartCard, EmptyChart, TYPE_COLORS } from "./execDashboardModules";

/** A consultant relationship is active if it has started and not yet ended. */
function isRelationshipActive(termination_date, inception_date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (inception_date) {
    const start = new Date(inception_date);
    start.setHours(0, 0, 0, 0);
    if (start > today) return false;
  }
  if (termination_date) {
    const end = new Date(termination_date);
    end.setHours(0, 0, 0, 0);
    if (end < today) return false;
  }
  return true;
}

/** A contact assignment within a consultant relationship is active if not yet ended. */
function isContactActive(termination_date) {
  if (!termination_date) return true;
  const end = new Date(termination_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end >= today;
}

/**
 * Consultant Roles by Firm Type — aggregates all firm consultant data by firm
 * type, showing counts of active roles across the entire network.
 *
 * Supports two grouping modes:
 *   - "client": group by the type of the firm being consulted (firm_id)
 *   - "consultant": group by the type of the consultant firm (consultant_firm_id)
 */
export default function ConsultantRolesByFirmType() {
  const [viewMode, setViewMode] = useState("client");

  const { data: consultants = [], isLoading: loadingConsultants } = useQuery({
    queryKey: ["firm-consultants-by-type"],
    queryFn: () => base44.entities.FirmConsultant.list("-created_date", 5000),
  });

  const { data: firms = [], isLoading: loadingFirms } = useQuery({
    queryKey: ["firms-for-consultant-type-summary"],
    queryFn: () => base44.entities.Firm.list("-created_date", 5000),
  });

  const isLoading = loadingConsultants || loadingFirms;

  // Map firm_id -> array of firm types (firm_types multi-select, fallback to firm_type)
  const firmTypeMap = useMemo(() => {
    const map = new Map();
    for (const f of firms) {
      const types = f.firm_types?.length ? f.firm_types : (f.firm_type ? [f.firm_type] : []);
      map.set(f.id, types);
    }
    return map;
  }, [firms]);

  // Aggregate active consultant data by firm type
  const summary = useMemo(() => {
    const byType = {};

    for (const c of consultants) {
      if (!isRelationshipActive(c.termination_date, c.inception_date)) continue;

      const groupFirmId = viewMode === "client" ? c.firm_id : c.consultant_firm_id;
      const types = firmTypeMap.get(groupFirmId) || [];
      const effectiveTypes = types.length ? types : ["Uncategorized"];

      const roles = c.roles || [];
      const activeContacts = (c.contacts || []).filter((ct) => isContactActive(ct.termination_date));

      for (const ft of effectiveTypes) {
        if (!byType[ft]) {
          byType[ft] = {
            firms: new Set(),
            consultantFirms: new Set(),
            relationships: 0,
            roles: 0,
            activeContacts: 0,
            roleBreakdown: {},
            contactRoleBreakdown: {},
          };
        }
        byType[ft].firms.add(c.firm_id);
        byType[ft].consultantFirms.add(c.consultant_firm_id);
        byType[ft].relationships += 1;
        byType[ft].roles += roles.length;
        byType[ft].activeContacts += activeContacts.length;

        for (const r of roles) {
          if (!byType[ft].roleBreakdown[r]) byType[ft].roleBreakdown[r] = 0;
          byType[ft].roleBreakdown[r] += 1;
        }
        for (const ct of activeContacts) {
          if (ct.contact_role) {
            if (!byType[ft].contactRoleBreakdown[ct.contact_role]) byType[ft].contactRoleBreakdown[ct.contact_role] = 0;
            byType[ft].contactRoleBreakdown[ct.contact_role] += 1;
          }
        }
      }
    }

    return Object.entries(byType)
      .map(([type, d]) => ({
        type,
        firms: d.firms.size,
        consultantFirms: d.consultantFirms.size,
        relationships: d.relationships,
        roles: d.roles,
        activeContacts: d.activeContacts,
        roleBreakdown: Object.entries(d.roleBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count })),
      }))
      .sort((a, b) => b.roles - a.roles);
  }, [consultants, firmTypeMap, viewMode]);

  const totalActiveRoles = useMemo(() => summary.reduce((s, r) => s + r.roles, 0), [summary]);
  const totalActiveContacts = useMemo(() => summary.reduce((s, r) => s + r.activeContacts, 0), [summary]);
  const totalFirms = useMemo(() => new Set(consultants.filter((c) => isRelationshipActive(c.termination_date, c.inception_date)).map((c) => c.firm_id)).size, [consultants]);

  const chartData = summary.map((s) => ({ name: s.type, value: s.roles }));

  return (
    <ChartCard
      title="Consultant Roles by Firm Type"
      subtitle={`${totalActiveRoles} active role${totalActiveRoles !== 1 ? "s" : ""} · ${totalActiveContacts} contact${totalActiveContacts !== 1 ? "s" : ""} · ${totalFirms} firm${totalFirms !== 1 ? "s" : ""}`}
      icon={Network}
      iconColor="text-violet-600"
    >
      {/* View mode toggle */}
      <div className="flex items-center justify-end mb-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {[
            { key: "client", label: "Client Firm Type" },
            { key: "consultant", label: "Consultant Firm Type" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setViewMode(opt.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === opt.key
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <EmptyChart label="Loading..." />
      ) : summary.length === 0 ? (
        <EmptyChart label="No active consultant data" />
      ) : (
        <div className="space-y-4">
          {/* Chart */}
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 50)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={150} />
              <Tooltip
                cursor={{ fill: "#f9fafb" }}
                contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                formatter={(v) => [`${v} role${v !== 1 ? "s" : ""}`, "Active Roles"]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28} name="Active Roles">
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={TYPE_COLORS[idx % TYPE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Summary table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 bg-gray-50/50">
                  <th className="text-left font-medium py-2 px-3">Firm Type</th>
                  <th className="text-center font-medium py-2 px-3">Firms</th>
                  <th className="text-center font-medium py-2 px-3">Consultant Firms</th>
                  <th className="text-center font-medium py-2 px-3">Relationships</th>
                  <th className="text-center font-medium py-2 px-3">Active Roles</th>
                  <th className="text-center font-medium py-2 px-3">Active Contacts</th>
                  <th className="text-left font-medium py-2 px-3">Top Role</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row, idx) => (
                  <tr key={row.type} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TYPE_COLORS[idx % TYPE_COLORS.length] }} />
                        <span className="font-medium text-gray-800">{row.type}</span>
                      </div>
                    </td>
                    <td className="text-center py-2 px-3 text-gray-600">{row.firms}</td>
                    <td className="text-center py-2 px-3 text-gray-600">{row.consultantFirms}</td>
                    <td className="text-center py-2 px-3 text-gray-600">{row.relationships}</td>
                    <td className="text-center py-2 px-3 font-semibold text-gray-900">{row.roles}</td>
                    <td className="text-center py-2 px-3 text-gray-600">{row.activeContacts}</td>
                    <td className="py-2 px-3 text-gray-600 text-xs">
                      {row.roleBreakdown.length > 0 ? `${row.roleBreakdown[0].name} (${row.roleBreakdown[0].count})` : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                  <td className="py-2 px-3 text-gray-800">Total</td>
                  <td className="text-center py-2 px-3 text-gray-500">—</td>
                  <td className="text-center py-2 px-3 text-gray-500">—</td>
                  <td className="text-center py-2 px-3 text-gray-500">—</td>
                  <td className="text-center py-2 px-3 text-gray-900">{totalActiveRoles}</td>
                  <td className="text-center py-2 px-3 text-gray-700">{totalActiveContacts}</td>
                  <td className="py-2 px-3 text-gray-500">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ChartCard>
  );
}